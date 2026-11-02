import { readFileSync } from "node:fs";

export const STAGE7_PUBLISH_TOPIC_ORDER = [
  "ukr-lexicology-section-01",
  "ukr-ortho-sub-01",
  "math-linear-eq-sub-02",
  "math-quadratic-sub-01",
  "cm-history-slavs-sub-01",
  "hist-galicia-sub-01",
  "bio-cell-sec-01",
  "zcode-biology-molecular-02",
  "geography-1",
  "geography-2",
] as const;

export type Stage7PublishTopicId = (typeof STAGE7_PUBLISH_TOPIC_ORDER)[number];

export type AllowlistEntry = { questionId: string; topicId: string };

export type QuestionObservedState = "VERIFIED" | "DRAFT" | "UNKNOWN";

export type VerifyFailure = { id: string; error: string };

export type PublishTopicResult =
  | { topicId: Stage7PublishTopicId; status: "published" }
  | { topicId: Stage7PublishTopicId; status: "alreadyPublished" }
  | { topicId: Stage7PublishTopicId; status: "failed"; error: string };

export type ReleaseSummary = {
  allowlistSize: number;
  verifiedIds: string[];
  alreadyVerifiedIds: string[];
  failedIds: VerifyFailure[];
  publishResults: PublishTopicResult[];
};

export function loadReleaseAllowlist(manifestPath: string): {
  entries: AllowlistEntry[];
  questionIds: Set<string>;
  byTopic: Map<string, string[]>;
} {
  const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    decisions: Array<{ questionId: string; topicId: string; reviewStatus: string }>;
  };
  const entries: AllowlistEntry[] = [];
  const questionIds = new Set<string>();
  const byTopic = new Map<string, string[]>();

  for (const row of raw.decisions) {
    if (row.reviewStatus !== "VERIFIED_CANDIDATE") continue;
    if (questionIds.has(row.questionId)) {
      throw new Error(`Duplicate allowlist questionId: ${row.questionId}`);
    }
    if (!STAGE7_PUBLISH_TOPIC_ORDER.includes(row.topicId as Stage7PublishTopicId)) {
      throw new Error(`Question ${row.questionId} topic ${row.topicId} not in publish allowlist`);
    }
    questionIds.add(row.questionId);
    entries.push({ questionId: row.questionId, topicId: row.topicId });
    const list = byTopic.get(row.topicId) ?? [];
    list.push(row.questionId);
    byTopic.set(row.topicId, list);
  }

  if (questionIds.size !== 120) {
    throw new Error(`Allowlist must contain 120 questions, got ${questionIds.size}`);
  }

  for (const topicId of STAGE7_PUBLISH_TOPIC_ORDER) {
    const count = byTopic.get(topicId)?.length ?? 0;
    if (count !== 12) {
      throw new Error(`Topic ${topicId} must have 12 allowlist questions, got ${count}`);
    }
  }

  return { entries, questionIds, byTopic };
}

export function questionEditPath(adminPrefix: string, questionId: string) {
  return `${adminPrefix}/questions/${questionId}`;
}

export function questionsListUrl(
  baseUrl: string,
  adminPrefix: string,
  topicId: string,
  status: "DRAFT" | "VERIFIED",
  page: number,
) {
  const params = new URLSearchParams({
    topic: topicId,
    status,
    page: String(page),
  });
  return `${baseUrl}${adminPrefix}/questions?${params.toString()}`;
}

/** Infer verification state from rendered question bank card text (admin UI). */
export function observeQuestionCardStateFromText(cardText: string): QuestionObservedState {
  if (cardText.includes("Позначити перевіреним")) return "DRAFT";
  if (cardText.includes("Перевірено")) return "VERIFIED";
  return "UNKNOWN";
}

export function assertSingleQuestionCard(
  cardCount: number,
  questionId: string,
): { ok: true } | { ok: false; error: string } {
  if (cardCount === 0) return { ok: false, error: `Question card not found for ${questionId}` };
  if (cardCount > 1) return { ok: false, error: `Ambiguous question card for ${questionId} (${cardCount} matches)` };
  return { ok: true };
}

export function isOffAllowlistQuestionId(questionId: string, allowlist: Set<string>) {
  return !allowlist.has(questionId);
}

export function computeVerifyCount(summary: Pick<ReleaseSummary, "verifiedIds">) {
  return summary.verifiedIds.length;
}

export function allAllowlistQuestionsVerified(summary: ReleaseSummary) {
  const seen = new Set([...summary.verifiedIds, ...summary.alreadyVerifiedIds]);
  if (seen.size !== summary.allowlistSize) return false;
  return summary.failedIds.length === 0;
}

export function lessonPageIndicatesPublished(mainText: string) {
  return mainText.includes("Урок опубліковано для учнів");
}

export function lessonPageHasPublishButton(mainText: string) {
  return mainText.includes("Опублікувати для учнів");
}

/** Parse publish attempt from lesson page text before/after click and status line. */
export function interpretPublishAttempt(
  mainTextBefore: string,
  mainTextAfter: string,
  statusMessage: string | null,
): PublishTopicResult | { status: "noop"; reason: "alreadyPublished" } {
  if (lessonPageIndicatesPublished(mainTextBefore)) {
    return { status: "noop", reason: "alreadyPublished" };
  }

  const msg = (statusMessage ?? "").trim();
  const publishedNow = lessonPageIndicatesPublished(mainTextAfter);

  if (publishedNow && !looksLikeErrorMessage(msg)) {
    return { status: "published", topicId: "" as Stage7PublishTopicId };
  }

  if (msg && looksLikeErrorMessage(msg)) {
    return { status: "failed", topicId: "" as Stage7PublishTopicId, error: msg };
  }

  if (!publishedNow && lessonPageHasPublishButton(mainTextAfter)) {
    return {
      status: "failed",
      topicId: "" as Stage7PublishTopicId,
      error: msg || "Publish button remains; lesson not READY after click",
    };
  }

  if (publishedNow) {
    return { status: "published", topicId: "" as Stage7PublishTopicId };
  }

  return {
    status: "failed",
    topicId: "" as Stage7PublishTopicId,
    error: msg || "Could not confirm READY after publish attempt",
  };
}

export function parseModerationStatusMessage(message: string | null): "error" | "success" | "unknown" {
  if (!message?.trim()) return "unknown";
  if (looksLikeErrorMessage(message)) return "error";
  if (message.toLowerCase().includes("збережено")) return "success";
  return "unknown";
}

function looksLikeErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (!message.trim()) return false;
  if (lower.includes("опубліковано") || lower.includes("збережено")) return false;
  return (
    lower.includes("не ") ||
    lower.includes("немож") ||
    lower.includes("потріб") ||
    lower.includes("перевір") ||
    lower.includes("чернет") ||
    lower.includes("помил")
  );
}

export function attachTopicId(
  topicId: Stage7PublishTopicId,
  result: Omit<PublishTopicResult, "topicId"> | { status: "noop"; reason: "alreadyPublished" },
): PublishTopicResult | { status: "noop"; reason: "alreadyPublished" } {
  if (result.status === "noop") return result;
  return { ...result, topicId } as PublishTopicResult;
}

export function releaseOk(summary: ReleaseSummary) {
  const publishFailed = summary.publishResults.some((r) => r.status === "failed");
  const publishCountOk =
    summary.publishResults.filter((r) => r.status === "published" || r.status === "alreadyPublished").length ===
    STAGE7_PUBLISH_TOPIC_ORDER.length;
  return allAllowlistQuestionsVerified(summary) && !publishFailed && publishCountOk;
}

export function buildReleaseJson(summary: ReleaseSummary, fatalError?: string) {
  const verifyCount = computeVerifyCount(summary);
  const ok = !fatalError && releaseOk(summary);
  return {
    ok,
    error: fatalError,
    allowlistSize: summary.allowlistSize,
    verifyCount,
    verifiedIds: summary.verifiedIds,
    alreadyVerifiedIds: summary.alreadyVerifiedIds,
    failedIds: summary.failedIds,
    publishResults: summary.publishResults,
  };
}
