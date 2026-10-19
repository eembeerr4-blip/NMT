import {expect,test} from "@playwright/test";
test("learning load can be saved and survives reload",async({page})=>{
 await page.goto("/login");await page.getByLabel("Нікнейм",{exact:true}).fill("student_a");await page.getByLabel("Пароль",{exact:true}).fill("Nmt-Ui-QA-Only-2026");await page.getByRole("button",{name:"Увійти",exact:true}).click();await expect(page).toHaveURL(/:3100\/$/);
 await page.goto("/settings");await page.getByRole("tab",{name:"Навчання",exact:true}).click();await page.getByLabel("Хвилин на день",{exact:true}).fill("45");await page.getByRole("button",{name:"Зберегти час навчання",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"Час навчання збережено"})).toBeVisible();await page.reload();await page.getByRole("tab",{name:"Навчання",exact:true}).click();await expect(page.getByLabel("Хвилин на день",{exact:true})).toHaveValue("45");
});
