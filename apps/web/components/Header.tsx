"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser, clearToken, clearUser, type User } from "@/lib/api";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  /** Simple mode for blog - no profile menu, just navigation */
  simple?: boolean;
}

export function Header({ simple = false }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedUser = getUser();
    setUser(storedUser);

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    clearToken();
    clearUser();
    router.push("/login");
    setMenuOpen(false);
  };

  const handleNavigation = (href: string) => {
    router.push(href);
    setMenuOpen(false);
  };

  // Simple header for blog
  if (simple) {
    return (
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-fg)" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-text">AI Reputation Shield</span>
          </Link>

          <nav className="flex items-center gap-5">
            <Link href="/blog" className="text-sm font-medium text-text hover:text-accent transition-colors">
              Blog
            </Link>
            <Link href="/#how" className="hidden text-sm text-muted hover:text-text transition-colors sm:block">
              Produit
            </Link>
            <Link href="/#pricing" className="hidden text-sm text-muted hover:text-text transition-colors sm:block">
              Tarifs
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <button
                onClick={() => router.push("/dashboard")}
                className="text-sm font-medium text-accent hover:text-accent/80 transition-colors"
              >
                Dashboard →
              </button>
            ) : (
              <>
                <Link href="/login" className="text-sm text-muted hover:text-text transition-colors">
                  Se connecter
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-fg hover:opacity-90 transition-opacity"
                >
                  Essai gratuit
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
    );
  }

  // Full header for dashboard/admin
  if (!user) {
    return (
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-fg)" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-text">AI Reputation Shield</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login" className="text-sm text-muted hover:text-text transition-colors">
              Se connecter
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-fg hover:opacity-90 transition-opacity"
            >
              Essai gratuit
            </Link>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-fg)" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-text">AI Reputation Shield</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-5">
          <button
            onClick={() => handleNavigation("/dashboard")}
            className="text-sm font-medium text-text hover:text-accent transition-colors"
          >
            Dashboard
          </button>
          <button
            onClick={() => handleNavigation("/dashboard/brands")}
            className="text-sm text-muted hover:text-text transition-colors"
          >
            Marques
          </button>
          <button
            onClick={() => handleNavigation("/blog")}
            className="text-sm text-muted hover:text-text transition-colors"
          >
            Blog
          </button>
          {user?.is_admin && (
            <button
              onClick={() => handleNavigation("/admin")}
              className="text-sm text-muted hover:text-text transition-colors"
            >
              Admin
            </button>
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {/* Profile menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 transition-colors hover:border-accent/40"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-fg">
                {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
              </div>
              <span className="text-xs font-medium text-text max-w-[120px] truncate">
                {user.full_name || user.email}
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`text-muted transition-transform ${menuOpen ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card py-2 shadow-lg">
                {/* User info */}
                <div className="border-b border-border px-4 py-2">
                  <p className="text-sm font-medium text-text">{user.full_name || "Utilisateur"}</p>
                  <p className="text-xs text-muted truncate">{user.email}</p>
                </div>

                {/* Navigation links */}
                <div className="py-1">
                  <button
                    onClick={() => handleNavigation("/dashboard")}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-muted hover:text-text hover:bg-bg/50 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                    Dashboard
                  </button>
                  <button
                    onClick={() => handleNavigation("/dashboard/brands")}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-muted hover:text-text hover:bg-bg/50 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    Marques
                  </button>
                  <button
                    onClick={() => handleNavigation("/dashboard/alerts")}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-muted hover:text-text hover:bg-bg/50 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                    Alertes
                  </button>
                  <button
                    onClick={() => handleNavigation("/dashboard/reports")}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-muted hover:text-text hover:bg-bg/50 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    Rapports
                  </button>
                  <button
                    onClick={() => handleNavigation("/blog")}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-muted hover:text-text hover:bg-bg/50 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                    </svg>
                    Blog
                  </button>
                  {user?.is_admin && (
                    <>
                      <button
                        onClick={() => handleNavigation("/admin")}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-muted hover:text-text hover:bg-bg/50 transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2L2 7l10 5 10-5-10-5z" />
                          <path d="M2 17l10 5 10-5" />
                          <path d="M2 12l10 5 10-5" />
                        </svg>
                        Administration
                      </button>
                      <button
                        onClick={() => handleNavigation("/dashboard/content")}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-muted hover:text-text hover:bg-bg/50 transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 19l7-7 3 3-7 7-3-3z" />
                          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                          <path d="M2 2l7.586 7.586" />
                          <circle cx="11" cy="11" r="2" />
                        </svg>
                        Articles
                      </button>
                    </>
                  )}
                </div>

                {/* Settings & Logout */}
                <div className="border-t border-border py-1">
                  <button
                    onClick={() => handleNavigation("/dashboard/settings")}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-muted hover:text-text hover:bg-bg/50 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                    </svg>
                    Réglages
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-warn hover:bg-bg/50 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Déconnexion
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
