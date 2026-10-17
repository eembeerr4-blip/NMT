"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const colors: Record<string, string> = {
  math: "#4f6df5",
  ukrainian: "#c47b2b",
  history: "#b4534a",
  biology: "#2f8f6b",
};

export function RatingChart({ rows }: { rows: Record<string, string | number | null>[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Недостатньо даних для графіка рейтингових балів.</p>;
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis domain={[100, 200]} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {Object.entries(colors).map(([key, color]) => (
            <Line key={key} type="monotone" dataKey={key} name={label(key)} stroke={color} connectNulls={false} dot={{ r: 3 }} />
          ))}
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
          <Tooltip />
          <Bar dataKey="value" name={labelText} fill="#2c3d86" radius={6} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function label(key: string) {
  return { math: "Математика", ukrainian: "Українська мова", history: "Історія України", biology: "Біологія" }[key] ?? key;
}
