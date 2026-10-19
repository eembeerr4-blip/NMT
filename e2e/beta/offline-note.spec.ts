import {expect,test} from "@playwright/test";
test("offline note keeps text and exposes retryable failure",async({page,context})=>{
 await page.goto("/login");await page.getByLabel("Нікнейм",{exact:true}).fill("student_a");await page.getByLabel("Пароль",{exact:true}).fill("Nmt-Ui-QA-Only-2026");await page.getByRole("button",{name:"Увійти",exact:true}).click();await expect(page).toHaveURL(/:3100\/$/);
 await page.goto("/notes");await page.getByText("Створити конспект",{exact:true}).click();await page.getByLabel("Назва конспекту",{exact:true}).first().fill("QA-offline-note");await page.getByLabel("Текст",{exact:true}).first().fill("QA текст не втрачено");
 await context.setOffline(true);
 try {await page.getByRole("button",{name:"Додати конспект",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:"з’єднання"})).toBeVisible();await expect(page.getByLabel("Текст",{exact:true}).first()).toHaveValue("QA текст не втрачено");}
 finally {await context.setOffline(false);}
});
