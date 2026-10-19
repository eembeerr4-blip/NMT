import {expect,test} from "@playwright/test";
import type {Page} from "@playwright/test";
async function login(page:Page,nickname:string) {await page.context().clearCookies();await page.goto("/login");await page.getByLabel("Нікнейм",{exact:true}).fill(nickname);await page.getByLabel("Пароль",{exact:true}).fill("Nmt-Ui-QA-Only-2026");await page.getByRole("button",{name:"Увійти",exact:true}).click();await expect(page).toHaveURL(/:3100\/$/);}
test("administrator preview opens the test set rather than a missing attempt",async({page})=>{
 await page.goto("/login");await page.getByLabel("Нікнейм",{exact:true}).fill("qa_admin");await page.getByLabel("Пароль",{exact:true}).fill("Nmt-Ui-QA-Only-2026");await page.getByRole("button",{name:"Увійти",exact:true}).click();await expect(page).toHaveURL(/:3100\/$/);
 await page.goto("/admin/tests?q=QA-Тест+3+питання");await page.locator('tbody a').first().click();await expect(page).toHaveURL(/\/admin\/tests\/qa-test$/);await expect(page.getByRole("heading",{name:"QA-Тест 3 питання",exact:true})).toBeVisible();
});
test("test set publication, student start, archive and protected history work",async({page},info)=>{
 const title=`QA-набір-${info.project.name}-${Date.now()}`;
 await login(page,"qa_admin");await page.goto("/admin/tests/new?subject=math");await page.getByLabel("Назва набору",{exact:true}).fill(title);await page.locator('input[name="questionId"][value="qa-q1"]').check();await page.getByRole("button",{name:"Зберегти набір",exact:true}).click();await expect(page).toHaveURL(/\/admin\/tests\/(?!new)[^/]+$/);const setUrl=page.url();
 await page.getByRole("button",{name:"Опублікувати",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"Стан набору оновлено"})).toBeVisible();
 await login(page,"student_a");await page.goto("/tests");const card=page.getByRole("heading",{name:title,exact:true}).locator("..");await card.getByRole("button",{name:"Розпочати тест",exact:true}).click();await expect(page).toHaveURL(/:3100\/tests\/[^/]+$/);const attemptUrl=page.url();await expect(page.getByLabel("Числова відповідь",{exact:true})).toBeVisible();
 await login(page,"qa_admin");await page.goto(setUrl);await expect(page.getByText("Набір уже має спроби й захищений",{exact:false})).toBeVisible();await expect(page.getByRole("button",{name:"Зберегти набір",exact:true})).toHaveCount(0);await page.getByRole("button",{name:"Архівувати",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"Стан набору оновлено"})).toBeVisible();
 await login(page,"student_a");await page.goto("/tests");await expect(page.getByRole("heading",{name:title,exact:true}).locator("..").getByRole("button",{name:"Розпочати тест",exact:true})).toHaveCount(0);await page.goto(attemptUrl);await expect(page.getByLabel("Числова відповідь",{exact:true})).toBeVisible();
});
test("administrative tables keep action cells inside a phone viewport",async({page},info)=>{
 await login(page,"qa_admin");for(const route of ["topics","lessons","tasks","tests"]){await page.goto(`/admin/${route}`);const table=page.locator("table");if(await table.count()){await expect(table).toHaveClass(/responsive-table/);if(info.project.name==="mobile")expect(await table.evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(391);}}
});
