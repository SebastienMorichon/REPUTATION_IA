"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, clearUser, getUser, apiFetch, type BillingSubscription } from "@/lib/api";
import { ThemeToggle } from "./ThemeToggle";
import type { Brand } from "@/lib/api";

function buildGroups(isAdmin: boolean) {
  const groups = [
    {
      label: "Monitoring",
      links: [
        { href: "/dashboard", label: "Dashboard", exact: true },
        { href: "/dashboard/brands", label: "Marques" },
      ],
    },
    {
      label: "Insights",
      links: [
        { href: "/dashboard/alerts", label: "Alertes" },
        { href: "/dashboard/reports", label: "Rapports" },
      ],
    },
    {
      label: "Ressources",
      links: [
        { href: "/blog", label: "📖 Blog" },
      ],
    },
    ...(isAdmin
      ? [
          {
            label: "Contenu",
            links: [{ href: "/dashboard/content", label: "✍️ Articles" }],
          },
          {
            label: "Administration",
            links: [
              { href: "/admin", label: "📊 Vue globale", exact: true },
              { href: "/admin/customers", label: "👥 Clients" },
              { href: "/admin/usage", label: "📈 Usage" },
              { href: "/admin/plans", label: "💎 Offres & Tarifs" },
              { href: "/admin/settings", label: "⚙️ Providers" },
              { href: "/admin/prompt-framework", label: "🎯 Prompt Framework" },
            ],
          },
        ]
      : []),
    {
      label: "Compte",
      links: [
        { href: "/dashboard/billing", label: "💳 Abonnement" },
        { href: "/dashboard/settings", label: "⚙️ Paramètres" },
      ],
    },
  ];
  return groups;
}

interface Props {
  activeBrand?: Brand | null;
}

export function Sidebar({ activeBrand }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Read admin status from localStorage (set at login/signup via /auth/me)
    const user = getUser();
    setIsAdmin(user?.is_admin ?? false);

    apiFetch<BillingSubscription>("/billing/subscription")
      .then(setSubscription)
      .catch(() => {}); // silent fail
  }, []);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside
      className="flex h-screen w-[220px] flex-shrink-0 flex-col"
      style={{ backgroundColor: "var(--sidebar)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-fg)" strokeWidth="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="text-sm font-semibold" style={{ color: "var(--sidebar-fg)" }}>
          AI Reputation
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {buildGroups(isAdmin).map((group) => (
          <div key={group.label} className="mb-5">
            <p
              className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.12em]"
              style={{ color: "var(--sidebar-muted)" }}
            >
              {group.label}
            </p>
            {group.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`sidebar-link ${isActive(l.href, l.exact) ? "active" : ""}`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Active brand chip */}
      {activeBrand && (
        <div className="mx-3 mb-3 rounded-xl p-3" style={{ background: "var(--sidebar-chip)" }}>
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
            >
              {activeBrand.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium" style={{ color: "var(--sidebar-fg)" }}>
                {activeBrand.name}
              </div>
              <div className="truncate text-[11px]" style={{ color: "var(--sidebar-muted)" }}>
                {activeBrand.domain || "—"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan badge */}
      {subscription && (
        <div className="mx-3 mb-2">
          <Link
            href="/dashboard/billing"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-opacity hover:opacity-80"
            style={{
              background: "var(--sidebar-chip)",
              border: "1px solid var(--sidebar-border)",
              display: "inline-flex",
            }}
          >
            <span
              className="text-[10px] font-semibold"
              style={{ color: "var(--accent)" }}
            >
              {subscription.is_trial && subscription.trial_days_remaining !== null
                ? `${subscription.effective_plan_label} • ${subscription.trial_days_remaining}j`
                : subscription.effective_plan_label ?? subscription.plan_label}
            </span>
          </Link>
        </div>
      )}

      {/* Footer */}
      <div
        className="flex items-center justify-between border-t px-4 py-3"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <ThemeToggle />
        <button
          onClick={() => { clearToken(); clearUser(); router.push("/login"); }}
          className="text-[11px] transition-colors hover:text-white"
          style={{ color: "var(--sidebar-muted)" }}
        >
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
