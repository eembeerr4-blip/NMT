import {expect,test} from "@playwright/test";
test.beforeEach(async({page})=>{await page.goto("/login");await page.getByLabel("Нікнейм",{exact:true}).fill("student_a");await page.getByLabel("Пароль",{exact:true}).fill("Nmt-Ui-QA-Only-2026");await page.getByRole("button",{name:"Увійти",exact:true}).click();await expect(page).toHaveURL(/:3100\/$/);});
test("unavailable topic has an honest state and no active lesson start",async({page})=>{
 await page.goto("/topics/QA-unavailable");await expect(page.getByRole("link",{name:"Відкрити урок →",exact:true})).toHaveCount(0);
 await expect(page.getByText("Матеріал готується",{exact:true}).first()).toBeVisible();
 await page.goto("/learn/QA-unavailable");await expect(page.getByText("Матеріал готується",{exact:true}).first()).toBeVisible();await expect(page.getByRole("button",{name:"Пройти тест",exact:true})).toHaveCount(0);
});
test("four active subjects are separated from the library and topics can be searched",async({page})=>{
 await page.goto("/subjects");const active=page.getByRole("region",{name:"Мої предмети",exact:true});await expect(active.getByRole("link")).toHaveCount(4);
 await page.locator("summary").filter({hasText:"Бібліотека інших предметів"}).click();await expect(page.getByRole("heading",{name:"Географія",exact:true})).toBeVisible();
 await page.goto("/subjects/math?q=QA-Матеріал");await expect(page.getByTestId("topic-card")).toHaveCount(1);await expect(page.getByTestId("topic-card")).toContainText("QA-Матеріал готується");
});
