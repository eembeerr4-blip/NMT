import {expect,test} from "@playwright/test";
test("login has persistent field labels and supports keyboard submission",async({page})=>{
 await page.goto("/login");await expect(page.getByText("Нікнейм",{exact:true})).toBeVisible();await expect(page.getByText("Пароль",{exact:true})).toBeVisible();
 await page.getByLabel("Нікнейм",{exact:true}).fill("student_a");await page.keyboard.press("Tab");await expect(page.getByLabel("Пароль",{exact:true})).toBeFocused();await page.keyboard.type("wrong");await page.keyboard.press("Enter");await expect(page.getByRole("alert").filter({hasText:"Невірний"})).toBeVisible();
 await page.getByRole("link",{name:"Створити профіль",exact:true}).click();await page.getByRole("button",{name:"Розпочати",exact:true}).click();await expect(page.getByText("Нікнейм",{exact:true})).toBeVisible();await expect(page.getByText("Пароль",{exact:true})).toBeVisible();
});
