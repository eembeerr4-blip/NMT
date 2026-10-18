import {expect,test,type Page} from "@playwright/test";
import {DatabaseSync} from "node:sqlite";
import path from "node:path";

async function login(page:Page,nickname="student_a") {
 await page.goto("/login");await page.getByLabel("Нікнейм",{exact:true}).fill(nickname);await page.getByLabel("Пароль",{exact:true}).fill("Nmt-Ui-QA-Only-2026");await page.getByRole("button",{name:"Увійти",exact:true}).click();await expect(page).toHaveURL(/:3100\/$/);
}
function qaDatabase() {
 const root=path.resolve(".");if(!root.endsWith("nmt-beta"))throw Error("QA worktree required");
 return new DatabaseSync(path.join(root,"audit/tests/beta-chrome.db"));
}
test("HTTP auth, styles and protected API",async({page,request},testInfo)=>{
 const anonymous=await request.get("/api/export/backup");expect(anonymous.status()).toBe(401);expect(anonymous.headers()["content-type"]).toContain("application/json");
 await page.goto("/login");await page.getByLabel("Нікнейм",{exact:true}).fill("student_a");await page.getByLabel("Пароль",{exact:true}).fill("wrong");await page.getByRole("button",{name:"Увійти",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:"Невірний"})).toBeVisible();
 await login(page);await expect(page.getByRole("heading",{name:"Привіт, student_a!"})).toBeVisible();
 expect(await page.locator("body").evaluate(el=>getComputedStyle(el).fontFamily)).not.toContain("Times New Roman");
 await page.reload();await expect(page.getByRole("heading",{name:"Привіт, student_a!"})).toBeVisible();
 expect((await page.request.get("/api/export/backup")).status()).toBe(403);
 await page.screenshot({path:`design/screenshots/01-stability/${testInfo.project.name}-home.png`,fullPage:true});
});
test("C07 theory acknowledgement reports reading and never mastery",async({page},testInfo)=>{
 await login(page);await page.goto("/learn/qa-empty");await page.getByRole("tab",{name:"Практика",exact:true}).click();
 await page.getByRole("button",{name:"Позначити конспект як опрацьований"}).click();await expect(page.getByText("Позначте, що конспект опрацьовано.",{exact:false})).toBeVisible();
 await page.getByRole("checkbox",{name:"Я опрацював конспект"}).check();await page.getByRole("button",{name:"Позначити конспект як опрацьований"}).click();await expect(page.getByText("Конспект опрацьовано. Засвоєння буде визначено після практики.",{exact:false})).toBeVisible();
 await page.screenshot({path:`design/screenshots/01-stability/${testInfo.project.name}-theory.png`,fullPage:true});
 const db=qaDatabase();try{expect(db.prepare("SELECT status FROM UserTopicProgress WHERE userId='student_a' AND topicId='qa-empty'").get()?.status).toBe("IN_PROGRESS");}finally{db.close();}
});
test("A07 custom task failure retains inputs and offers a working retry",async({page},testInfo)=>{
 const retryTitle=`QA-retry-${testInfo.project.name}-${Date.now()}`;
 await login(page);await page.goto("/calendar?view=day&date=2026-10-21");await page.getByText("Додати заняття",{exact:true}).click();
 await page.getByPlaceholder("Власне заняття").fill("QA-fail");
 const db=qaDatabase();db.exec("CREATE TRIGGER QA_beta_custom_failure BEFORE INSERT ON StudyTask WHEN NEW.title='QA-fail' BEGIN SELECT RAISE(ABORT,'QA injected fault'); END");
 try {
  await page.getByRole("button",{name:"Додати",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:"Не вдалося"})).toBeVisible();await expect(page.getByPlaceholder("Власне заняття")).toHaveValue("QA-fail");
  await page.screenshot({path:`design/screenshots/01-stability/${testInfo.project.name}-visible-failure.png`,fullPage:true});
 } finally {db.exec("DROP TRIGGER IF EXISTS QA_beta_custom_failure");db.close();}
 await page.getByPlaceholder("Власне заняття").fill(retryTitle);await page.getByRole("button",{name:"Додати",exact:true}).click();await expect(page.getByRole("status")).toContainText("Заняття додано");await page.reload();await expect(page.getByText(retryTitle,{exact:true})).toBeVisible();
});
test("A07 review and C08 elective expose errors without silent navigation",async({page},testInfo)=>{
 await login(page);await page.goto("/review");await expect(page.getByRole("heading",{name:"Повторення",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Додати картку"})).toBeVisible();
 await page.goto("/settings");await page.getByRole("tab",{name:"Навчання",exact:true}).click();await page.locator('select[name="subjectId"]').selectOption("geography");await page.getByRole("button",{name:"Змінити предмет",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:"зміну предмета"})).toBeVisible();await expect(page.locator('select[name="subjectId"]')).toHaveValue("geography");
 await page.screenshot({path:`design/screenshots/01-stability/${testInfo.project.name}-elective-error.png`,fullPage:true});
});
test("C05 editor route and private attempt enforce real HTTP boundaries",async({page})=>{
 await login(page);expect((await page.goto("/editor/questions/qa-unused-NUMERIC"))?.status()).toBe(404);
 for(const nickname of ["qa_editor","qa_admin","owner"]){
  await login(page,nickname);expect((await page.goto("/editor/questions/qa-unused-NUMERIC"))?.status()).toBe(200);await expect(page.getByRole("heading",{name:"Редагувати завдання",exact:true})).toBeVisible();
 }
 await login(page,"student_b");const denied=await page.goto("/tests/qa-attempt-a");expect([200,404]).toContain(denied?.status());
 // App Router may already have streamed its shell; test the actual denial, not only status.
 await expect(page.getByRole("heading",{name:"Сторінку не знайдено",exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Завершити",exact:true})).toHaveCount(0);
 await expect(page.locator('meta[name="robots"][content="noindex"]').first()).toHaveAttribute("content","noindex");
});
