import {expect,test} from "@playwright/test";
import {DatabaseSync} from "node:sqlite";
import path from "node:path";
test("video alternatives and external failures are visible to students",async({page})=>{
 if(!process.cwd().endsWith("nmt-beta"))throw Error("QA worktree required");const db=new DatabaseSync(path.resolve("audit/tests/beta-chrome.db"));db.exec("PRAGMA busy_timeout=5000");
 const before=db.prepare("SELECT reviewStatus FROM VideoLesson WHERE id='qa-video'").get() as {reviewStatus:string};db.prepare("UPDATE VideoLesson SET reviewStatus='CONFIRMED' WHERE id='qa-video'").run();
 try {await page.route(/youtube\.com|ytimg\.com/,route=>route.abort());await page.goto("/login");await page.getByLabel("Нікнейм",{exact:true}).fill("student_a");await page.getByLabel("Пароль",{exact:true}).fill("Nmt-Ui-QA-Only-2026");await page.getByRole("button",{name:"Увійти",exact:true}).click();await expect(page).toHaveURL(/:3100\/$/);await page.goto("/learn/qa-linear");await page.getByRole("tab",{name:"Відео",exact:true}).click();await page.getByRole("button",{name:"Інше пояснення",exact:true}).click();await expect(page.getByText("Іншого підтвердженого відео для цієї теми ще немає.",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Запустити лекцію",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:"YouTube"})).toBeVisible();await page.getByRole("tab",{name:"Конспект",exact:true}).click();await expect(page.getByRole("tab",{name:"Конспект",exact:true})).toHaveAttribute("aria-selected","true");}
 finally {db.prepare("UPDATE VideoLesson SET reviewStatus=? WHERE id='qa-video'").run(before.reviewStatus);db.close();}
});
