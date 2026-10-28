import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const widths = [320, 390, 768, 1280, 1920] as const;
const themes = ["light", "dark"] as const;
const pages = [
  { route: "/mistakes", slug: "mistakes", heading: "Мої помилки" },
  { route: "/review", slug: "review", heading: "Повторення" },
] as const;

const screenshotDir = path.join(process.cwd(), "stage5-qa", "screenshots");
const reportPath = path.join(process.cwd(), "stage5-qa", "visual-matrix.json");

type MatrixRow = {
  page: string;
  width: number;
  theme: string;
  pass: boolean;
  overflow: boolean;
  headingVisible: boolean;
  themeApplied: boolean;
  consoleErrors: string[];
  notes: string[];
};

const matrix: MatrixRow[] = [];

async function login(page: Page, nickname: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Нікнейм").fill(nickname);
  await page.locator("input[type=password]").fill(password);
  await page.getByRole("button", { name: "Увійти" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
}

async function applyTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((value) => {
    localStorage.setItem("theme", value);
    document.documentElement.classList.toggle("dark", value === "dark");
    document.documentElement.style.colorScheme = value;
  }, theme);
}

async function auditPage(page: Page, heading: string) {
  const consoleErrors: string[] = [];
  const handler = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  };
  page.on("console", handler);
  const headingVisible = await page.getByRole("heading", { name: heading, exact: true }).isVisible();
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const overflow = root.scrollWidth > root.clientWidth + 1;
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const card = document.querySelector(".rounded-2xl.border");
    const cardColor = card ? getComputedStyle(card).color : "";
    const katex = document.querySelector(".katex");
    return { overflow, bodyBg, cardColor, hasKatex: Boolean(katex) };
  });
  page.off("console", handler);
  return { headingVisible, consoleErrors, ...metrics };
}

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  mkdirSync(screenshotDir, { recursive: true });
});

test("logic checks on synthetic QA data", async ({ page }) => {
  await login(page, "stage5-smoke", "stage5-smoke-pass");
  await page.goto("/mistakes");
  const overview = page.locator("section[aria-label='Огляд помилок']");
  await expect(overview.getByText("Відкриті помилки")).toBeVisible();
  await expect(overview.getByText("Зараз повторюю")).toBeVisible();
  await expect(overview.getByText("Виправлено")).toBeVisible();
  await expect(overview).toContainText("1");
  await expect(page.getByText("HIDDEN_DRAFT_QA")).toHaveCount(0);
  await expect(page.getByText("OTHER_USER_ONLY")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Заплановане повторення" }).first()).toBeVisible();
  await expect(page.locator(".katex").first()).toBeVisible();

  await page.goto("/review");
  await expect(page.getByText("HIDDEN_DRAFT_QA")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Прострочені", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Помилки \(2\)/ }).first()).toBeVisible();

  await page.goto("/mistakes?status=OPEN");
  await expect(page.getByText("Відкриті помилки")).toBeVisible();
  await expect(overview).toContainText("1");

  await page.goto("/exams");
  await expect(page.getByText("SELF_REPORTED")).toBeVisible();
  await page.goto("/mistakes");
  await expect(page.locator("section[aria-label='Огляд помилок']")).toContainText("1");

  await login(page, "stage5-other", "stage5-other-pass");
  await page.goto("/mistakes");
  await expect(page.getByText("REVIEWING QA prompt")).toHaveCount(0);
  await expect(page.getByText("FIXED QA prompt")).toHaveCount(0);
  await expect(page.getByText("Додатковий контекст для перевірки переносу")).toHaveCount(0);
  await expect(page.getByText("OTHER_USER_ONLY")).toHaveCount(1);
});

test("visual matrix for mistakes and review", async ({ page }) => {
  await login(page, "stage5-smoke", "stage5-smoke-pass");

  for (const entry of pages) {
    for (const width of widths) {
      for (const theme of themes) {
        await page.setViewportSize({ width, height: 900 });
        await applyTheme(page, theme);
        await page.goto(entry.route);
        await page.waitForLoadState("networkidle");
        const audit = await auditPage(page, entry.heading);
        const themeApplied = await page.evaluate((expected) => document.documentElement.classList.contains("dark") === (expected === "dark"), theme);
        const file = path.join(screenshotDir, `${entry.slug}-${width}-${theme}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const pass = !audit.overflow && audit.headingVisible && themeApplied && audit.consoleErrors.length === 0;
        const notes: string[] = [];
        if (audit.overflow) notes.push("horizontal overflow");
        if (!audit.headingVisible) notes.push("heading missing");
        if (!themeApplied) notes.push("theme class mismatch");
        if (audit.consoleErrors.length) notes.push(`console: ${audit.consoleErrors.join("; ")}`);
        if (entry.slug === "mistakes" && !audit.hasKatex) notes.push("katex missing on mistakes");
        matrix.push({
          page: entry.slug,
          width,
          theme,
          pass: pass && notes.length === 0,
          overflow: audit.overflow,
          headingVisible: audit.headingVisible,
          themeApplied,
          consoleErrors: audit.consoleErrors,
          notes,
        });
        expect.soft(audit.overflow, `${entry.slug} ${width}px ${theme}`).toBeFalsy();
        expect.soft(audit.headingVisible).toBeTruthy();
        expect.soft(themeApplied).toBeTruthy();
        expect.soft(audit.consoleErrors).toEqual([]);
        if (width === 390 && theme === "light" && entry.slug === "mistakes") {
          await page.keyboard.press("Tab");
          const focused = await page.evaluate(() => document.activeElement?.tagName ?? "");
          expect.soft(["A", "BUTTON", "INPUT", "SELECT", "SUMMARY"].includes(focused)).toBeTruthy();
        }
      }
    }
  }

  writeFileSync(reportPath, JSON.stringify({ capturedAt: new Date().toISOString(), matrix }, null, 2));
});

test.afterAll(() => {
  const failed = matrix.filter((row) => !row.pass);
  if (failed.length) {
    console.log("Visual matrix failures:", failed);
  }
});
