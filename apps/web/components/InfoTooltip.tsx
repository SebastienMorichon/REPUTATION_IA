"use client";

import { useEffect, useRef, useState } from "react";

interface InfoTooltipProps {
  title: string;
  /** Short explanation of what this metric measures */
  what: string;
  /** How to read the number / what's a good vs bad score */
  how: string;
  /** Optional action tips */
  tips?: string;
}

export function InfoTooltip({ title, what, how, tips }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`En savoir plus sur ${title}`}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[9px] font-bold leading-none opacity-40 transition-opacity hover:opacity-80"
        style={{ color: "var(--muted)" }}
      >
        i
      </button>

      {open && (
        <div
          className="absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-2xl border border-border p-4 shadow-xl"
          style={{ background: "var(--card)" }}
        >
          {/* Arrow */}
          <div
            className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-border"
            style={{ background: "var(--card)" }}
          />

          <div className="space-y-3 text-left">
            <div className="font-semibold text-text">{title}</div>

            <div>
              <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                Ce que c&apos;est
              </div>
              <p className="text-sm text-muted leading-relaxed">{what}</p>
            </div>

            <div>
              <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                Comment l&apos;interpréter
              </div>
              <p className="text-sm text-muted leading-relaxed">{how}</p>
            </div>

            {tips && (
              <div>
                <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Conseil
                </div>
                <p className="text-sm text-muted leading-relaxed">{tips}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
