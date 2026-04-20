"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Snapshot {
  period_end: string;
  visibility_score: number;
  share_of_voice: number;
  sentiment_score: number;
  citation_score: number;
}

interface TrendChartProps {
  snapshots: Snapshot[];
}

const LINES: { key: keyof Omit<Snapshot, "period_end">; label: string; color: string }[] = [
  { key: "visibility_score",  label: "Visibilité",    color: "var(--accent)" },
  { key: "share_of_voice",    label: "Part de voix",  color: "#6366F1" },
  { key: "sentiment_score",   label: "Image",         color: "#10A37F" },
  { key: "citation_score",    label: "Sources",       color: "#F59E0B" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export function TrendChart({ snapshots }: TrendChartProps) {
  if (snapshots.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-center text-sm text-muted px-4">
        Les données historiques s&apos;accumuleront à chaque analyse planifiée
      </div>
    );
  }

  const data = snapshots.map((s) => ({
    date: formatDate(s.period_end),
    visibility_score: Math.round(s.visibility_score * 10) / 10,
    share_of_voice: Math.round(s.share_of_voice * 10) / 10,
    sentiment_score: Math.round(s.sentiment_score * 10) / 10,
    citation_score: Math.round(s.citation_score * 10) / 10,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
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
            formatter={(value: number, name: string) => {
              const line = LINES.find((l) => l.key === name);
              return [`${value.toFixed(1)}%`, line?.label ?? name];
            }}
          />
          {LINES.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              stroke={l.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: l.color }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        {LINES.map((l) => (
          <div key={l.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-5 rounded-full"
              style={{ background: l.color }}
            />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}
