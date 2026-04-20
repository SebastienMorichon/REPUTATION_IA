"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";

interface RadarEntry {
  name: string;
  is_target: boolean;
  visibility: number;
  share_of_mentions: number;
}

interface CompetitorRadarProps {
  entries: RadarEntry[];
  brandName: string;
}

export function CompetitorRadar({ entries, brandName }: CompetitorRadarProps) {
  if (entries.length <= 1) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted">
        Ajoutez des concurrents pour voir la comparaison
      </div>
    );
  }

  const data = entries.map((e) => ({
    name: e.name,
    is_target: e.is_target,
    Visibilité: Math.round(e.visibility * 10) / 10,
    "Part de voix": Math.round(e.share_of_mentions * 10) / 10,
  }));

  const chartHeight = Math.max(160, entries.length * 64);

  return (
    <div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
          barCategoryGap="28%"
          barGap={4}
        >
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 3"
            horizontal={false}
          />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: "var(--text)" }}
            axisLine={false}
            tickLine={false}
            width={110}
            tickFormatter={(v: string) =>
              v === brandName ? `${v} ★` : v
            }
          />
          <Tooltip
            cursor={{ fill: "var(--border)", opacity: 0.4 }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              fontSize: "12px",
              color: "var(--text)",
            }}
            formatter={(value: number, name: string) => [
              `${value.toFixed(1)}%`,
              name,
            ]}
          />
          <Bar dataKey="Visibilité" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.is_target ? "var(--accent)" : "var(--muted)"}
                opacity={entry.is_target ? 1 : 0.55}
              />
            ))}
            <LabelList
              dataKey="Visibilité"
              position="right"
              formatter={(v: number) => `${v}%`}
              style={{ fontSize: 10, fill: "var(--muted)" }}
            />
          </Bar>
          <Bar dataKey="Part de voix" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.is_target ? "var(--accent)" : "var(--muted)"}
                opacity={entry.is_target ? 0.55 : 0.3}
              />
            ))}
            <LabelList
              dataKey="Part de voix"
              position="right"
              formatter={(v: number) => `${v}%`}
              style={{ fontSize: 10, fill: "var(--muted)" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-5 text-xs text-muted">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-5 rounded-sm"
            style={{ background: "var(--accent)" }}
          />
          Visibilité
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-5 rounded-sm"
            style={{ background: "var(--accent)", opacity: 0.55 }}
          />
          Part de voix
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-5 rounded-sm"
            style={{ background: "var(--muted)", opacity: 0.55 }}
          />
          Concurrents
        </div>
      </div>
    </div>
  );
}
