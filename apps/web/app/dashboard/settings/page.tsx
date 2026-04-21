"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { apiFetch, getUser, type User } from "@/lib/api";

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

  // Profile state
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Billing state
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

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

    // Load user profile
    const storedUser = getUser();
    if (storedUser) {
      setUser(storedUser);
      setFullName(storedUser.full_name || "");
      setEmail(storedUser.email);
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

  async function handleSaveProfile() {
    setIsSaving(true);
    setMessage(null);
    try {
      const updated = await apiFetch<User>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ full_name: fullName, email }),
      });
      setUser(updated);
      setMessage({ type: "success", text: "Profil mis à jour avec succès" });
    } catch (err) {
      setMessage({ type: "error", text: "Erreur lors de la mise à jour du profil" });
    }
    setIsSaving(false);
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Les mots de passe ne correspondent pas" });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "Le mot de passe doit contenir au moins 8 caractères" });
      return;
    }

    setIsChangingPassword(true);
    setMessage(null);
    try {
      await apiFetch("/auth/password/change", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      setMessage({ type: "success", text: "Mot de passe changé avec succès" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setMessage({ type: "error", text: "Erreur lors du changement de mot de passe" });
    }
    setIsChangingPassword(false);
  }

  async function handleOpenBillingPortal() {
    setIsOpeningPortal(true);
    try {
      const res = await apiFetch<{ portal_url: string }>("/billing/portal", {
        method: "POST",
      });
      setPortalUrl(res.portal_url);
      window.open(res.portal_url, "_blank");
    } catch (err) {
      setMessage({ type: "error", text: "Erreur lors de l'ouverture du portail de facturation" });
    }
    setIsOpeningPortal(false);
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
          Gérez votre profil, votre mot de passe et vos préférences.
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-good/10 text-good border border-good/20"
              : "bg-bad/10 text-bad border border-bad/20"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Profil */}
      <section className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-text">Profil</h2>
          <p className="mt-0.5 text-xs text-muted">
            Modifiez vos informations personnelles.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-text">Nom complet</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Votre nom"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text">Adresse e-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="vous@exemple.com"
            />
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="btn-primary rounded-lg px-4 py-2 text-sm"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {isSaving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </section>

      {/* Mot de passe */}
      <section className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-text">Sécurité</h2>
          <p className="mt-0.5 text-xs text-muted">
            Changez votre mot de passe.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-text">Mot de passe actuel</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text">Nouveau mot de passe</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text">Confirmer le mot de passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="••••••••"
            />
          </div>

          <button
            onClick={handleChangePassword}
            disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {isChangingPassword ? "Changement..." : "Changer le mot de passe"}
          </button>
        </div>
      </section>

      {/* Abonnement */}
      <section className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-text">Abonnement</h2>
          <p className="mt-0.5 text-xs text-muted">
            Gérez votre abonnement et vos moyens de paiement.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted">
            Accédez au portail de facturation pour :
          </p>
          <ul className="list-disc list-inside text-sm text-muted space-y-1">
            <li>Mettre à jour votre moyen de paiement</li>
            <li>Changer de formule</li>
            <li>Télécharger vos factures</li>
            <li>Résilier votre abonnement</li>
          </ul>

          <button
            onClick={handleOpenBillingPortal}
            disabled={isOpeningPortal}
            className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {isOpeningPortal ? "Ouverture..." : "Gérer mon abonnement"}
          </button>

          {portalUrl && (
            <p className="text-xs text-muted">
              Ouverture dans un nouvel onglet. Si rien ne se passe,{" "}
              <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                cliquez ici
              </a>
              .
            </p>
          )}
        </div>
      </section>

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
