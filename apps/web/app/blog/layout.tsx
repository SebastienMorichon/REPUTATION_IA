import type { ReactNode } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* ── Header ───────────────────────────────────────────── */}
      <Header simple />

      {/* ── Content ──────────────────────────────────────────── */}
      <div className="flex-1">{children}</div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card">
        {/* CTA */}
        <div className="border-b border-border py-12 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
            AI Reputation Shield
          </p>
          <h2 className="text-2xl font-bold text-text">
            Votre marque est-elle bien vue par les IA ?
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
            Mesurez votre visibilité dans ChatGPT, Claude et Perplexity en moins de 2 minutes.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg hover:opacity-90 transition-opacity"
          >
            Commencer gratuitement →
          </Link>
        </div>

        {/* Links */}
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-6 text-xs text-muted sm:flex-row">
          <span className="font-medium text-text">AI Reputation Shield</span>
          <nav className="flex gap-5">
            <Link href="/blog" className="hover:text-text transition-colors">Blog</Link>
            <Link href="/signup" className="hover:text-text transition-colors">Créer un compte</Link>
            <Link href="/login" className="hover:text-text transition-colors">Se connecter</Link>
          </nav>
          <p>&copy; {new Date().getFullYear()} AI Reputation Shield</p>
        </div>
      </footer>
    </div>
  );
}
