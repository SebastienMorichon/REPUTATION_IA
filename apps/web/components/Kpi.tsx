import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KpiProps {
  label: string;
  value: string | number;
  sub?: string;          // e.g. "+4.2% vs 30j"
  subUp?: boolean;       // true = green arrow, false = red, undefined = neutral
  featured?: boolean;    // large dark card
  className?: string;
  tooltip?: ReactNode;   // optional InfoTooltip element
}

export function Kpi({ label, value, sub, subUp, featured, className, tooltip }: KpiProps) {
  if (featured) {
    return (
      <div className={cn("card-feat flex flex-col justify-between min-h-[160px]", className)}>
        <div className="flex items-center gap-1.5">
          <span className="label" style={{ color: "var(--muted)" }}>
            {label}
          </span>
          {tooltip && <span style={{ color: "var(--muted)" }}>{tooltip}</span>}
        </div>
        <div>
          <div className="num text-5xl" style={{ color: "var(--feat-text)" }}>
            {value}
          </div>
          {sub && (
            <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: "var(--good)" }}>
              <span>↗</span>
              <span>{sub}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("card flex flex-col justify-between min-h-[120px]", className)}>
      <div className="flex items-center gap-1.5">
        <span className="label">{label}</span>
        {tooltip}
      </div>
      <div>
        <div className="num text-4xl text-text">{value}</div>
        {sub && (
          <div
            className={cn(
              "mt-1.5 flex items-center gap-1 text-xs",
              subUp === true ? "text-good" : subUp === false ? "text-bad" : "text-muted"
            )}
          >
            {subUp === true ? "↗" : subUp === false ? "↘" : "·"} {sub}
          </div>
        )}
      </div>
    </div>
  );
}
