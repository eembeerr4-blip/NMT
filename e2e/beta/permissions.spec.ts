import {expect,test} from "@playwright/test";

test("expired cookie never changes API auth errors into HTML or plain text",async({context,page},testInfo)=>{
 await context.addCookies([{name:"nmt_user",value:"QA-invalid-session",url:"http://127.0.0.1:3100"}]);
 const evidence=[];
 for(const route of ["/api/export/results","/api/export/questions","/api/export/backup","/api/ai/stream"]){
  const response=route.includes("stream")?await page.request.post(route,{data:{prompt:"QA-no-provider"}}):await page.request.get(route);
  expect(response.status()).toBe(401);expect(response.headers()["content-type"]).toContain("application/json");expect(await response.json()).toMatchObject({error:expect.any(String)});
  evidence.push({route,status:response.status(),contentType:response.headers()["content-type"]});
 }
 await testInfo.attach("API auth evidence",{body:JSON.stringify(evidence),contentType:"application/json"});
});
test("owner learning sidebar has no administration; profile menu switches context",async({page},testInfo)=>{
 const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
 await page.goto("/login");await page.getByLabel("Нікнейм",{exact:true}).fill("owner");await page.getByLabel("Пароль",{exact:true}).fill("Nmt-Ui-QA-Only-2026");await page.getByRole("button",{name:"Увійти",exact:true}).click();await expect(page).toHaveURL(/:3100\/$/);
 await expect(page.getByRole("navigation",{name:"Основна навігація"}).locator('a[href="/admin"]')).toHaveCount(0);
 await page.locator('summary[aria-label="Меню профілю"]').click();await page.getByRole("link",{name:"Центр керування власника",exact:true}).click();await expect(page).toHaveURL(/\/admin$/);
 await page.screenshot({path:`design/screenshots/02-permissions/${testInfo.project.name}-owner-admin.png`,fullPage:true});
 expect(errors).toEqual([]);
});
