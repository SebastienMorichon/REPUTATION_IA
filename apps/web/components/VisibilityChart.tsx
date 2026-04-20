"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

interface DataPoint { date: string; visibility: number }

interface Props { data: DataPoint[] }

export function VisibilityChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted">
        Pas encore de données de tendance.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "var(--muted)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => v.slice(5)} /* MM-DD */
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "var(--muted)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            fontSize: "12px",
            color: "var(--text)",
          }}
          formatter={(v: number) => [`${v.toFixed(1)}%`, "Visibilité"]}
        />
        <Line
          type="monotone"
          dataKey="visibility"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "var(--accent)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
