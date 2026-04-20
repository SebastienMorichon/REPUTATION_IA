"use client";

import Link from "next/link";

interface Props {
  feature: string;
  message: string;
  planRequired?: string;
}

export function UpgradePrompt({ message, planRequired }: Props) {
  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4"
      style={{
        background: "rgba(201,123,24,0.08)",
        border: "1px solid rgba(201,123,24,0.25)",
        borderRadius: "12px",
        padding: "16px",
      }}
    >
      {/* Lock icon */}
      <span className="flex-shrink-0 text-xl leading-none" aria-hidden="true">
        🔒
      </span>

      {/* Text + CTA */}
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--warn)" }}>
            {message}
          </p>
          {planRequired && (
            <p className="mt-0.5 text-xs" style={{ color: "rgba(201,123,24,0.7)" }}>
              Plan requis : <span className="font-semibold">{planRequired}</span>
            </p>
          )}
        </div>

        <Link
          href="/dashboard/billing"
          className="flex-shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{
            background: "rgba(201,123,24,0.15)",
            color: "var(--warn)",
            border: "1px solid rgba(201,123,24,0.3)",
            whiteSpace: "nowrap",
          }}
        >
          Passer au plan Pro →
        </Link>
      </div>
    </div>
  );
}
