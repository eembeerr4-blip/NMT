import {expect,test} from "@playwright/test";
test("reviewed key screens match visual baselines in both themes",async({page})=>{
 await page.emulateMedia({reducedMotion:"reduce"});
 for(const theme of ["light","dark"]){await page.goto("/login");await page.evaluate(value=>localStorage.setItem("theme",value),theme);await page.reload();await expect(page.locator("html")).toHaveClass(new RegExp(theme));await page.evaluate(()=>document.fonts.ready);await expect(page).toHaveScreenshot(`login-${theme}.png`,{animations:"disabled",maxDiffPixelRatio:0.005});}
 await page.getByLabel("Нікнейм",{exact:true}).fill("student_b");await page.getByLabel("Пароль",{exact:true}).fill("Nmt-Ui-QA-Only-2026");await page.getByRole("button",{name:"Увійти",exact:true}).click();await expect(page).toHaveURL(/:3100\/$/);
 for(const theme of ["light","dark"]){await page.evaluate(value=>localStorage.setItem("theme",value),theme);for(const [name,route] of [["subjects","/subjects"],["lesson","/learn/qa-empty"]]){await page.goto(route);await expect(page.locator("html")).toHaveClass(new RegExp(theme));await page.evaluate(()=>document.fonts.ready);await expect(page).toHaveScreenshot(`${name}-${theme}.png`,{animations:"disabled",fullPage:true,maxDiffPixelRatio:0.005});}}
});
