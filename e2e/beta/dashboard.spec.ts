import {expect,test} from "@playwright/test";
import {DatabaseSync} from "node:sqlite";
import path from "node:path";
test("dashboard never recommends an unavailable lesson even if its status is IN_PROGRESS",async({page})=>{
 if(!process.cwd().endsWith("nmt-beta"))throw Error("QA worktree required");
 const db=new DatabaseSync(path.resolve("audit/tests/beta-chrome.db"));db.exec("PRAGMA busy_timeout=5000");
 db.prepare("INSERT INTO UserTopicProgress(id,userId,topicId,status) VALUES('QA-availability-probe','student_b','QA-unavailable','IN_PROGRESS')").run();
 try {
  await page.goto("/login");await page.getByLabel("Нікнейм",{exact:true}).fill("student_b");await page.getByLabel("Пароль",{exact:true}).fill("Nmt-Ui-QA-Only-2026");await page.getByRole("button",{name:"Увійти",exact:true}).click();await expect(page).toHaveURL(/:3100\/$/);
  await expect(page.locator('a[href="/learn/QA-unavailable"]')).toHaveCount(0);
  await expect(page.locator('a[href="/learn/qa-linear"],a[href="/learn/qa-empty"]')).toHaveCount(1);
 } finally {db.prepare("DELETE FROM UserTopicProgress WHERE id='QA-availability-probe'").run();db.close();}
});
