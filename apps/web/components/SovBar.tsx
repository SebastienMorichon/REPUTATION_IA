"use client";

interface Entry { name: string; pct: number; isTarget?: boolean }

export function SovBar({ entries }: { entries: Entry[] }) {
  if (!entries.length) return <p className="text-sm text-muted">Pas encore de données.</p>;

  return (
    <ul className="space-y-3">
      {entries.map((e) => (
        <li key={e.name}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
                style={{
                  background: e.isTarget ? "var(--accent)" : "var(--border)",
                  color: e.isTarget ? "var(--accent-fg)" : "var(--muted)",
                }}
              >
                {e.name.slice(0, 2).toUpperCase()}
              </div>
              <span className={e.isTarget ? "font-semibold text-text" : "text-muted"}>
                {e.name}
                {e.isTarget && <span className="ml-1.5 text-xs text-muted font-normal">· vous</span>}
              </span>
            </div>
            <span className="text-xs text-muted">{e.pct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${e.pct}%`,
                background: e.isTarget ? "var(--accent)" : "var(--muted)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
