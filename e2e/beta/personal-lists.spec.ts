import {expect,test} from "@playwright/test";
test("personal histories apply search and keep an owned editor accessible",async({page})=>{
 await page.goto("/login");await page.getByLabel("Нікнейм",{exact:true}).fill("student_a");await page.getByLabel("Пароль",{exact:true}).fill("Nmt-Ui-QA-Only-2026");await page.getByRole("button",{name:"Увійти",exact:true}).click();await expect(page).toHaveURL(/:3100\/$/);
 await page.goto("/notes?q=QA-no-match-unique");await expect(page.getByRole("heading",{name:"A PRIVATE SENTINEL",exact:true})).toHaveCount(0);await expect(page.getByRole("textbox",{name:"Пошук конспектів",exact:true})).toHaveValue("QA-no-match-unique");
 await page.goto("/results?q=QA-no-match-unique");await expect(page.getByText("A PRIVATE RESULT",{exact:false})).toHaveCount(0);
 await page.goto("/results?q=QA-no-match-unique&edit=qa-result-a");await expect(page.getByRole("dialog")).toBeVisible();
});
