"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Provider {
  name: string; label: string; api_type: string; base_url: string | null;
  enabled: boolean; default_model: string;
  api_key_set: boolean; api_key_masked: string; is_builtin: boolean;
}
interface PlanConfig {
  max_brands: number; pdf_export: boolean; recommendations: boolean;
  scheduled_runs: boolean; max_providers: number; price_eur: number;
}
interface AdminUser { id: string; email: string; full_name: string | null; is_admin: boolean; organization_id: string; }
interface Promotion {
  id: string; name: string; percent_off: number | null; amount_off: number | null;
  currency: string | null; duration: string; duration_in_months: number | null;
  max_redemptions: number | null; times_redeemed: number; valid: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PLAN_ORDER = ["free", "starter", "pro", "agency", "trial"];
const PLAN_LBL: Record<string, string> = { free: "Gratuit", starter: "Starter", pro: "Pro", agency: "Agence", trial: "Essai" };

function BoolCell({ v }: { v: boolean }) {
  return <span style={{ color: v ? "var(--good)" : "var(--bad)" }}>{v ? "✓" : "✗"}</span>;
}

// ── Provider presets (pre-fill form) ─────────────────────────────────────────
const PRESETS: Record<string, { label: string; api_type: string; base_url: string; model: string }> = {
  "":          { label: "", api_type: "openai_compat", base_url: "", model: "" },
  mistral:     { label: "Mistral AI",    api_type: "openai_compat", base_url: "https://api.mistral.ai/v1",               model: "mistral-large-latest" },
  groq:        { label: "Groq",          api_type: "openai_compat", base_url: "https://api.groq.com/openai/v1",          model: "llama-3.3-70b-versatile" },
  deepseek:    { label: "DeepSeek",      api_type: "openai_compat", base_url: "https://api.deepseek.com/v1",             model: "deepseek-chat" },
  openrouter:  { label: "OpenRouter",    api_type: "openai_compat", base_url: "https://openrouter.ai/api/v1",            model: "openai/gpt-4o" },
  together:    { label: "Together AI",   api_type: "openai_compat", base_url: "https://api.together.xyz/v1",             model: "meta-llama/Llama-3-70b-chat-hf" },
  fireworks:   { label: "Fireworks AI",  api_type: "openai_compat", base_url: "https://api.fireworks.ai/inference/v1",   model: "accounts/fireworks/models/llama-v3p1-70b-instruct" },
  cohere:      { label: "Cohere",        api_type: "openai_compat", base_url: "https://api.cohere.com/compatibility/v1", model: "command-r-plus" },
  ollama:      { label: "Ollama (local)", api_type: "openai_compat", base_url: "http://localhost:11434/v1",              model: "llama3.2" },
  gemini:      { label: "Google Gemini", api_type: "openai_compat", base_url: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash" },
};

const EMPTY_NEW = { name: "", label: "", api_type: "openai_compat", base_url: "", api_key: "", default_model: "", enabled: true };

// ── Section: Providers ────────────────────────────────────────────────────────
function ProvidersSection() {
  const [providers, setProviders]   = useState<Provider[]>([]);
  const [editing,   setEditing]     = useState<string | null>(null);
  const [editForm,  setEditForm]    = useState({ api_key: "", enabled: true, default_model: "" });
  const [showNew,   setShowNew]     = useState(false);
  const [newForm,   setNewForm]     = useState({ ...EMPTY_NEW });
  const [preset,    setPreset]      = useState("");
  const [saving,    setSaving]      = useState(false);
  const [creating,  setCreating]    = useState(false);
  const [deleting,  setDeleting]    = useState<string | null>(null);
  const [msg,       setMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => apiFetch<Provider[]>("/admin/providers").then(setProviders);
  useEffect(() => { load(); }, []);

  function applyPreset(key: string) {
    setPreset(key);
    if (key && PRESETS[key]) {
      const p = PRESETS[key];
      setNewForm((f) => ({ ...f, name: key, label: p.label, api_type: p.api_type, base_url: p.base_url, default_model: p.model }));
    }
  }

  function startEdit(p: Provider) {
    setEditing(p.name);
    setEditForm({ api_key: "", enabled: p.enabled, default_model: p.default_model });
    setMsg(null);
  }

  async function save(name: string) {
    setSaving(true); setMsg(null);
    try {
      const body: Record<string, unknown> = { enabled: editForm.enabled, default_model: editForm.default_model };
      if (editForm.api_key.trim()) body.api_key = editForm.api_key.trim();
      const updated = await apiFetch<Provider>(`/admin/providers/${name}`, { method: "PATCH", body: JSON.stringify(body) });
      setProviders((prev) => prev.map((p) => p.name === name ? updated : p));
      setEditing(null);
      setMsg({ ok: true, text: "Provider mis à jour." });
    } catch { setMsg({ ok: false, text: "Erreur lors de la mise à jour." }); }
    finally { setSaving(false); }
  }

  async function create() {
    setCreating(true); setMsg(null);
    try {
      const body: Record<string, unknown> = {
        name: newForm.name.trim(), label: newForm.label.trim(),
        api_type: newForm.api_type, default_model: newForm.default_model.trim(),
        enabled: newForm.enabled,
      };
      if (newForm.base_url.trim()) body.base_url = newForm.base_url.trim();
      if (newForm.api_key.trim())  body.api_key  = newForm.api_key.trim();
      const created = await apiFetch<Provider>("/admin/providers", { method: "POST", body: JSON.stringify(body) });
      setProviders((prev) => [...prev, created]);
      setShowNew(false);
      setNewForm({ ...EMPTY_NEW });
      setPreset("");
      setMsg({ ok: true, text: `Provider "${created.label}" ajouté.` });
    } catch (e: unknown) {
      const detail = (e as { detail?: string })?.detail;
      setMsg({ ok: false, text: detail || "Erreur lors de la création." });
    } finally { setCreating(false); }
  }

  async function remove(name: string, label: string) {
    if (!window.confirm(`Supprimer le provider "${label}" ?`)) return;
    setDeleting(name);
    try {
      await apiFetch(`/admin/providers/${name}`, { method: "DELETE" });
      setProviders((prev) => prev.filter((p) => p.name !== name));
    } catch { setMsg({ ok: false, text: "Erreur lors de la suppression." }); }
    finally { setDeleting(null); }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="label">Providers LLM</div>
        <button
          onClick={() => { setShowNew((v) => !v); setMsg(null); }}
          className="rounded-lg bg-sidebar px-3 py-1.5 text-xs font-medium text-accent"
        >
          {showNew ? "Annuler" : "+ Ajouter un provider"}
        </button>
      </div>

      {/* Add new provider form */}
      {showNew && (
        <div className="card space-y-4">
          <div className="label mb-1">Nouveau provider LLM</div>

          {/* Preset selector */}
          <div>
            <label className="label mb-1 block text-[11px]">Choisir un preset (optionnel)</label>
            <select value={preset} onChange={(e) => applyPreset(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text focus:outline-none">
              <option value="">— Personnalisé —</option>
              {Object.entries(PRESETS).filter(([k]) => k).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label mb-1 block text-[11px]">Identifiant (slug)</label>
              <input value={newForm.name} onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
                placeholder="mistral"
                className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text font-mono focus:outline-none focus:ring-1 focus:ring-accent" />
              <span className="text-[10px] text-muted">Lettres minuscules, chiffres, - ou _</span>
            </div>
            <div>
              <label className="label mb-1 block text-[11px]">Nom affiché</label>
              <input value={newForm.label} onChange={(e) => setNewForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Mistral AI"
                className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div>
              <label className="label mb-1 block text-[11px]">Type d'API</label>
              <select value={newForm.api_type} onChange={(e) => setNewForm((f) => ({ ...f, api_type: e.target.value }))}
                className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text focus:outline-none">
                <option value="openai_compat">Compatible OpenAI</option>
                <option value="anthropic">Compatible Anthropic</option>
              </select>
            </div>
            <div>
              <label className="label mb-1 block text-[11px]">Modèle par défaut</label>
              <input value={newForm.default_model} onChange={(e) => setNewForm((f) => ({ ...f, default_model: e.target.value }))}
                placeholder="mistral-large-latest"
                className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text font-mono focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div className="sm:col-span-2">
              <label className="label mb-1 block text-[11px]">URL de base (API endpoint)</label>
              <input value={newForm.base_url} onChange={(e) => setNewForm((f) => ({ ...f, base_url: e.target.value }))}
                placeholder="https://api.mistral.ai/v1"
                className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text font-mono focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div className="sm:col-span-2">
              <label className="label mb-1 block text-[11px]">Clé API</label>
              <input type="password" value={newForm.api_key} onChange={(e) => setNewForm((f) => ({ ...f, api_key: e.target.value }))}
                placeholder="Laissez vide si non requis (ex. Ollama local)"
                className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text font-mono placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={newForm.enabled} onChange={(e) => setNewForm((f) => ({ ...f, enabled: e.target.checked }))}
                className="h-3.5 w-3.5 accent-accent" />
              <span className="text-xs text-text">Activer immédiatement</span>
            </label>
            <button onClick={create} disabled={creating || !newForm.name.trim() || !newForm.default_model.trim()}
              className="rounded-lg bg-sidebar px-4 py-1.5 text-sm font-medium text-accent disabled:opacity-40">
              {creating ? "Création…" : "Ajouter le provider"}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p className="text-xs" style={{ color: msg.ok ? "var(--good)" : "var(--bad)" }}>{msg.text}</p>
      )}

      {/* Provider cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {providers.map((p) => (
          <div key={p.name} className="card space-y-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="font-semibold text-text truncate">{p.label}</div>
                  {!p.is_builtin && (
                    <span className="shrink-0 rounded bg-border px-1 py-0.5 text-[9px] font-bold uppercase text-muted">custom</span>
                  )}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-muted truncate">{p.default_model}</div>
              </div>
              <span className="ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ background: p.enabled ? "rgba(16,163,127,.12)" : "rgba(100,116,139,.12)", color: p.enabled ? "var(--good)" : "var(--muted)" }}>
                {p.enabled ? "Actif" : "Off"}
              </span>
            </div>

            <div className="space-y-1.5">
              {p.base_url && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">URL</span>
                  <span className="font-mono text-[10px] text-muted truncate max-w-[130px]" title={p.base_url}>{p.base_url.replace(/^https?:\/\//, "")}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Clé API</span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.api_key_set ? "var(--good)" : "var(--bad)" }} />
                  <span style={{ color: p.api_key_set ? "var(--good)" : "var(--bad)" }}>
                    {p.api_key_set ? p.api_key_masked : "Non configurée"}
                  </span>
                </span>
              </div>
            </div>

            {editing === p.name ? (
              <div className="space-y-2 border-t border-border pt-3">
                <div>
                  <label className="label mb-1 block text-[11px]">Nouvelle clé API</label>
                  <input type="password" value={editForm.api_key}
                    onChange={(e) => setEditForm((f) => ({ ...f, api_key: e.target.value }))}
                    placeholder="Laisser vide = ne pas changer"
                    className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 font-mono text-xs text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent" />
                </div>
                <div>
                  <label className="label mb-1 block text-[11px]">Modèle par défaut</label>
                  <input type="text" value={editForm.default_model}
                    onChange={(e) => setEditForm((f) => ({ ...f, default_model: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 font-mono text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent" />
                </div>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={editForm.enabled}
                    onChange={(e) => setEditForm((f) => ({ ...f, enabled: e.target.checked }))}
                    className="h-3.5 w-3.5 accent-accent" />
                  <span className="text-xs text-text">Activé</span>
                </label>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => save(p.name)} disabled={saving}
                    className="flex-1 rounded-lg bg-sidebar py-1.5 text-xs font-medium text-accent disabled:opacity-40">
                    {saving ? "…" : "Sauvegarder"}
                  </button>
                  <button onClick={() => setEditing(null)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-text">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => startEdit(p)}
                  className="flex-1 rounded-lg border border-border py-1.5 text-xs font-medium text-muted transition-colors hover:text-text">
                  Modifier
                </button>
                {!p.is_builtin && (
                  <button onClick={() => remove(p.name, p.label)} disabled={deleting === p.name}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                    style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>
                    {deleting === p.name ? "…" : "Suppr."}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Section: Prices ───────────────────────────────────────────────────────────
function PricesSection({ plans }: { plans: Record<string, PlanConfig> }) {
  const editablePlans = ["starter", "pro", "agency"] as const;
  const [prices, setPrices] = useState<Record<string, string>>({
    starter: String(plans.starter?.price_eur ?? 49),
    pro:     String(plans.pro?.price_eur ?? 149),
    agency:  String(plans.agency?.price_eur ?? 499),
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveAll() {
    setSaving(true);
    setMsg(null);
    try {
      await Promise.all(
        editablePlans.map((plan) =>
          apiFetch(`/admin/prices/${plan}`, {
            method: "PATCH",
            body: JSON.stringify({ price_eur: parseInt(prices[plan] || "0") }),
          })
        )
      );
      setMsg({ ok: true, text: "Prix mis à jour." });
    } catch {
      setMsg({ ok: false, text: "Erreur lors de la mise à jour des prix." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="label">Prix des offres (€/mois)</div>
      <div className="card">
        <div className="grid gap-4 sm:grid-cols-3">
          {editablePlans.map((plan) => (
            <div key={plan}>
              <label className="label mb-1.5 block">{PLAN_LBL[plan]}</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min="0" step="1"
                  value={prices[plan]}
                  onChange={(e) => setPrices((prev) => ({ ...prev, [plan]: e.target.value }))}
                  className="num w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <span className="text-sm text-muted">€</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={saveAll} disabled={saving}
            className="rounded-lg bg-sidebar px-4 py-1.5 text-sm font-medium text-accent disabled:opacity-40">
            {saving ? "Enregistrement…" : "Sauvegarder les prix"}
          </button>
          {msg && (
            <span className="text-xs" style={{ color: msg.ok ? "var(--good)" : "var(--bad)" }}>{msg.text}</span>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          Ces prix sont affichés dans la page tarification. Ils ne modifient pas automatiquement les prix Stripe — mettez à jour les prix dans votre tableau de bord Stripe séparément.
        </p>
      </div>
    </section>
  );
}

// ── Section: Promotions ───────────────────────────────────────────────────────
function PromotionsSection() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "percent" as "percent" | "amount",
    percent_off: "20", amount_off: "1000", currency: "eur",
    duration: "once" as "once" | "repeating" | "forever",
    duration_in_months: "3", max_redemptions: "",
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [stripeError, setStripeError] = useState(false);

  const load = () => {
    setLoading(true);
    apiFetch<Promotion[]>("/admin/promotions")
      .then(setPromos)
      .catch(() => setStripeError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  async function create() {
    setCreating(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        duration: form.duration,
      };
      if (form.type === "percent") {
        body.percent_off = parseFloat(form.percent_off);
      } else {
        body.amount_off = parseInt(form.amount_off);
        body.currency = form.currency;
      }
      if (form.duration === "repeating") body.duration_in_months = parseInt(form.duration_in_months);
      if (form.max_redemptions) body.max_redemptions = parseInt(form.max_redemptions);

      await apiFetch("/admin/promotions", { method: "POST", body: JSON.stringify(body) });
      setMsg({ ok: true, text: "Promotion créée." });
      setShowForm(false);
      load();
    } catch {
      setMsg({ ok: false, text: "Erreur lors de la création." });
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer cette promotion ?")) return;
    setDeleting(id);
    try {
      await apiFetch(`/admin/promotions/${id}`, { method: "DELETE" });
      setPromos((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setMsg({ ok: false, text: "Erreur lors de la suppression." });
    } finally {
      setDeleting(null); }
  }

  if (stripeError) {
    return (
      <section className="space-y-3">
        <div className="label">Promotions Stripe</div>
        <div className="card">
          <p className="text-sm text-muted">Stripe non configuré — ajoutez <code className="rounded bg-border px-1">STRIPE_SECRET_KEY</code> dans votre <code className="rounded bg-border px-1">.env</code>.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="label">Promotions Stripe</div>
        <button onClick={() => { setShowForm((v) => !v); setMsg(null); }}
          className="rounded-lg bg-sidebar px-3 py-1.5 text-xs font-medium text-accent">
          {showForm ? "Annuler" : "+ Nouvelle promotion"}
        </button>
      </div>

      {showForm && (
        <div className="card space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label mb-1 block">Nom / code</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="BLACK_FRIDAY_20"
                className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div>
              <label className="label mb-1 block">Type de réduction</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "percent" | "amount" }))}
                className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text focus:outline-none">
                <option value="percent">Pourcentage (%)</option>
                <option value="amount">Montant fixe (€)</option>
              </select>
            </div>
            {form.type === "percent" ? (
              <div>
                <label className="label mb-1 block">Réduction (%)</label>
                <input type="number" min="1" max="100" value={form.percent_off}
                  onChange={(e) => setForm((f) => ({ ...f, percent_off: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent" />
              </div>
            ) : (
              <div>
                <label className="label mb-1 block">Montant (centimes)</label>
                <input type="number" min="1" value={form.amount_off}
                  onChange={(e) => setForm((f) => ({ ...f, amount_off: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent" />
                <span className="text-[11px] text-muted">ex. 1000 = 10 €</span>
              </div>
            )}
            <div>
              <label className="label mb-1 block">Durée</label>
              <select value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value as "once" | "repeating" | "forever" }))}
                className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text focus:outline-none">
                <option value="once">Une fois</option>
                <option value="repeating">Plusieurs mois</option>
                <option value="forever">Permanent</option>
              </select>
            </div>
            {form.duration === "repeating" && (
              <div>
                <label className="label mb-1 block">Nombre de mois</label>
                <input type="number" min="1" value={form.duration_in_months}
                  onChange={(e) => setForm((f) => ({ ...f, duration_in_months: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent" />
              </div>
            )}
            <div>
              <label className="label mb-1 block">Limite d'utilisation</label>
              <input type="number" min="1" value={form.max_redemptions}
                onChange={(e) => setForm((f) => ({ ...f, max_redemptions: e.target.value }))}
                placeholder="Illimité"
                className="w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={create} disabled={creating || !form.name.trim()}
              className="rounded-lg bg-sidebar px-4 py-1.5 text-sm font-medium text-accent disabled:opacity-40">
              {creating ? "Création…" : "Créer la promotion"}
            </button>
            {msg && <span className="text-xs" style={{ color: msg.ok ? "var(--good)" : "var(--bad)" }}>{msg.text}</span>}
          </div>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        {loading ? (
          <p className="px-5 py-4 text-sm text-muted">Chargement…</p>
        ) : promos.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">Aucune promotion active.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg text-left">
                {["Code / nom", "Réduction", "Durée", "Utilisations", "Statut", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-medium text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-text">{p.name}</div>
                    <div className="font-mono text-[11px] text-muted">{p.id}</div>
                  </td>
                  <td className="num px-4 py-2.5 text-text">
                    {p.percent_off !== null ? `${p.percent_off} %` : p.amount_off !== null ? `${(p.amount_off / 100).toFixed(2)} €` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted capitalize">
                    {p.duration === "once" ? "Une fois" : p.duration === "forever" ? "Permanent" : `${p.duration_in_months} mois`}
                  </td>
                  <td className="num px-4 py-2.5 text-muted">
                    {p.times_redeemed}{p.max_redemptions ? ` / ${p.max_redemptions}` : ""}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                      style={{ color: p.valid ? "var(--good)" : "var(--muted)", background: p.valid ? "rgba(16,163,127,.12)" : "rgba(100,116,139,.12)" }}>
                      {p.valid ? "Actif" : "Expiré"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => remove(p.id)} disabled={deleting === p.id}
                      className="rounded px-2 py-1 text-xs font-medium disabled:opacity-40"
                      style={{ color: "var(--bad)", border: "1px solid var(--bad)", opacity: 0.7 }}>
                      {deleting === p.id ? "…" : "Supprimer"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

// ── Section: Admins ───────────────────────────────────────────────────────────
function AdminsSection({ users, onUsersChange }: { users: AdminUser[]; onUsersChange: (u: AdminUser[]) => void }) {
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [promoteMsg, setPromoteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const adminUsers = users.filter((u) => u.is_admin);

  async function promote() {
    if (!promoteEmail.trim()) return;
    setPromoting(true);
    setPromoteMsg(null);
    try {
      const all = await apiFetch<AdminUser[]>(`/admin/users?search=${encodeURIComponent(promoteEmail)}&limit=5`);
      const target = all.find((u) => u.email.toLowerCase() === promoteEmail.toLowerCase());
      if (!target) { setPromoteMsg({ ok: false, text: "Utilisateur introuvable." }); return; }
      await apiFetch(`/admin/users/${target.id}`, { method: "PATCH", body: JSON.stringify({ is_admin: true }) });
      onUsersChange(users.map((u) => u.id === target.id ? { ...u, is_admin: true } : u));
      setPromoteEmail("");
      setPromoteMsg({ ok: true, text: `${target.email} est maintenant administrateur.` });
    } catch { setPromoteMsg({ ok: false, text: "Erreur lors de la promotion." }); }
    finally { setPromoting(false); }
  }

  async function revoke(user: AdminUser) {
    if (!window.confirm(`Révoquer les droits admin de ${user.email} ?`)) return;
    setRevoking(user.id);
    try {
      await apiFetch(`/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ is_admin: false }) });
      onUsersChange(users.map((u) => u.id === user.id ? { ...u, is_admin: false } : u));
    } finally { setRevoking(null); }
  }

  return (
    <section className="space-y-3">
      <div className="label">Comptes administrateurs</div>
      <div className="card space-y-3">
        {adminUsers.length === 0 ? (
          <p className="text-sm text-muted">Aucun administrateur trouvé.</p>
        ) : (
          adminUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5">
              <div>
                <div className="text-sm font-medium text-text">{u.email}</div>
                {u.full_name && <div className="text-xs text-muted">{u.full_name}</div>}
              </div>
              <button onClick={() => revoke(u)} disabled={revoking === u.id}
                className="rounded-lg border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
                style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>
                {revoking === u.id ? "…" : "Révoquer"}
              </button>
            </div>
          ))
        )}
        <div className="border-t border-border pt-3">
          <div className="label mb-2">Promouvoir un utilisateur</div>
          <div className="flex gap-2">
            <input
              type="email" value={promoteEmail} onChange={(e) => setPromoteEmail(e.target.value)}
              placeholder="email@exemple.com"
              className="flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
              onKeyDown={(e) => e.key === "Enter" && promote()}
            />
            <button onClick={promote} disabled={promoting || !promoteEmail.trim()}
              className="rounded-lg bg-sidebar px-4 py-1.5 text-sm font-medium text-accent disabled:opacity-40">
              {promoting ? "…" : "Promouvoir"}
            </button>
          </div>
          {promoteMsg && (
            <p className="mt-2 text-xs" style={{ color: promoteMsg.ok ? "var(--good)" : "var(--bad)" }}>
              {promoteMsg.text}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [plans, setPlans] = useState<Record<string, PlanConfig>>({});
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Record<string, PlanConfig>>("/admin/plans"),
      apiFetch<AdminUser[]>("/admin/users?limit=200"),
    ]).then(([pl, u]) => {
      setPlans(pl);
      setUsers(u);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-muted">Chargement…</p>;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="num text-3xl text-text">Paramètres</h1>
        <p className="mt-1 text-sm text-muted">Configuration de la plateforme en temps réel.</p>
      </div>

      {/* Providers — editable */}
      <ProvidersSection />

      {/* Prices — editable */}
      <PricesSection plans={plans} />

      {/* Promotions — Stripe coupons */}
      <PromotionsSection />

      {/* Plans limits table — read-only */}
      <section className="space-y-3">
        <div className="label">Limites des offres</div>
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg text-left">
                  {["Plan", "Prix/mois", "Marques", "PDF", "Recommandations", "Runs planifiés", "Providers"].map((h) => (
                    <th key={h} className="px-5 py-3 text-xs font-medium text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLAN_ORDER.filter((k) => plans[k]).map((key) => {
                  const p = plans[key];
                  return (
                    <tr key={key} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 font-semibold text-text">{PLAN_LBL[key] ?? key}</td>
                      <td className="num px-5 py-3 text-text">{p.price_eur > 0 ? `${p.price_eur} €` : "Gratuit"}</td>
                      <td className="num px-5 py-3 text-text">{p.max_brands === -1 ? "∞" : p.max_brands}</td>
                      <td className="px-5 py-3"><BoolCell v={p.pdf_export} /></td>
                      <td className="px-5 py-3"><BoolCell v={p.recommendations} /></td>
                      <td className="px-5 py-3"><BoolCell v={p.scheduled_runs} /></td>
                      <td className="num px-5 py-3 text-text">{p.max_providers === -1 ? "∞" : p.max_providers}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-muted">Les limites (marques, PDF…) sont définies dans <code className="rounded bg-border px-1 py-0.5">apps/api/app/plan_limits.py</code>.</p>
      </section>

      {/* Stripe */}
      <section className="space-y-3">
        <div className="label">Stripe</div>
        <div className="card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium text-text">Tableau de bord Stripe</div>
              <div className="mt-0.5 text-xs text-muted">Gérez vos produits, prix, clients et webhooks directement depuis Stripe.</div>
            </div>
            <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer"
              className="flex-shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-card">
              Ouvrir Stripe →
            </a>
          </div>
          <div className="mt-4 rounded-lg bg-bg p-3 text-xs text-muted space-y-1">
            <p>Variables d'environnement requises dans <code>.env</code> :</p>
            {["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_STARTER_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_AGENCY_PRICE_ID"].map((k) => (
              <code key={k} className="block rounded bg-border px-2 py-0.5">{k}=...</code>
            ))}
          </div>
        </div>
      </section>

      {/* Admins */}
      <AdminsSection users={users} onUsersChange={setUsers} />
    </div>
  );
}
