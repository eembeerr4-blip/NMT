"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { moderateUserAccount } from "@/server/actions";
import { Button, Card } from "./ui";

type PendingUser = { id: string; nickname: string; firstName: string; email: string | null; createdAt: string };

export function AccountModerationPanel({ users }: { users: PendingUser[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pendingId, setPendingId] = useState("");

  async function decide(userId: string, status: "APPROVED" | "REJECTED") {
    setPendingId(userId);
    setMessage("");
    const result = await moderateUserAccount(userId, status);
    setMessage(result.ok ? result.message ?? "Зміни збережено." : result.error);
    setPendingId("");
    if (result.ok) router.refresh();
  }

  return (
    <section className="space-y-4">
      {users.length ? users.map((user) => (
        <Card key={user.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">{user.firstName}</h2>
            <p className="text-sm text-muted-foreground">@{user.nickname}{user.email ? ` · ${user.email}` : ""}</p>
            <p className="text-xs text-muted-foreground">Подано: {new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "medium", timeStyle: "short" }).format(new Date(user.createdAt))}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={Boolean(pendingId)} onClick={() => void decide(user.id, "APPROVED")}>{pendingId === user.id ? "Збереження…" : "Схвалити"}</Button>
            <Button size="sm" variant="outline" disabled={Boolean(pendingId)} onClick={() => void decide(user.id, "REJECTED")}>Відхилити</Button>
          </div>
        </Card>
      )) : <Card className="p-6"><p className="text-sm text-muted-foreground">Нових заявок на реєстрацію немає.</p></Card>}
      {message ? <p role="status" className="text-sm">{message}</p> : null}
    </section>
  );
}
