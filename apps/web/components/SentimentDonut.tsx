"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  positive: number;
  neutral: number;
  negative: number;
}

const COLORS = {
  positive: "var(--good)",
  neutral: "var(--muted)",
  negative: "var(--bad)",
};

export function SentimentDonut({ positive, neutral, negative }: Props) {
  const total = positive + neutral + negative;
  if (total === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted">
        Pas encore de données.
      </div>
    );
  }

  const data = [
    { name: "Positif", value: positive, color: COLORS.positive },
    { name: "Neutre", value: neutral, color: COLORS.neutral },
    { name: "Négatif", value: negative, color: COLORS.negative },
  ].filter((d) => d.value > 0);

  const pctPositive = Math.round((positive / total) * 100);

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-36 w-36 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={46}
              outerRadius={62}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                fontSize: "12px",
                color: "var(--text)",
              }}
              formatter={(v: number) => [v, ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Centre label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-xl text-text">{pctPositive}%</span>
          <span className="text-[10px] uppercase tracking-wider text-muted">Positif</span>
        </div>
      </div>

      <div className="space-y-2">
        {[
          { label: "Positif", value: positive, color: COLORS.positive },
          { label: "Neutre", value: neutral, color: COLORS.neutral },
          { label: "Négatif", value: negative, color: COLORS.negative },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: item.color }} />
            <span className="text-muted">{item.label}</span>
            <span className="ml-auto font-semibold text-text">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
