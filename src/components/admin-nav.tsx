"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BookOpen, ClipboardList, FileText, LayoutDashboard, Library, ListTree, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
const sections=[{href:"/admin",label:"Огляд",icon:LayoutDashboard},{href:"/admin/users",label:"Користувачі та ролі",icon:Users},{href:"/admin/subjects",label:"Предмети",icon:Library},{href:"/admin/topics",label:"Розділи та теми",icon:ListTree},{href:"/admin/lessons",label:"Уроки",icon:BookOpen},{href:"/admin/tasks",label:"Завдання",icon:ClipboardList},{href:"/admin/tests",label:"Тести",icon:FileText},{href:"/admin/settings",label:"Налаштування",icon:Settings},{href:"/admin/audit",label:"Журнал дій",icon:Activity}];
export function AdminNav({mobile=false}:{mobile?:boolean}){
 const pathname=usePathname();
 return <nav aria-label={mobile?"Мобільна навігація адміністратора":"Навігація адміністратора"} className={mobile?"grid grid-cols-2 gap-1 pb-2 pt-2":"flex-1 space-y-1 overflow-y-auto p-3"}>{sections.map(({href,label,icon:Icon})=>{
 const active=pathname===href||(href!=="/admin"&&pathname.startsWith(href+"/"));
 return <Link key={href} href={href} aria-current={active?"page":undefined} onClick={event=>{if(mobile)event.currentTarget.closest("details")?.removeAttribute("open");}} className={cn("flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium",active?"bg-accent text-primary":"text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="h-[18px] w-[18px] shrink-0"/><span>{label}</span></Link>;
 })}</nav>;
}
