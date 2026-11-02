import type { Locator, Page } from "@playwright/test";
import {
  type ReleaseSummary,
  type Stage7PublishTopicId,
  assertSingleQuestionCard,
  attachTopicId,
  interpretPublishAttempt,
  lessonPageIndicatesPublished,
  observeQuestionCardStateFromText,
  parseModerationStatusMessage,
  questionEditPath,
  questionsListUrl,
} from "./stage7-production-browser-release-lib";

export type BrowserReleaseConfig = {
  base: string;
  adminPrefix: string;
  allowlistIds: Set<string>;
};

export function questionCardLocator(page: Page, adminPrefix: string, questionId: string): Locator {
  const hrefSuffix = questionEditPath(adminPrefix, questionId);
  return page.locator("div.border-border").filter({
    has: page.locator(`a[href$="${hrefSuffix}"]`),
  });
}

export async function findQuestionCardInStatusFilter(
  page: Page,
  config: BrowserReleaseConfig,
  topicId: string,
  questionId: string,
  status: "DRAFT" | "VERIFIED",
): Promise<Locator | null> {
  for (let pageNum = 1; pageNum <= 20; pageNum++) {
  await page.goto(questionsListUrl(config.base, config.adminPrefix, topicId, status, pageNum), {
    waitUntil: "networkidle",
  });
    const cards = questionCardLocator(page, config.adminPrefix, questionId);
    const count = await cards.count();
    if (count === 1) return cards.first();
    if (count > 1) return null;
    const nextLink = page.getByRole("link", { name: "Далі" });
    if ((await nextLink.count()) === 0) break;
  }
  return null;
}

export async function findQuestionCardAnyStatus(
  page: Page,
  config: BrowserReleaseConfig,
  topicId: string,
  questionId: string,
): Promise<{ card: Locator; status: "DRAFT" | "VERIFIED" } | null> {
  for (const status of ["VERIFIED", "DRAFT"] as const) {
    const card = await findQuestionCardInStatusFilter(page, config, topicId, questionId, status);
    if (card) return { card, status };
  }
  return null;
}

async function readCardState(card: Locator) {
  return observeQuestionCardStateFromText(await card.innerText());
}

async function readModerationMessage(card: Locator) {
  const statusLine = card.locator('[role="status"]');
  if ((await statusLine.count()) === 0) return null;
  return (await statusLine.first().textContent())?.trim() ?? null;
}

export async function confirmQuestionVerifiedOnVerifiedList(
  page: Page,
  config: BrowserReleaseConfig,
  topicId: string,
  questionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const card = await findQuestionCardInStatusFilter(page, config, topicId, questionId, "VERIFIED");
  if (!card) {
    return { ok: false, error: `Question ${questionId} not found on VERIFIED admin list` };
  }
  const state = await readCardState(card);
  if (state !== "VERIFIED") {
    return { ok: false, error: `Question on VERIFIED filter but card state is ${state}` };
  }
  return { ok: true };
}

export async function verifyAllowlistedQuestion(
  page: Page,
  config: BrowserReleaseConfig,
  topicId: string,
  questionId: string,
  summary: ReleaseSummary,
): Promise<void> {
  if (!config.allowlistIds.has(questionId)) {
    summary.failedIds.push({ id: questionId, error: "Not in Stage 7 allowlist" });
    return;
  }

  const existingVerified = await findQuestionCardInStatusFilter(
    page,
    config,
    topicId,
    questionId,
    "VERIFIED",
  );
  if (existingVerified) {
    const state = await readCardState(existingVerified);
    if (state === "VERIFIED") {
      summary.alreadyVerifiedIds.push(questionId);
      return;
    }
    summary.failedIds.push({
      id: questionId,
      error: `Question appears on VERIFIED filter but card state is ${state}`,
    });
    return;
  }

  const draftCard = await findQuestionCardInStatusFilter(page, config, topicId, questionId, "DRAFT");
  if (!draftCard) {
    const cards = questionCardLocator(page, config.adminPrefix, questionId);
    const cardCheck = assertSingleQuestionCard(await cards.count(), questionId);
    summary.failedIds.push({
      id: questionId,
      error: cardCheck.ok ? "Question card not found on DRAFT or VERIFIED lists" : cardCheck.error,
    });
    return;
  }

  const beforeState = await readCardState(draftCard);
  if (beforeState !== "DRAFT") {
    summary.failedIds.push({
      id: questionId,
      error: `Cannot verify from state ${beforeState} on DRAFT list`,
    });
    return;
  }

  const verifyButton = draftCard.getByRole("button", { name: "Позначити перевіреним" });
  if ((await verifyButton.count()) !== 1) {
    summary.failedIds.push({ id: questionId, error: "Verify button missing or ambiguous inside question card" });
    return;
  }

  await verifyButton.scrollIntoViewIfNeeded();
  // The successful router.refresh removes the DRAFT card and its status line.
  // Wait for the actual action response, then confirm on the VERIFIED list.
  const actionResponse = page.waitForResponse(response =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === config.adminPrefix + "/questions",
    { timeout: 30_000 },
  );
  await verifyButton.click();
  const response = await actionResponse;
  // RSC responses may remain streamed after the committed action; verify with a fresh server read.
  if (!response.ok()) {
    summary.failedIds.push({ id: questionId, error: "Verification action HTTP " + response.status() });
    return;
  }

  const deadline = Date.now() + 20_000;
  let lastConfirmError = "Verify did not reach VERIFIED on admin list";
  while (Date.now() < deadline) {
    const confirmed = await confirmQuestionVerifiedOnVerifiedList(page, config, topicId, questionId);
    if (confirmed.ok) {
      summary.verifiedIds.push(questionId);
      return;
    }
    lastConfirmError = confirmed.error;

    const draftAgain = await findQuestionCardInStatusFilter(page, config, topicId, questionId, "DRAFT");
    if (draftAgain) {
      const moderationMessage = await readModerationMessage(draftAgain);
      const messageKind = parseModerationStatusMessage(moderationMessage);
      if (messageKind === "error") {
        summary.failedIds.push({
          id: questionId,
          error: moderationMessage || "verifyQuestion returned an error in UI",
        });
        return;
      }
    }

    await page.waitForTimeout(1000);
  }

  summary.failedIds.push({ id: questionId, error: lastConfirmError });
}

export async function publishTopic(
  page: Page,
  config: BrowserReleaseConfig,
  topicId: Stage7PublishTopicId,
  summary: ReleaseSummary,
): Promise<boolean> {
  await page.goto(`${config.base}${config.adminPrefix}/lessons/${topicId}`, { waitUntil: "networkidle" });
  const main = page.locator("main");
  const before = await main.innerText();

  if (lessonPageIndicatesPublished(before)) {
    summary.publishResults.push({ topicId, status: "alreadyPublished" });
    return true;
  }

  const pub = main.getByRole("button", { name: "Опублікувати для учнів" });
  if ((await pub.count()) !== 1) {
    summary.publishResults.push({
      topicId,
      status: "failed",
      error: "Publish button missing or ambiguous on lesson page",
    });
    return false;
  }

  const [publicationResponse] = await Promise.all([
    page.waitForResponse(response => response.request().method() === "POST" &&
      new URL(response.url()).pathname === config.adminPrefix + "/lessons/" + topicId,
      { timeout: 45_000 }),
    pub.click(),
  ]);
  if (!publicationResponse.ok()) {
    summary.publishResults.push({ topicId, status: "failed", error: "Publication action HTTP " + publicationResponse.status() });
    return false;
  }

  const deadline = Date.now() + 45_000;
  const lastError = "Could not confirm READY after publish attempt";
  while (Date.now() < deadline) {
    await page.goto(`${config.base}${config.adminPrefix}/lessons/${topicId}`, { waitUntil: "networkidle" });
    const mainAfter = page.locator("main");
    const statusLines = mainAfter.locator('[role="status"]');
    const statusMessage = (await statusLines.count()) > 0
      ? await statusLines.last().textContent()
      : null;
    const after = await mainAfter.innerText();
    const interpreted = attachTopicId(topicId, interpretPublishAttempt(before, after, statusMessage));

    if ("reason" in interpreted && interpreted.status === "noop") {
      summary.publishResults.push({ topicId, status: "alreadyPublished" });
      return true;
    }

    if (interpreted.status === "published") {
      summary.publishResults.push(interpreted);
      return true;
    }

    if (interpreted.status === "failed") {
      summary.publishResults.push(interpreted);
      return false;
    }

    await page.waitForTimeout(1000);
  }

  summary.publishResults.push({ topicId, status: "failed", error: lastError });
  return false;
}

export async function loginAdmin(page: Page, base: string, adminPrefix: string, password: string) {
  if (!password) throw new Error("STAGE7A1_OWNER_PASSWORD required");
  await page.goto(`${base}${adminPrefix}/lessons`, { waitUntil: "networkidle" });
  if (!page.url().includes("/login")) return;
  await page.getByLabel(/Нікнейм або email/i).fill("owner");
  const passwordField = page.getByLabel(/^Пароль$/i);
  await passwordField.fill(password);
  const filledPasswordLen = (await passwordField.inputValue()).length;
  if (filledPasswordLen !== password.length) {
    throw new Error(
      `Password field length mismatch after fill (env=${password.length}, field=${filledPasswordLen}). Form may not submit; check special characters.`,
    );
  }
  await page.getByRole("button", { name: "Увійти" }).click();

  const loginErrorPattern = /Не вдалося увійти|Підтвердіть email|відхилили|Заявку на реєстрацію/i;
  const result = await Promise.race([
    page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 45000 }).then(() => ({ kind: "navigated" as const })),
    page
      .locator('[role="alert"]')
      .filter({ hasText: loginErrorPattern })
      .waitFor({ timeout: 45000 })
      .then(async () => ({
        kind: "login_error" as const,
        message: (await page.locator('[role="alert"]').filter({ hasText: loginErrorPattern }).first().textContent())?.trim() ?? "",
      })),
  ]).catch(async () => {
    const filtered = page.locator('[role="alert"]').filter({ hasText: loginErrorPattern });
    const message = (await filtered.first().textContent().catch(() => null))?.trim();
    const pending = await page.getByRole("button", { name: /Вхід/i }).isVisible().catch(() => false);
    return {
      kind: "timeout" as const,
      message: message || null,
      submitStillPending: pending,
    };
  });

  if (result.kind === "login_error") {
    throw new Error(`Login rejected: ${result.message || "unknown"}. Check owner password for prisma/dev.db.`);
  }
  if (result.kind === "timeout") {
    const hint =
      password.length === 22
        ? " Env password length 22 matches QA default stage7a1-qa-smoke-2026 — use real owner password for prisma/dev.db."
        : "";
    const pendingNote = result.submitStillPending ? " Server Action still pending (no response)." : "";
    throw new Error(
      `Login timed out on ${page.url()}. pageMessage=${result.message || "none"}.${pendingNote}${hint} If you used the PS1 launcher, confirm password matches owner hash (see scripts/verify-owner-password-stdin.mjs).`,
    );
  }
  if (!page.url().includes("/admin")) {
    throw new Error(`Login landed on ${page.url()} — expected /admin (check owner password)`);
  }
}
