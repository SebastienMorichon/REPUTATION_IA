"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, clearToken } from "@/lib/api";

const NAV = [
  { href: "/admin",           label: "📊 Vue globale",  exact: true },
  { href: "/admin/customers", label: "👥 Clients" },
  { href: "/admin/usage",     label: "📈 Usage" },
  { href: "/admin/settings",  label: "⚙️ Paramètres" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [checking, setChecking] = useState(true);
  const [denied,   setDenied]   = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    apiFetch<{ total_organizations: number }>("/admin/stats")
      .then(() => { setChecking(false); })
      .catch((e) => {
        if (e?.status === 401) { router.push("/login"); return; }
        setDenied(true);
        setChecking(false);
      });
    // Also grab current user info from token storage
    try {
      const raw = localStorage.getItem("reputation.user");
      if (raw) setUserEmail(JSON.parse(raw).email ?? "");
    } catch { /* ignore */ }
  }, [router]);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <span className="text-sm text-muted">Vérification des droits…</span>
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg">
        <div className="text-4xl">🔒</div>
        <p className="text-lg font-semibold text-text">Accès refusé</p>
        <p className="text-sm text-muted">Cette zone est réservée aux administrateurs.</p>
        <Link href="/dashboard" className="text-sm text-accent underline">← Retour au dashboard</Link>
      </div>
    );
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex h-screen w-[220px] flex-shrink-0 flex-col" style={{ backgroundColor: "#0F0F0E" }}>
        {/* Header */}
        <div className="px-5 py-5">
          <Link href="/dashboard" className="mb-4 flex items-center gap-1.5 text-[11px] transition-colors hover:opacity-70" style={{ color: "rgba(228,226,220,0.4)" }}>
            ← Dashboard
          </Link>
          <div className="flex items-center gap-2.5 mt-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--accent)" }}>
              <span className="text-xs font-bold" style={{ color: "#1C1C1A" }}>A</span>
            </div>
            <span className="text-sm font-semibold" style={{ color: "#E4E2DC" }}>Admin</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="sidebar-link"
              style={isActive(l.href, l.exact) ? { background: "rgba(197,242,54,0.12)", color: "var(--accent)" } : {}}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <span className="max-w-[120px] truncate text-[10px]" style={{ color: "rgba(228,226,220,0.4)" }}>{userEmail}</span>
          <button
            onClick={() => { clearToken(); router.push("/login"); }}
            className="text-[11px] transition-colors hover:text-white"
            style={{ color: "rgba(228,226,220,0.4)" }}
          >
            Sortir
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-bg px-8 py-8">{children}</main>
    </div>
  );
}
