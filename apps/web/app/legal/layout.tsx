import Link from "next/link";
import type { ReactNode } from "react";

const LEGAL_NAV = [
  { href: "/legal/mentions-legales", label: "Mentions légales" },
  { href: "/legal/cgu",              label: "CGU / CGV" },
  { href: "/legal/confidentialite",  label: "Confidentialité" },
  { href: "/legal/cookies",          label: "Cookies" },
];

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      {/* Header minimal */}
      <header className="border-b border-border bg-bg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-fg)" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-text">AI Reputation Shield</span>
          </Link>
          <Link href="/" className="text-xs text-muted hover:text-text transition-colors">← Retour à l'accueil</Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Navigation légale */}
        <nav className="mb-10 flex flex-wrap gap-2">
          {LEGAL_NAV.map((l) => (
            <Link key={l.href} href={l.href}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent">
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Content */}
        <div className="prose-legal">
          {children}
        </div>
      </div>

      {/* Footer minimal */}
      <footer className="border-t border-border mt-16 py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} AI Reputation Shield — Tous droits réservés
      </footer>
    </div>
  );
}
