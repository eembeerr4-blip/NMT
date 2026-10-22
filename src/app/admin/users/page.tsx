import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Button, Card, PageHeader } from "@/components/ui";
import { RoleManager } from "@/components/role-manager";
import { effectiveRole, isPlatformRole, ROLE_INFO, ROLE_ORDER } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAdministrator } from "@/server/session";
export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }> }) {
  const currentUser=await requireAdministrator();
  const params=await searchParams;
  const query=(params.q??"").normalize("NFKC").trim().slice(0,120);
  const selectedRole=params.role&&isPlatformRole(params.role)?params.role:"";
  const status=params.status==="ready"||params.status==="setup"?params.status:"";
  const requestedPage=Number(params.page??1);
  const page=Number.isSafeInteger(requestedPage)?Math.max(1,Math.min(requestedPage,100000)):1;
  const pageSize=25;
  const roleWhere:Prisma.UserWhereInput=selectedRole==="OWNER"?{OR:[{id:"owner"},{role:"OWNER"}]}:selectedRole?{role:selectedRole,id:{not:"owner"}}:{};
  const where:Prisma.UserWhereInput={AND:[
    roleWhere,
    query?{OR:[{nickname:{contains:query.toLocaleLowerCase("uk-UA")}},{firstName:{contains:query}},{lastName:{contains:query}}]}:{},
    status?{onboarded:status==="ready"}:{},
  ]};
  const [candidates,allUsers,roleCounts,protectedOwner,total]=await Promise.all([
    prisma.user.findMany({where,select:{id:true,firstName:true,lastName:true,nickname:true,role:true,createdAt:true,onboarded:true},skip:(page-1)*pageSize,take:pageSize,orderBy:[{firstName:"asc"},{id:"asc"}]}),
    prisma.user.count(),
    prisma.user.groupBy({by:["role"],_count:true}),
    prisma.user.findUnique({where:{id:"owner"},select:{role:true}}),
    prisma.user.count({where}),
  ]);
  const totals=Object.fromEntries(ROLE_ORDER.map(role=>[role,roleCounts.reduce((sum,row)=>sum+(effectiveRole({id:"",role:row.role})===role?row._count:0),0)]));
  if(protectedOwner&&protectedOwner.role!=="OWNER") {
    const storedRole=effectiveRole({id:"",role:protectedOwner.role});
    totals[storedRole]-=1;
    totals.OWNER+=1;
  }
  const ordered=[...candidates].sort((a,b)=>ROLE_INFO[effectiveRole(b)].rank-ROLE_INFO[effectiveRole(a)].rank);
  const filterUrl=(role:string,nextPage=1)=>`/admin/users?${new URLSearchParams({...(query?{q:query}:{}),...(role?{role}:{}),...(status?{status}:{}),page:String(nextPage)})}`;
  const pageCount=Math.max(1,Math.ceil(total/pageSize));
  return <>
    <PageHeader title="Користувачі та ролі" description="Знайдіть профіль за нікнеймом, перевірте його стан і змініть роль у разі потреби."/>
    {effectiveRole(currentUser)==="OWNER"?<Link href="/admin/invitations" className="inline-block rounded-lg border border-border px-3 py-2 text-sm">Створити особисте запрошення</Link>:null}
    <details className="rounded-xl border border-border bg-card px-4 py-3"><summary className="cursor-pointer text-sm font-medium">Довідка про ролі</summary><p className="mt-2 text-sm leading-6 text-muted-foreground">Власник керує всіма ролями. Адміністратор може призначати редакторів та учнів. Редактор працює зі спільним навчальним контентом, учень навчається. Підвищити власну роль неможливо.</p></details>
    <Card className="space-y-4 p-4 sm:p-5"><nav className="flex flex-wrap gap-2" aria-label="Вибір ролі для перегляду">{[["","Усі ролі"],...ROLE_ORDER.map(role=>[role,ROLE_INFO[role].label])].map(([role,label])=><Button key={role} asChild variant={selectedRole===role?"default":"outline"} size="sm" className="transition-colors"><Link href={filterUrl(role)} aria-current={selectedRole===role?"page":undefined}>{label}{role?` · ${totals[role]}`:` · ${allUsers}`}</Link></Button>)}</nav>
      <form key={`${query}:${selectedRole}:${status}`} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]" role="search"><input type="hidden" name="role" value={selectedRole}/><label className="grid min-w-0 gap-1.5 text-sm"><span className="font-medium">Пошук за нікнеймом або ім’ям</span><input name="q" defaultValue={query} placeholder="@nickname" maxLength={120}/></label><label className="grid gap-1.5 text-sm"><span className="font-medium">Стан профілю</span><select name="status" defaultValue={status}><option value="">Усі стани</option><option value="ready">Налаштовано</option><option value="setup">Не завершено налаштування</option></select></label><div className="flex items-end gap-2"><Button type="submit">Знайти</Button>{query||selectedRole||status?<Button asChild variant="ghost"><Link href="/admin/users">Скинути</Link></Button>:null}</div></form>
      <p className="text-sm text-muted-foreground">Знайдено {total.toLocaleString("uk-UA")} профілів. Власну роль та роль початкового власника змінити не можна.</p>
    </Card>
    <RoleManager key={`users-p${page}`} users={ordered.map(user=>({...user,createdAt:user.createdAt.toISOString()}))} currentUser={{id:currentUser.id,role:currentUser.role}}/>
    {pageCount>1?<nav aria-label="Сторінки профілів" className="flex items-center justify-between gap-3 text-sm"><span>Сторінка {page} із {pageCount}</span><div className="flex gap-2">{page>1?<Button asChild variant="outline" size="sm"><Link href={filterUrl(selectedRole,page-1)}>Назад</Link></Button>:null}{page<pageCount?<Button asChild variant="outline" size="sm"><Link href={filterUrl(selectedRole,page+1)}>Далі</Link></Button>:null}</div></nav>:null}
  </>;
}
