"use client";

import Link from "next/link";

interface Props {
  daysRemaining: number;
}

export function TrialBanner({ daysRemaining }: Props) {
  const isUrgent = daysRemaining <= 3;
  const isLastDay = daysRemaining === 0;

  let message: React.ReactNode;
  if (isLastDay) {
    message = (
      <span style={{ color: "var(--bad)" }}>
        Votre essai se termine aujourd&apos;hui. Choisissez un plan pour conserver votre accès.
      </span>
    );
  } else if (isUrgent) {
    message = (
      <span style={{ color: "var(--warn)" }}>
        Essai Pro — il vous reste{" "}
        <strong>{daysRemaining} jour{daysRemaining > 1 ? "s" : ""}</strong>. Ne perdez pas vos données !
      </span>
    );
  } else {
    message = (
      <span style={{ color: "var(--accent)" }}>
        🎉 Essai Pro — il vous reste{" "}
        <strong>{daysRemaining} jour{daysRemaining > 1 ? "s" : ""}</strong>. Profitez de toutes les fonctionnalités gratuitement.
      </span>
    );
  }

  const bgColor = isLastDay || isUrgent ? "var(--bad)" : "var(--accent)";
  const bgSubtle = isLastDay
    ? "rgba(220,38,38,0.08)"
    : isUrgent
    ? "rgba(180,83,9,0.08)"
    : "var(--sidebar-chip)";

  return (
    <div
      className="flex flex-shrink-0 items-center justify-between px-6"
      style={{
        backgroundColor: "var(--card)",
        borderBottom: `1px solid var(--border)`,
        height: "40px",
        minHeight: "40px",
      }}
    >
      <span className="text-[13px] font-medium">{message}</span>
      <Link
        href="/dashboard/billing"
        className="flex-shrink-0 rounded-lg px-3 py-1 text-[12px] font-semibold transition-opacity hover:opacity-80"
        style={{
          backgroundColor: bgSubtle,
          color: isLastDay
            ? "var(--bad)"
            : isUrgent
            ? "var(--warn)"
            : "var(--accent)",
          border: `1px solid var(--border)`,
        }}
      >
        Choisir un plan →
      </Link>
    </div>
  );
}
