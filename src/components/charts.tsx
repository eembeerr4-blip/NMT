"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SUBJECTS } from "@/lib/constants";

const colors: Record<string, string> = {
  math: "var(--subject-math)",
  ukrainian: "var(--subject-ukrainian)",
  history: "var(--subject-history)",
  biology: "var(--subject-biology)",
};

export function RatingChart({ rows, subjectIds }: { rows: Record<string, string | number | null>[]; subjectIds: string[] }) {
  if (rows.length === 0) return <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">За цей період ще немає повних результатів із рейтинговим балом. Тестові бали не перетворюються на рейтингові автоматично.</p>;
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={formatDate} />
          <YAxis domain={[100, 200]} ticks={[100, 125, 150, 175, 200]} tick={{ fontSize: 12 }} />
          <Tooltip contentStyle={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,color:"var(--foreground)"}}/>
          <Legend />
          {subjectIds.map((key) => {
            const subject = SUBJECTS.find((item) => item.id === key);
            return <Line key={key} type="monotone" dataKey={key} name={subject?.name ?? key} stroke={colors[key] ?? "var(--subject-other)"} connectNulls={false} dot={{ r: 3 }} activeDot={{ r: 5 }} />;
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Bars({ rows, labelText }: { rows: { name: string; value: number }[]; labelText: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Недостатньо даних.</p>;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip contentStyle={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,color:"var(--foreground)"}}/>
          <Bar dataKey="value" name={labelText} fill="var(--primary)" radius={6} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit" }).format(new Date(year, month - 1, day));
}
