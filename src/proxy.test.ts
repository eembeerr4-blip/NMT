import {expect,it} from "vitest";
import {NextRequest} from "next/server";
import {proxy} from "./proxy";
it("returns JSON 401 for missing API sessions rather than login HTML",async()=>{
 for(const pathname of ["/api/export/backup","/api/export/results"]){const response=proxy(new NextRequest("http://qa.test"+pathname));expect(response.status).toBe(401);expect(response.headers.get("location")).toBeNull();expect(await response.json()).toEqual({error:"Потрібен вхід."});}
});
it("keeps login/onboarding open and redirects ordinary protected pages",()=>{
 expect(proxy(new NextRequest("http://qa.test/login")).status).toBe(200);expect(proxy(new NextRequest("http://qa.test/onboarding")).status).toBe(200);
 expect(proxy(new NextRequest("http://qa.test/settings")).headers.get("location")).toBe("http://qa.test/login");
});
it("leaves cookie validation to the endpoint, never treating presence as authorization",()=>{
 expect(proxy(new NextRequest("http://qa.test/api/export/backup",{headers:{cookie:"nmt_user=invalid"}})).headers.get("x-middleware-next")).toBe("1");
});
