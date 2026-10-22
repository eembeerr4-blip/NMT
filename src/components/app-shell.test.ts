import {jsx} from "react/jsx-runtime";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it,vi} from "vitest";
vi.mock("next/navigation",()=>({usePathname:()=>"/",useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
vi.mock("@/server/actions",()=>({logout:vi.fn()}));
import {AppShell} from "./app-shell";
it("student navigation stays educational for an owner; management is a profile context switch",()=>{
 const html=renderToStaticMarkup(jsx(AppShell,{isAdmin:true,isOwner:true,name:"QA-owner",children:"QA-content"}));
 const aside=html.match(/<aside[^>]*>([\s\S]*?)<\/aside>/)?.[1];expect(aside).toBeDefined();
 expect(aside).not.toContain('href="/admin"');expect(html).toContain("Центр керування власника");
});
it("highlights the five primary student destinations in quick navigation",()=>{
 const html=renderToStaticMarkup(jsx(AppShell,{name:"QA-student",children:"QA-content"}));
 for(const label of ["Предмети","Календар","Тести","Прогрес","Профіль"])expect(html).toContain(label);
 expect(html).toContain('aria-label="Швидка навігація"');
});
