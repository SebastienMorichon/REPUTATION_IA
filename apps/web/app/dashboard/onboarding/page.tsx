"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  apiFetch,
  type Brand,
  type Competitor,
  type Prompt,
  type ProviderStatus,
} from "@/lib/api";

/* ─── Types locaux ───────────────────────────────────────── */

interface CompetitorDraft {
  name: string;
  domain: string;
}

const CATEGORIES = [
  { value: "banque", label: "Banque / Finance" },
  { value: "e-commerce", label: "E-commerce" },
  { value: "saas", label: "SaaS / Tech" },
  { value: "restaurant", label: "Restaurant / Food" },
  { value: "immobilier", label: "Immobilier" },
  { value: "santé", label: "Santé" },
  { value: "consulting", label: "Consulting" },
  { value: "générique", label: "Autre / Générique" },
];

const STEPS = [
  { id: 1, label: "Votre marque" },
  { id: 2, label: "Concurrents" },
  { id: 3, label: "Questions" },
  { id: 4, label: "Premier run" },
];

/* ─── Composant principal ────────────────────────────────── */

export default function OnboardingPage() {
  const router = useRouter();

  // Navigation
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Étape 1 — Marque
  const [brandForm, setBrandForm] = useState({
    name: "",
    domain: "",
    category: "",
  });
  const [brand, setBrand] = useState<Brand | null>(null);

  // Étape 2 — Concurrents
  const [competitorDraft, setCompetitorDraft] = useState<CompetitorDraft>({
    name: "",
    domain: "",
  });
  const [competitors, setCompetitors] = useState<Competitor[]>([]);

  // Étape 3 — Prompts
  const [location, setLocation] = useState("");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [manualPrompt, setManualPrompt] = useState("");
  const [generationDone, setGenerationDone] = useState(false);

  // Étape 4 — Run
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [runLaunched, setRunLaunched] = useState(false);

  /* ─── helpers ──────────────────────────────────────────── */

  function clearError() {
    setError(null);
  }

  /* ─── Étape 1 : créer la marque ────────────────────────── */

  async function handleCreateBrand() {
    if (!brandForm.name.trim()) {
      setError("Le nom de la marque est requis.");
      return;
    }
    setLoading(true);
    clearError();
    try {
      const created = await apiFetch<Brand>("/brands", {
        method: "POST",
        body: JSON.stringify({
          name: brandForm.name.trim(),
          domain: brandForm.domain.trim() || null,
          category: brandForm.category || null,
          country: "FR",
          language: "fr",
        }),
      });
      setBrand(created);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création.");
    } finally {
      setLoading(false);
    }
  }

  /* ─── Étape 2 : ajouter des concurrents ────────────────── */

  async function handleAddCompetitor() {
    if (!competitorDraft.name.trim() || !brand) return;
    setLoading(true);
    clearError();
    try {
      const created = await apiFetch<Competitor>(`/brands/${brand.id}/competitors`, {
        method: "POST",
        body: JSON.stringify({
          name: competitorDraft.name.trim(),
          domain: competitorDraft.domain.trim() || null,
        }),
      });
      setCompetitors((prev) => [...prev, created]);
      setCompetitorDraft({ name: "", domain: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteCompetitor(competitorId: string) {
    if (!brand) return;
    try {
      await apiFetch(`/brands/${brand.id}/competitors/${competitorId}`, {
        method: "DELETE",
      });
      setCompetitors((prev) => prev.filter((c) => c.id !== competitorId));
    } catch {
      // best-effort
    }
  }

  /* ─── Étape 3 : générer les prompts ────────────────────── */

  async function handleGeneratePrompts() {
    if (!brand) return;
    setLoading(true);
    clearError();
    try {
      const params = location.trim() ? `?location=${encodeURIComponent(location.trim())}` : "";
      const generated = await apiFetch<Prompt[]>(
        `/brands/${brand.id}/prompts/generate${params}`,
        { method: "POST" }
      );
      setPrompts(generated);
      setGenerationDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la génération.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddManualPrompt() {
    if (!manualPrompt.trim() || !brand) return;
    setLoading(true);
    clearError();
    try {
      const created = await apiFetch<Prompt>(`/brands/${brand.id}/prompts`, {
        method: "POST",
        body: JSON.stringify({ text: manualPrompt.trim() }),
      });
      setPrompts((prev) => [...prev, created]);
      setManualPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoToStep4() {
    if (!brand) return;
    setLoading(true);
    clearError();
    try {
      const providerList = await apiFetch<ProviderStatus[]>("/providers");
      setProviders(providerList);
      setStep(4);
    } catch {
      // providers non essentiels, on continue quand même
      setStep(4);
    } finally {
      setLoading(false);
    }
  }

  /* ─── Étape 4 : lancer le run ──────────────────────────── */

  async function handleLaunchRun() {
    if (!brand) return;
    setLoading(true);
    clearError();
    try {
      await apiFetch(`/brands/${brand.id}/runs`, { method: "POST" });
      setRunLaunched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du lancement.");
    } finally {
      setLoading(false);
    }
  }

  /* ─── Rendu ─────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center px-4 py-12">
      {/* Logo */}
      <Link href="/" className="mb-10 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-fg)" strokeWidth="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="text-base font-semibold text-text">AI Reputation Shield</span>
      </Link>

      {/* Titre */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-text">Configuration de votre espace</h1>
        <p className="mt-1 text-sm text-muted">Suivez les 4 étapes pour démarrer votre monitoring.</p>
      </div>

      {/* Barre de progression */}
      <div className="mb-8 w-full max-w-xl">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center">
              {/* Cercle étape */}
              <div className="flex flex-col items-center">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors"
                  style={{
                    background: step >= s.id ? "var(--accent)" : "var(--card)",
                    color: step >= s.id ? "var(--accent-fg)" : "var(--muted)",
                    border: step >= s.id ? "none" : "1px solid var(--border)",
                  }}
                >
                  {step > s.id ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    s.id
                  )}
                </div>
                <span
                  className="mt-1.5 text-[10px] font-medium uppercase tracking-wide"
                  style={{ color: step >= s.id ? "var(--text)" : "var(--muted)" }}
                >
                  {s.label}
                </span>
              </div>
              {/* Trait de connexion */}
              {i < STEPS.length - 1 && (
                <div
                  className="mx-2 h-px flex-1 transition-colors"
                  style={{ background: step > s.id ? "var(--accent)" : "var(--border)" }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Card de l'étape courante */}
      <div className="card w-full max-w-xl space-y-5">
        {/* ── Étape 1 ── */}
        {step === 1 && (
          <>
            <StepHeader
              step={1}
              title="Votre marque"
              desc="Commençons par identifier la marque que vous souhaitez surveiller."
            />

            <div>
              <label className="label">Nom de la marque *</label>
              <input
                className="input"
                placeholder="ex. Acme Corp"
                value={brandForm.name}
                onChange={(e) => setBrandForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleCreateBrand()}
              />
            </div>

            <div>
              <label className="label">Domaine (optionnel)</label>
              <input
                className="input"
                placeholder="acme.com"
                value={brandForm.domain}
                onChange={(e) => setBrandForm((f) => ({ ...f, domain: e.target.value }))}
              />
            </div>

            <div>
              <label className="label">Catégorie</label>
              <select
                className="input"
                value={brandForm.category}
                onChange={(e) => setBrandForm((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="">-- Choisir une catégorie --</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {error && <ErrorMsg msg={error} />}

            <div className="flex justify-end">
              <button
                className="btn-primary"
                onClick={handleCreateBrand}
                disabled={loading}
              >
                {loading ? "Création…" : "Suivant →"}
              </button>
            </div>
          </>
        )}

        {/* ── Étape 2 ── */}
        {step === 2 && (
          <>
            <StepHeader
              step={2}
              title="Vos concurrents"
              desc="Ajoutez 2 à 3 concurrents pour comparer votre Share of Voice. Vous pouvez passer cette étape."
            />

            {/* Formulaire ajout concurrent */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="label">Nom du concurrent</label>
                <input
                  className="input"
                  placeholder="ex. Beta Corp"
                  value={competitorDraft.name}
                  onChange={(e) => setCompetitorDraft((d) => ({ ...d, name: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCompetitor()}
                />
              </div>
              <div className="flex-1">
                <label className="label">Domaine (optionnel)</label>
                <input
                  className="input"
                  placeholder="beta.com"
                  value={competitorDraft.domain}
                  onChange={(e) => setCompetitorDraft((d) => ({ ...d, domain: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCompetitor()}
                />
              </div>
            </div>

            <button
              className="btn-ghost w-full"
              onClick={handleAddCompetitor}
              disabled={loading || !competitorDraft.name.trim()}
            >
              {loading ? "Ajout…" : "+ Ajouter concurrent"}
            </button>

            {/* Liste des concurrents */}
            {competitors.length > 0 && (
              <ul className="space-y-2">
                {competitors.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
                  >
                    <div>
                      <span className="font-medium text-text">{c.name}</span>
                      {c.domain && (
                        <span className="ml-2 text-xs text-muted">{c.domain}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteCompetitor(c.id)}
                      className="text-muted hover:text-bad transition-colors text-xs"
                    >
                      Supprimer
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {competitors.length === 0 && (
              <p className="text-center text-xs text-muted py-2">
                Aucun concurrent ajouté pour l&apos;instant.
              </p>
            )}

            {error && <ErrorMsg msg={error} />}

            <div className="flex items-center justify-between pt-1">
              <button className="btn-ghost" onClick={() => setStep(1)}>
                ← Précédent
              </button>
              <div className="flex gap-2">
                <button className="btn-ghost text-muted" onClick={() => setStep(3)}>
                  Passer
                </button>
                <button className="btn-primary" onClick={() => setStep(3)}>
                  Suivant →
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Étape 3 ── */}
        {step === 3 && (
          <>
            <StepHeader
              step={3}
              title="Vos questions de monitoring"
              desc="Générez automatiquement des questions ou ajoutez les vôtres."
            />

            {/* Génération automatique */}
            <div className="rounded-xl border border-border bg-bg p-4 space-y-3">
              <p className="text-sm font-medium text-text">Génération automatique</p>
              <div>
                <label className="label">Ville / Région (optionnel)</label>
                <input
                  className="input"
                  placeholder="ex. Paris, Lyon, Bordeaux…"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <button
                className="btn-primary"
                onClick={handleGeneratePrompts}
                disabled={loading}
              >
                {loading ? "Génération…" : "✨ Générer automatiquement"}
              </button>
            </div>

            {/* Questions générées */}
            {prompts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {prompts.length} question{prompts.length > 1 ? "s" : ""} prête{prompts.length > 1 ? "s" : ""}
                </p>
                <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {prompts.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text"
                    >
                      {p.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ajout manuel */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Ajouter manuellement
              </p>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="ex. Quel est le meilleur SaaS pour…"
                  value={manualPrompt}
                  onChange={(e) => setManualPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddManualPrompt()}
                />
                <button
                  className="btn-ghost shrink-0"
                  onClick={handleAddManualPrompt}
                  disabled={loading || !manualPrompt.trim()}
                >
                  Ajouter
                </button>
              </div>
            </div>

            {error && <ErrorMsg msg={error} />}

            <div className="flex items-center justify-between pt-1">
              <button className="btn-ghost" onClick={() => setStep(2)}>
                ← Précédent
              </button>
              <button
                className="btn-primary"
                onClick={handleGoToStep4}
                disabled={loading || prompts.length === 0}
              >
                {loading ? "Chargement…" : "Suivant →"}
              </button>
            </div>
          </>
        )}

        {/* ── Étape 4 ── */}
        {step === 4 && brand && (
          <>
            <StepHeader
              step={4}
              title="Premier run"
              desc="Tout est prêt. Lancez votre première analyse."
            />

            {/* Récap */}
            <div className="rounded-xl border border-border bg-bg p-4 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted mb-2">Récapitulatif</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Marque</span>
                <span className="font-semibold text-text">{brand.name}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Questions</span>
                <span className="font-semibold text-text">{prompts.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Concurrents</span>
                <span className="font-semibold text-text">{competitors.length}</span>
              </div>
              {providers.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Providers actifs</span>
                  <span className="font-semibold text-text">
                    {providers.filter((p) => p.enabled).map((p) => p.name).join(", ") || "—"}
                  </span>
                </div>
              )}
            </div>

            {error && <ErrorMsg msg={error} />}

            {!runLaunched ? (
              <div className="flex items-center justify-between pt-1">
                <button className="btn-ghost" onClick={() => setStep(3)}>
                  ← Précédent
                </button>
                <button
                  className="btn-primary"
                  onClick={handleLaunchRun}
                  disabled={loading}
                >
                  {loading ? "Lancement…" : "▶ Lancer la première analyse"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl border border-good/30 bg-good/10 px-4 py-3">
                  <span className="text-good text-base">✓</span>
                  <p className="text-sm text-text">
                    Analyse lancée ! Les résultats arrivent dans quelques instants.
                  </p>
                </div>
                <button
                  className="btn-primary w-full"
                  onClick={() => router.push(`/dashboard/brands/${brand.id}`)}
                >
                  Voir les résultats →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Lien skip */}
      <p className="mt-6 text-xs text-muted">
        <Link href="/dashboard" className="hover:text-text underline underline-offset-2 transition-colors">
          Passer et configurer plus tard
        </Link>
      </p>
    </div>
  );
}

/* ─── Sous-composants ────────────────────────────────────── */

function StepHeader({ step, title, desc }: { step: number; title: string; desc: string }) {
  return (
    <div className="space-y-1 pb-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted">Étape {step} / 4</span>
      </div>
      <h2 className="text-xl font-bold text-text">{title}</h2>
      <p className="text-sm text-muted">{desc}</p>
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2.5 text-sm text-bad">
      {msg}
    </div>
  );
}
