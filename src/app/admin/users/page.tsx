import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Button, Card, PageHeader } from "@/components/ui";
import { RoleManager } from "@/components/role-manager";
import { effectiveRole, isPlatformRole, ROLE_INFO, ROLE_ORDER } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAdministrator } from "@/server/session";
export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const currentUser=await requireAdministrator();
  const params=await searchParams;
  const query=(params.q??"").trim().slice(0,120);
  const selectedRole=params.role&&isPlatformRole(params.role)?params.role:"";
  const roleWhere:Prisma.UserWhereInput=selectedRole==="OWNER"?{OR:[{id:"owner"},{role:"OWNER"}]}:selectedRole?{role:selectedRole,id:{not:"owner"}}:{};
  const [candidates,counts]=await Promise.all([
    prisma.user.findMany({where:roleWhere,select:{id:true,firstName:true,lastName:true,nickname:true,role:true,createdAt:true,onboarded:true},take:5000,orderBy:[{firstName:"asc"},{id:"asc"}]}),
    prisma.user.groupBy({by:["id","role"],_count:true}),
  ]);
  const normalized=query.normalize("NFKC").toLocaleLowerCase("uk-UA");
  const users=candidates.filter(user=>(user.firstName+" "+user.lastName+" "+user.nickname).normalize("NFKC").toLocaleLowerCase("uk-UA").includes(normalized)).slice(0,200);
  const totals=Object.fromEntries(ROLE_ORDER.map(role=>[role,counts.filter(row=>effectiveRole(row)===role).reduce((n,row)=>n+row._count,0)]));
  const ordered=users.sort((a,b)=>ROLE_INFO[effectiveRole(b)].rank-ROLE_INFO[effectiveRole(a)].rank);
  const filterUrl=(role:string)=>`/admin/users?${new URLSearchParams({...(query?{q:query}:{}),...(role?{role}:{})})}`;
  return <>
    <PageHeader title="Користувачі та ролі" description="Знайдіть профіль, перегляньте його права та призначте потрібний рівень доступу."/>
    <section className="space-y-3" aria-labelledby="roles-guide"><div><h2 id="roles-guide" className="text-lg font-semibold">Хто що може робити</h2><p className="mt-1 text-sm text-muted-foreground">Ієрархія доступу: власник → адміністратор → редактор → учень. Вища роль має права нижчих.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{ROLE_ORDER.map(role=><Card key={role} className="space-y-3 p-5"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{ROLE_INFO[role].label}</h3><span className="rounded-lg bg-accent px-2.5 py-1 text-sm font-semibold text-accent-foreground">{totals[role]}</span></div><p className="text-sm leading-6 text-muted-foreground">{ROLE_INFO[role].description}</p></Card>)}</div>
    </section>
    <Card className="space-y-4 p-4 sm:p-5"><nav className="flex flex-wrap gap-2" aria-label="Вибір ролі для перегляду">{[["","Усі ролі"],...ROLE_ORDER.map(role=>[role,ROLE_INFO[role].label])].map(([role,label])=><Button key={role} asChild variant={selectedRole===role?"default":"outline"} size="sm"><Link href={filterUrl(role)} aria-current={selectedRole===role?"page":undefined}>{label}{role?` · ${totals[role]}`:` · ${counts.reduce((n,row)=>n+row._count,0)}`}</Link></Button>)}</nav>
      <form key={`${query}:${selectedRole}`} className="flex flex-wrap gap-3" role="search"><input type="hidden" name="role" value={selectedRole}/><label className="grid min-w-0 flex-1 gap-1.5 text-sm"><span className="font-medium">Пошук за ім’ям або нікнеймом</span><input name="q" defaultValue={query} placeholder="Наприклад, Максим" maxLength={120}/></label><div className="flex items-end gap-2"><Button type="submit">Знайти</Button>{query||selectedRole?<Button asChild variant="ghost"><Link href="/admin/users">Скинути</Link></Button>:null}</div></form>
      <p className="text-sm text-muted-foreground">Знайдено {users.length} профілів{users.length===200?" · показано перші 200, уточніть пошук":""}. Власну роль та роль початкового власника змінити не можна.</p>
    </Card>
    <RoleManager key={users.map(user=>`${user.id}:${user.role}`).join(",")} users={ordered.map(user=>({...user,createdAt:user.createdAt.toISOString()}))} currentUser={{id:currentUser.id,role:currentUser.role}}/>
  </>;
}
