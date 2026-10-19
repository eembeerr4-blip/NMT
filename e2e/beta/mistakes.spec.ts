import {expect,test} from "@playwright/test";
import {DatabaseSync} from "node:sqlite";
import path from "node:path";
test("mistake status failure is visible and retry persists",async({page})=>{
 if(!process.cwd().endsWith("nmt-beta"))throw Error("QA worktree required");
 const db=new DatabaseSync(path.resolve("audit/tests/beta-chrome.db"));db.exec("PRAGMA busy_timeout=5000");
 await page.goto("/login");await page.getByLabel("Нікнейм",{exact:true}).fill("student_a");await page.getByLabel("Пароль",{exact:true}).fill("Nmt-Ui-QA-Only-2026");await page.getByRole("button",{name:"Увійти",exact:true}).click();await expect(page).toHaveURL(/:3100\/$/);
 await page.goto("/mistakes");await page.getByLabel("Стан помилки").first().selectOption("REVIEWING");
 db.exec("CREATE TRIGGER QA_mistake_fail BEFORE UPDATE ON Mistake BEGIN SELECT RAISE(ABORT,'QA injected failure'); END");
 try {await page.getByRole("button",{name:"Зберегти стан",exact:true}).first().click();await expect(page.getByRole("alert").filter({hasText:"Не вдалося"})).toContainText("Не вдалося");await expect(page.getByLabel("Стан помилки").first()).toHaveValue("REVIEWING");}
 finally {db.exec("DROP TRIGGER IF EXISTS QA_mistake_fail");db.close();}
 await page.getByRole("button",{name:"Зберегти стан",exact:true}).first().click();await expect(page.getByRole("status").filter({hasText:"Стан збережено"})).toBeVisible();await page.reload();await expect(page.getByLabel("Стан помилки").first()).toHaveValue("REVIEWING");
});
