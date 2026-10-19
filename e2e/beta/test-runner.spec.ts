import {expect,test} from "@playwright/test";
import {DatabaseSync} from "node:sqlite";
import path from "node:path";

test("sequence requires an intentional answer and restores it after reload",async({page},info)=>{
 if(!process.cwd().endsWith("nmt-beta"))throw Error("QA worktree required");
 const db=new DatabaseSync(path.resolve("audit/tests/beta-chrome.db"));db.exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON");
 const attempt=`QA-sequence-${info.project.name}-${Date.now()}`;
 db.prepare("INSERT OR IGNORE INTO Test(id,title,kind,topicId) VALUES('QA-sequence-only','QA-послідовність','TOPIC','qa-linear')").run();
 db.prepare("INSERT OR IGNORE INTO TestQuestion(id,testId,questionId,sortOrder) VALUES('QA-sequence-link','QA-sequence-only','qa-unused-SEQUENCE',0)").run();
 db.prepare("INSERT INTO TestAttempt(id,testId,userId) VALUES(?,'QA-sequence-only','student_a')").run(attempt);
 try {
  page.on("dialog",dialog=>dialog.type()==="beforeunload"?dialog.accept():dialog.dismiss());
  await page.goto("/login");await page.getByLabel("Нікнейм",{exact:true}).fill("student_a");await page.getByLabel("Пароль",{exact:true}).fill("Nmt-Ui-QA-Only-2026");await page.getByRole("button",{name:"Увійти",exact:true}).click();await expect(page).toHaveURL(/:3100\/$/);
  await page.goto(`/tests/${attempt}`);
  await expect(page.getByRole("button",{name:"Завдання 1, без відповіді",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Завершити",exact:true}).click();await expect(page.getByRole("alertdialog")).toContainText("1 із 1");
  await page.getByRole("button",{name:"Повернутися до тесту",exact:true}).click();
  await page.getByRole("button",{name:"Підтвердити поточний порядок",exact:true}).click();
  await expect(page.getByRole("button",{name:"Завдання 1, відповідь є",exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole("button",{name:"Завдання 1, відповідь є",exact:true})).toBeVisible();
 } finally {db.prepare("DELETE FROM TestAttempt WHERE id=?").run(attempt);db.close();}
});
