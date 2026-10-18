import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it,vi} from "vitest";
vi.mock("next/navigation",()=>({usePathname:()=>"/",useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
vi.mock("@/server/actions",()=>({logout:vi.fn()}));
import {AppShell} from "./app-shell";
it("student navigation stays educational for an owner; management is a profile context switch",()=>{
 const html=renderToStaticMarkup(createElement(AppShell,{isAdmin:true,isOwner:true,name:"QA-owner",children:"QA-content"}));
 const aside=html.match(/<aside[^>]*>([\s\S]*?)<\/aside>/)?.[1];expect(aside).toBeDefined();
 expect(aside).not.toContain('href="/admin"');expect(html).toContain("Центр керування власника");
});
