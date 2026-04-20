"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

const ACCENT_COLORS = [
  { id: "indigo", name: "Indigo", light: "#4F46E5", dark: "#818CF8" },
  { id: "blue", name: "Bleu", light: "#0284C7", dark: "#38BDF8" },
  { id: "violet", name: "Violet", light: "#7C3AED", dark: "#A78BFA" },
  { id: "emerald", name: "Émeraude", light: "#059669", dark: "#34D399" },
  { id: "amber", name: "Ambre", light: "#D97706", dark: "#FBBF24" },
  { id: "pink", name: "Rose", light: "#DB2777", dark: "#F472B6" },
];

export default function SettingsPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [accent, setAccent] = useState<string>("indigo");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const storedTheme = (localStorage.getItem("theme") as "light" | "dark") || "light";
    const storedAccent = localStorage.getItem("accentColor") || "indigo";
    setTheme(storedTheme);
    setAccent(storedAccent);
    setMounted(true);

    // Apply accent color on mount
    if (storedAccent !== "indigo") {
      document.documentElement.setAttribute("data-accent", storedAccent);
    }
  }, []);

  function handleThemeChange(newTheme: "light" | "dark") {
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  }

  function handleAccentChange(newAccent: string) {
    setAccent(newAccent);
    if (newAccent === "indigo") {
      document.documentElement.removeAttribute("data-accent");
    } else {
      document.documentElement.setAttribute("data-accent", newAccent);
    }
    localStorage.setItem("accentColor", newAccent);
  }

  function resetToDefaults() {
    setTheme("light");
    setAccent("indigo");
    document.documentElement.removeAttribute("data-accent");
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.removeItem("accentColor");
    localStorage.setItem("theme", "light");
  }

  if (!mounted) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="num text-3xl text-text">Paramètres</h1>
        <p className="mt-1 text-sm text-muted">
          Personnalisez l&apos;apparence de votre interface.
        </p>
      </div>

      {/* Thème */}
      <section className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-text">Thème</h2>
          <p className="mt-0.5 text-xs text-muted">
            Choisissez entre le mode clair et le mode sombre.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg cursor-pointer transition-opacity hover:opacity-80"
              style={{
                backgroundColor: theme === "light" ? "var(--accent)" : "var(--sidebar-chip)",
                border: `1px solid var(--border)`,
              }}
              onClick={() => handleThemeChange("light")}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke={theme === "light" ? "var(--accent-fg)" : "var(--text)"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-text">Mode clair</p>
              <p className="text-xs text-muted">Fond clair, texte sombre</p>
            </div>
          </div>
          {theme === "light" && (
            <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>Actif</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg cursor-pointer transition-opacity hover:opacity-80"
              style={{
                backgroundColor: theme === "dark" ? "var(--accent)" : "var(--sidebar-chip)",
                border: `1px solid var(--border)`,
              }}
              onClick={() => handleThemeChange("dark")}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke={theme === "dark" ? "var(--accent-fg)" : "var(--text)"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-text">Mode sombre</p>
              <p className="text-xs text-muted">Fond sombre, texte clair</p>
            </div>
          </div>
          {theme === "dark" && (
            <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>Actif</span>
          )}
        </div>
      </section>

      {/* Couleur d'accent */}
      <section className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-text">Couleur d&apos;accent</h2>
          <p className="mt-0.5 text-xs text-muted">
            Personnalisez la couleur principale de l&apos;interface.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.id}
              onClick={() => handleAccentChange(color.id)}
              className={`relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all ${
                accent === color.id ? "ring-2 ring-offset-2" : "hover:opacity-80"
              }`}
              style={{
                borderColor: accent === color.id ? "var(--accent)" : "var(--border)",
                backgroundColor:
                  accent === color.id ? "var(--sidebar-chip)" : "transparent",
              }}
            >
              <div
                className="h-8 w-8 rounded-full shadow-sm"
                style={{
                  backgroundColor: theme === "dark" ? color.dark : color.light,
                }}
              />
              <span className="text-xs font-medium text-text">{color.name}</span>
              {accent === color.id && (
                <div
                  className="absolute right-2 top-2"
                  style={{ color: "var(--accent)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="mt-4 rounded-xl border border-border bg-sidebar p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-muted">
            Aperçu
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-primary rounded-lg px-4 py-2 text-sm"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
            >
              Bouton principal
            </button>
            <button
              className="btn-ghost rounded-lg border border-border px-4 py-2 text-sm"
              style={{ color: "var(--text)" }}
            >
              Bouton secondaire
            </button>
            <span
              className="rounded-md px-2 py-1 text-xs font-semibold"
              style={{
                backgroundColor: "var(--accent)/10",
                color: "var(--accent)",
              }}
            >
              Badge
            </span>
          </div>
        </div>
      </section>

      {/* Réinitialiser */}
      <section className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-text">Réinitialiser</h2>
          <p className="mt-0.5 text-xs text-muted">
            Restaurer les paramètres par défaut.
          </p>
        </div>
        <button onClick={resetToDefaults} className="btn-ghost text-sm">
          Restaurer les paramètres d&apos;origine
        </button>
      </section>
    </div>
  );
}
