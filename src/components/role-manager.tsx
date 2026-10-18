"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ShieldCheck } from "lucide-react";
import { updateUserRole } from "@/server/actions";
import { canManageRole, effectiveRole, ROLE_INFO, ROLE_ORDER, type Member, type PlatformRole } from "@/lib/permissions";
import { Badge, Button, Card } from "./ui";

type UserRow = { id: string; firstName: string; nickname: string; role: string; createdAt?: string; onboarded?: boolean };
export function RoleManager({ users, currentUser: providedUser, currentUserId, currentUserRole }: { currentUser?: Member; currentUserId?: string; currentUserRole?: string; users: UserRow[] }) {
  const currentUser=providedUser??{id:currentUserId??"",role:currentUserRole??"STUDENT"};
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pendingUser, setPendingUser] = useState("");
  const [selected, setSelected] = useState<Record<string, PlatformRole>>({});
  const [confirmation, setConfirmation] = useState<{ user: UserRow; role: PlatformRole } | null>(null);

  async function save(user: UserRow, role: PlatformRole) {
    setPendingUser(user.id); setMessage("");
    try {
      const result = await updateUserRole(user.id, role);
      setMessage(result.ok ? `Роль профілю @${user.nickname} збережено: ${ROLE_INFO[role].label}.` : result.error);
      if(result.ok) { setConfirmation(null); router.refresh(); }
    } catch { setMessage("Не вдалося зберегти роль. Перевірте з’єднання та спробуйте ще раз."); }
    finally { setPendingUser(""); }
  }

  return <section className="space-y-4" aria-labelledby="profiles-title">
    <div><h2 id="profiles-title" className="text-lg font-semibold">Профілі та їхні ролі</h2><p className="mt-1 text-sm text-muted-foreground">Оберіть роль біля потрібного профілю та натисніть «Зберегти роль».</p></div>
    {users.length?<div className="hidden overflow-x-auto rounded-2xl border border-border bg-card lg:block"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground"><tr><th scope="col" className="px-5 py-3.5 font-medium">Профіль</th><th scope="col" className="px-5 py-3.5 font-medium">Роль</th><th scope="col" className="px-5 py-3.5 font-medium">Стан профілю</th><th scope="col" className="px-5 py-3.5 font-medium">Дата реєстрації</th><th scope="col" className="px-5 py-3.5 font-medium">Дія</th></tr></thead><tbody className="divide-y divide-border">{users.map(user=>{const role=effectiveRole(user);const choices=ROLE_ORDER.filter(next=>canManageRole(currentUser,user,next));const value=selected[user.id]??role;return <tr key={user.id} className="hover:bg-muted/30"><td className="px-5 py-4"><div className="font-semibold">{user.firstName}{user.id===currentUser.id?<span className="ml-2 text-xs font-normal text-muted-foreground">Ви</span>:null}</div><p className="mt-1 text-xs text-muted-foreground">@{user.nickname}</p></td><td className="px-5 py-4">{choices.length?<select aria-label={`Роль профілю ${user.nickname}`} disabled={Boolean(pendingUser)} value={value} onChange={event=>setSelected({...selected,[user.id]:event.target.value as PlatformRole})}>{choices.map(next=><option key={next} value={next}>{ROLE_INFO[next].label}</option>)}</select>:<Badge>{ROLE_INFO[role].label}</Badge>}</td><td className="px-5 py-4 text-muted-foreground">{user.onboarded===undefined?"—":user.onboarded?"Налаштовано":"Потрібне налаштування"}</td><td className="px-5 py-4 text-muted-foreground">{user.createdAt?new Intl.DateTimeFormat("uk-UA",{timeZone:"Europe/Kyiv"}).format(new Date(user.createdAt)):"—"}</td><td className="px-5 py-4">{choices.length?<Button variant="outline" size="sm" disabled={Boolean(pendingUser)||value===role} onClick={()=>value==="OWNER"||role==="OWNER"?setConfirmation({user,role:value}):void save(user,value)}>{pendingUser===user.id?"Збереження…":"Зберегти роль"}</Button>:<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4"/>Захищений профіль</span>}</td></tr>;})}</tbody></table></div>:null}

    {users.length ? <div className="space-y-3 lg:hidden">{users.map(user=>{
      const role=effectiveRole(user);
      const choices=ROLE_ORDER.filter(next=>canManageRole(currentUser,user,next));
      const value=selected[user.id] ?? role;
      const protectedProfile=user.id===currentUser.id||user.id==="owner";
      return <Card key={user.id} className="grid items-center gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(180px,240px)_auto] sm:p-5">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words font-semibold">{user.firstName}</h3><Badge>{ROLE_INFO[role].label}</Badge>{user.id===currentUser.id?<Badge>Ваш профіль</Badge>:null}</div><p className="mt-1 break-all text-sm text-muted-foreground">@{user.nickname}</p></div>
        {choices.length ? <label className="grid gap-1.5 text-sm"><span className="font-medium">Роль профілю</span><select aria-label={`Роль профілю ${user.nickname}`} disabled={Boolean(pendingUser)} value={value} onChange={e=>setSelected({...selected,[user.id]:e.target.value as PlatformRole})}>{choices.map(next=><option key={next} value={next}>{ROLE_INFO[next].label}</option>)}</select></label> : <p className="text-sm text-muted-foreground">{protectedProfile ? "Захищений профіль" : "Керує лише власник"}</p>}
        {choices.length ? <Button variant="outline" disabled={Boolean(pendingUser)||value===role} onClick={()=>value==="OWNER"||role==="OWNER" ? setConfirmation({user,role:value}) : void save(user,value)}>{pendingUser===user.id?"Збереження…":"Зберегти роль"}</Button> : <ShieldCheck className="hidden h-5 w-5 justify-self-end text-muted-foreground sm:block" aria-label="Роль захищено"/>}
      </Card>;
    })}</div> : <Card className="space-y-2 p-6"><h3 className="font-semibold">Профілів не знайдено</h3><p className="text-sm text-muted-foreground">Оберіть іншу роль або змініть пошуковий запит.</p></Card>}
    {message?<p role="status" className="rounded-xl border border-border bg-muted p-3 text-sm">{message}</p>:null}
    <Dialog.Root open={Boolean(confirmation)} onOpenChange={open=>{if(!open&&!pendingUser)setConfirmation(null);}}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"/><Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl">
      <Dialog.Title className="text-lg font-semibold">Підтвердження зміни доступу</Dialog.Title><Dialog.Description className="text-sm leading-6 text-muted-foreground">{confirmation?.role==="OWNER" ? `Профіль @${confirmation.user.nickname} отримає повний доступ власника, включно з призначенням інших власників.` : `Профіль @${confirmation?.user.nickname} втратить права власника та отримає роль «${confirmation ? ROLE_INFO[confirmation.role].label : ""}».`}</Dialog.Description>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" disabled={Boolean(pendingUser)} onClick={()=>setConfirmation(null)}>Скасувати</Button><Button disabled={Boolean(pendingUser)} onClick={()=>{if(confirmation)void save(confirmation.user,confirmation.role);}}>{pendingUser?"Збереження…":"Підтвердити зміну"}</Button></div>{message?<p role="status" className="text-sm">{message}</p>:null}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </section>;
}
