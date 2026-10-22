"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ShieldCheck } from "lucide-react";
import { updateUserRole } from "@/server/actions";
import { canManageRole, effectiveRole, ROLE_INFO, ROLE_ORDER, type Member, type PlatformRole } from "@/lib/permissions";
import { Badge, Button, Card } from "./ui";

type UserRow = { id: string; firstName: string; nickname: string; role: string; createdAt?: string; onboarded?: boolean };

export function RoleManager({ users, currentUser: providedUser, currentUserId, currentUserRole }: {
  currentUser?: Member; currentUserId?: string; currentUserRole?: string; users: UserRow[];
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const currentUser = providedUser ?? { id: currentUserId ?? "", role: currentUserRole ?? "STUDENT" };
  const [message, setMessage] = useState("");
  const [pendingUser, setPendingUser] = useState("");
  const [selected, setSelected] = useState<Record<string, PlatformRole>>({});
  const [confirmation, setConfirmation] = useState<{ user: UserRow; role: PlatformRole } | null>(null);
  const [ownerPassword, setOwnerPassword] = useState("");
  const [confirmedNickname, setConfirmedNickname] = useState("");
  const requiresOwnerConfirmation = confirmation?.role === "OWNER" || confirmation?.user.role === "OWNER";

  function requestChange(user: UserRow, role: PlatformRole) {
    setMessage("");
    setOwnerPassword("");
    setConfirmedNickname("");
    setConfirmation({ user, role });
  }

  async function save() {
    if (!confirmation) return;
    setPendingUser(confirmation.user.id);
    setMessage("");
    try {
      const details = requiresOwnerConfirmation ? { password: ownerPassword, nickname: confirmedNickname } : {};
      const result = await updateUserRole(confirmation.user.id, confirmation.role, details);
      setMessage(result.ok
        ? `Роль профілю @${confirmation.user.nickname} збережено: ${ROLE_INFO[confirmation.role].label}.`
        : result.error);
      if (result.ok) {
        const savedUserId = confirmation.user.id;
        setConfirmation(null);
        setOwnerPassword("");
        setConfirmedNickname("");
        setSelected((current) => {
          const next = { ...current };
          delete next[savedUserId];
          return next;
        });
        startRefresh(() => {
          router.refresh();
        });
      }
    } catch (error) {
      unstable_rethrow(error);
      setMessage("Не вдалося зберегти роль. Перевірте з’єднання та спробуйте ще раз.");
    } finally {
      setPendingUser("");
    }
  }

  const ownerConfirmNameMatches = confirmedNickname.normalize("NFKC").toLocaleLowerCase("uk-UA")
    === confirmation?.user.nickname.normalize("NFKC").toLocaleLowerCase("uk-UA");

  return (
    <section className="space-y-4" aria-labelledby="profiles-title">
      <div>
        <h2 id="profiles-title" className="text-lg font-semibold">Профілі та їхні ролі</h2>
        <p className="mt-1 text-sm text-muted-foreground">Змініть роль вибраного профілю та підтвердьте дію.</p>
        {message && !confirmation ? <p role="status" className="mt-2 text-sm text-foreground">{message}</p> : null}
      </div>

      {users.length ? (
        <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card lg:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-5 py-3.5 font-medium">Профіль</th>
                <th scope="col" className="px-5 py-3.5 font-medium">Роль</th>
                <th scope="col" className="px-5 py-3.5 font-medium">Стан профілю</th>
                <th scope="col" className="px-5 py-3.5 font-medium">Дата реєстрації</th>
                <th scope="col" className="px-5 py-3.5 font-medium">Дія</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => {
                const role = effectiveRole(user);
                const choices = ROLE_ORDER.filter((next) => canManageRole(currentUser, user, next));
                const value = selected[user.id] ?? role;
                return (
                  <tr key={user.id} className="hover:bg-muted/30">
                    <td className="px-5 py-4">
                      <div className="font-semibold">{user.firstName}{user.id === currentUser.id ? <span className="ml-2 text-xs font-normal text-muted-foreground">Ви</span> : null}</div>
                      <p className="mt-1 text-xs text-muted-foreground">@{user.nickname}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{ROLE_INFO[role].label}</Badge>
                        {choices.length ? <select aria-label={`Нова роль профілю ${user.nickname}`} disabled={Boolean(pendingUser)} value={value} onChange={(event) => setSelected({ ...selected, [user.id]: event.target.value as PlatformRole })}>
                          {choices.map((next) => <option key={next} value={next}>{ROLE_INFO[next].label}</option>)}
                        </select> : null}
                      </div>
                    </td>
                    <td className="px-5 py-4"><Badge className={user.onboarded ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}>{user.onboarded === undefined ? "Невідомо" : user.onboarded ? "Налаштовано" : "Не завершено"}</Badge></td>
                    <td className="px-5 py-4 text-muted-foreground">{user.createdAt ? new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv" }).format(new Date(user.createdAt)) : "—"}</td>
                    <td className="px-5 py-4">
                      {choices.length ? <Button variant="outline" size="sm" disabled={Boolean(pendingUser) || value === role} onClick={() => requestChange(user, value)}>{pendingUser === user.id ? "Збереження…" : "Змінити роль"}</Button> : <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" />Захищений профіль</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {users.length ? (
        <div className="space-y-3 lg:hidden">
          {users.map((user) => {
            const role = effectiveRole(user);
            const choices = ROLE_ORDER.filter((next) => canManageRole(currentUser, user, next));
            const value = selected[user.id] ?? role;
            return (
              <Card key={user.id} className="grid items-center gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="break-words font-semibold">{user.firstName}</h3><Badge>{ROLE_INFO[role].label}</Badge>{user.id === currentUser.id ? <Badge>Ваш профіль</Badge> : null}</div>
                  <p className="mt-1 break-all text-sm text-muted-foreground">@{user.nickname}</p>
                </div>
                {choices.length ? <label className="grid gap-1.5 text-sm"><span className="font-medium">Нова роль</span><select aria-label={`Нова роль профілю ${user.nickname}`} disabled={Boolean(pendingUser)} value={value} onChange={(event) => setSelected({ ...selected, [user.id]: event.target.value as PlatformRole })}>{choices.map((next) => <option key={next} value={next}>{ROLE_INFO[next].label}</option>)}</select></label> : <p className="text-sm text-muted-foreground">{user.id === currentUser.id || user.id === "owner" ? "Захищений профіль" : "Керує лише власник"}</p>}
                {choices.length ? <Button variant="outline" disabled={Boolean(pendingUser) || value === role} onClick={() => requestChange(user, value)}>{pendingUser === user.id ? "Збереження…" : "Змінити роль"}</Button> : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="space-y-2 p-6"><h3 className="font-semibold">Профілів не знайдено</h3><p className="text-sm text-muted-foreground">Змініть фільтри пошуку.</p></Card>
      )}

      <Dialog.Root open={Boolean(confirmation)} onOpenChange={(open) => {
        if (open) return;
        if (pendingUser || refreshing) return;
        setConfirmation(null);
        setOwnerPassword("");
        setConfirmedNickname("");
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl"
            onPointerDownOutside={(event) => { if (pendingUser) event.preventDefault(); }}
            onEscapeKeyDown={(event) => { if (pendingUser) event.preventDefault(); }}
          >
            <Dialog.Title className="text-lg font-semibold">{confirmation?.role === "OWNER" ? "Призначити роль користувачу" : "Підтвердити зміну ролі"}</Dialog.Title>
            <Dialog.Description className="text-sm leading-6 text-muted-foreground">
              Профіль <strong>@{confirmation?.user.nickname}</strong>: {confirmation ? ROLE_INFO[effectiveRole(confirmation.user)].label : ""} → {confirmation ? ROLE_INFO[confirmation.role].label : ""}.
            </Dialog.Description>
            {requiresOwnerConfirmation ? (
              <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="text-sm font-medium">Критична зміна доступу власника. Повторно підтвердьте особу та нікнейм.</p>
                <label className="grid gap-1.5 text-sm"><span>Пароль власника</span><input type="password" autoComplete="current-password" value={ownerPassword} onChange={(event) => setOwnerPassword(event.target.value)} /></label>
                <label className="grid gap-1.5 text-sm"><span>Введіть нікнейм @{confirmation?.user.nickname}</span><input value={confirmedNickname} onChange={(event) => setConfirmedNickname(event.target.value)} autoComplete="off" /></label>
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" disabled={Boolean(pendingUser)} onClick={() => setConfirmation(null)}>Скасувати</Button>
              <Button disabled={Boolean(pendingUser) || (requiresOwnerConfirmation && (!ownerPassword || !ownerConfirmNameMatches))} onClick={() => void save()}>{pendingUser ? "Збереження…" : "Підтвердити зміну"}</Button>
            </div>
            {message ? <p role="alert" className="text-sm text-danger-text">{message}</p> : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
