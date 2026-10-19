import {expect,test} from "@playwright/test";
import axe from "axe-core";
test("key learning and administration screens have no serious accessibility violations",async({page},info)=>{
 test.setTimeout(180000);await page.emulateMedia({reducedMotion:"reduce"});const report:unknown[]=[];
 for(const identity of ["student_a","owner"]){await page.context().clearCookies();await page.goto("/login");await page.getByLabel("Нікнейм",{exact:true}).fill(identity);await page.getByLabel("Пароль",{exact:true}).fill("Nmt-Ui-QA-Only-2026");await page.getByRole("button",{name:"Увійти",exact:true}).click();await expect(page).toHaveURL(/:3100\/$/);
  for(const theme of ["light","dark"]){await page.evaluate(value=>localStorage.setItem("theme",value),theme);
   for(const route of identity==="owner"?["/admin/users","/admin/tests"]:["/subjects","/learn/qa-empty","/settings","/calendar","/mistakes"]){await page.goto(route);if(route==="/calendar")await page.getByText("Додати заняття",{exact:true}).click();if(route==="/settings")await page.getByRole("tab",{name:"Навчання",exact:true}).click();await expect(page.locator("html")).toHaveClass(new RegExp(theme));await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{})));});await page.addScriptTag({content:axe.source});const result=await page.evaluate(async()=>{const result=await (window as typeof window & {axe:typeof axe}).axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}});return result.violations.filter(item=>item.impact==="critical"||item.impact==="serious").map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))}));});report.push({identity,theme,route,violations:result});}
  }
 }
 await info.attach("axe-report",{body:JSON.stringify(report,null,2),contentType:"application/json"});expect(report.flatMap(item=>(item as {violations:unknown[]}).violations)).toEqual([]);
});
