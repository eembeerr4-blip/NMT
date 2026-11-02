/** Playwright login diagnostic — wrong password only; no secrets logged. */
import { chromium } from "@playwright/test";

const base = process.env.STAGE7_PRODUCTION_BASE_URL ?? "http://127.0.0.1:3000";
const WRONG = "__stage7_login_diagnose_wrong__";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
  });

  await page.goto(`${base}/admin/lessons`, { waitUntil: "domcontentloaded" });
  const afterGoto = page.url();

  if (!afterGoto.includes("/login")) {
    console.log(JSON.stringify({ phase: "already_authenticated", url: afterGoto }, null, 2));
    await browser.close();
    return;
  }

  const nicknameLoc = page.getByLabel(/Нікнейм або email/i);
  const passwordLoc = page.getByLabel(/^Пароль$/i);
  await nicknameLoc.fill("owner");
  await passwordLoc.fill(WRONG);
  const beforeClick = {
    nickname: await nicknameLoc.inputValue(),
    passwordLen: (await passwordLoc.inputValue()).length,
  };

  await page.getByRole("button", { name: "Увійти" }).click();

  let outcome = "still_on_login";
  try {
    await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 12000 });
    outcome = "navigated_away";
  } catch {
    outcome = "still_on_login";
  }

  await page.waitForTimeout(500);
  const alertText = await page.locator('[role="alert"]').first().textContent().catch(() => null);
  const statusText = await page.locator('[role="status"]').first().textContent().catch(() => null);
  const pending = await page.getByRole("button", { name: /Вхід/i }).isVisible().catch(() => false);

  console.log(
    JSON.stringify(
      {
        afterAdminGoto: afterGoto,
        beforeClick,
        outcome,
        outcomeUrl: page.url(),
        alertText: alertText?.trim() || null,
        statusText: statusText?.trim() || null,
        submitStillPending: pending,
        consoleErrors: consoleErrors.slice(0, 8),
      },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch((e) => {
  console.log(JSON.stringify({ fatal: String(e) }));
  process.exit(1);
});
