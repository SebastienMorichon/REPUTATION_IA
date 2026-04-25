"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Tab = "settings" | "categories" | "sectors" | "core" | "strategic" | "preview" | "audit";

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: "settings",   label: "Configuration",  emoji: "⚙️" },
  { key: "categories", label: "Catégories",       emoji: "🏷️" },
  { key: "sectors",    label: "Secteurs",         emoji: "🏢" },
  { key: "core",       label: "Core Templates",   emoji: "📝" },
  { key: "strategic",  label: "Strategic",        emoji: "🚀" },
  { key: "preview",    label: "Prévisualisation",  emoji: "👁️" },
  { key: "audit",      label: "Historique",       emoji: "📋" },
];

export default function PromptFrameworkPage() {
  const [activeTab, setActiveTab] = useState<Tab>("settings");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const el = document.getElementById("tab-content");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div>
        <div className="label text-xl">Prompt Framework</div>
        <p className="mt-1 text-sm text-muted">
          Contrôlez entièrement le système de prompts — catégories, secteurs, templates et scoring.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-border pb-px">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "border border-border border-b-0 bg-bg text-text"
                : "text-muted hover:text-text"
            }`}
          >
            <span>{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm ${message.type === "success" ? "bg-good/10 text-good" : "bg-bad/10 text-bad"}`}>
          {message.text}
        </div>
      )}

      {/* Content */}
      <div id="tab-content">
        {activeTab === "settings"   && <SettingsTab setMessage={setMessage} />}
        {activeTab === "categories" && <CategoriesTab setMessage={setMessage} />}
        {activeTab === "sectors"    && <SectorsTab setMessage={setMessage} />}
        {activeTab === "core"       && <CoreTemplatesTab setMessage={setMessage} />}
        {activeTab === "strategic"  && <StrategicTab setMessage={setMessage} />}
        {activeTab === "preview"    && <PreviewTab setMessage={setMessage} />}
        {activeTab === "audit"      && <AuditTab setMessage={setMessage} />}
      </div>
    </div>
  );
}

// ── Settings Tab ────────────────────────────────────────────────────────────────

function SettingsTab({ setMessage }: { setMessage: (m: { type: "success" | "error"; text: string } | null) => void }) {
  const [cfg, setCfg] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Record<string, unknown>>("/admin/prompt-framework/config")
      .then(setCfg).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function save(body: Record<string, unknown>) {
    setSaving(true);
    try {
      const updated = await apiFetch<Record<string, unknown>>("/admin/prompt-framework/config", { method: "PUT", body: JSON.stringify(body) });
      setCfg(updated);
      setMessage({ type: "success", text: "Configuration enregistrée." });
    } catch {
      setMessage({ type: "error", text: "Erreur lors de l'enregistrement." });
    } finally {
      setSaving(false);
    }
  }

  async function refresh() {
    try {
      await apiFetch("/admin/prompt-framework/config/refresh", { method: "POST" });
      const updated = await apiFetch<Record<string, unknown>>("/admin/prompt-framework/config");
      setCfg(updated);
      setMessage({ type: "success", text: "Defaults restaurés." });
    } catch {
      setMessage({ type: "error", text: "Erreur lors du refresh." });
    }
  }

  if (loading) return <div className="text-sm text-muted">Chargement…</div>;

  return (
    <div className="card space-y-4">
      <div className="label">Configuration générale</div>

      <div className="grid grid-cols-2 gap-4">
        <label className="space-y-1">
          <span className="text-xs text-muted">Benchmark Weight ({typeof cfg.benchmark_weight === "number" ? (cfg.benchmark_weight as number * 100).toFixed(0) : "70"}%)</span>
          <input
            type="number"
            min="0" max="1" step="0.05"
            className="input w-full"
            defaultValue={cfg.benchmark_weight as number}
            onBlur={(e) => save({ ...cfg, benchmark_weight: parseFloat(e.target.value) })}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Strategic Weight ({typeof cfg.strategic_weight === "number" ? (cfg.strategic_weight as number * 100).toFixed(0) : "30"}%)</span>
          <input
            type="number"
            min="0" max="1" step="0.05"
            className="input w-full"
            defaultValue={cfg.strategic_weight as number}
            onBlur={(e) => save({ ...cfg, strategic_weight: parseFloat(e.target.value) })}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Core Prompts par marque</span>
          <input
            type="number"
            min="1" max="100"
            className="input w-full"
            defaultValue={cfg.default_core_count as number}
            onBlur={(e) => save({ ...cfg, default_core_count: parseInt(e.target.value) })}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Strategic Prompts par marque</span>
          <input
            type="number"
            min="1" max="100"
            className="input w-full"
            defaultValue={cfg.default_strategic_count as number}
            onBlur={(e) => save({ ...cfg, default_strategic_count: parseInt(e.target.value) })}
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={refresh}
          className="btn-primary text-sm"
        >
          🔄 Réinitialiser les defaults
        </button>
        <span className="text-xs text-muted">Restaure les valeurs hardcodées en base de données.</span>
      </div>
    </div>
  );
}

// ── Categories Tab ──────────────────────────────────────────────────────────────

function CategoriesTab({ setMessage }: { setMessage: (m: { type: "success" | "error"; text: string } | null) => void }) {
  const [cats, setCats] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try { setCats(await apiFetch("/admin/prompt-framework/categories")) as unknown as Record<string, unknown>[]; } catch {} finally { setLoading(false); }
  }

  function startEdit(cat: Record<string, unknown>) { setEditing(cat.category_key as string); setForm({ ...cat }); }
  async function saveEdit() {
    try {
      await apiFetch(`/admin/prompt-framework/categories/${editing}`, { method: "PUT", body: JSON.stringify(form) });
      setEditing(null); load(); setMessage({ type: "success", text: "Catégorie modifiée." });
    } catch { setMessage({ type: "error", text: "Erreur." }); }
  }

  if (loading) return <div className="text-sm text-muted">Chargement…</div>;

  return (
    <div className="card space-y-4">
      <div className="label">Catégories de prompts</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="pb-2">Key</th><th className="pb-2">Titre</th><th className="pb-2">Ratio</th><th className="pb-2">Ordre</th><th className="pb-2">Active</th><th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {cats.map((cat) => (
            <tr key={cat.category_key as string} className="border-b border-border">
              {editing === cat.category_key ? (
                <>
                  <td className="py-2 pr-3 text-muted">{cat.category_key as string}</td>
                  <td className="py-2 pr-3"><input className="input text-sm w-full" value={form.title as string || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></td>
                  <td className="py-2 pr-3"><input type="number" className="input text-sm w-20" step="0.05" value={form.recommended_ratio as number} onChange={(e) => setForm({ ...form, recommended_ratio: parseFloat(e.target.value) })} /></td>
                  <td className="py-2 pr-3"><input type="number" className="input text-sm w-16" value={form.display_order as number} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) })} /></td>
                  <td className="py-2 pr-3">
                    <select className="input text-sm" value={String(form.is_active)} onChange={(e) => setForm({ ...form, is_active: e.target.value === "true" })}>
                      <option value="true">Oui</option><option value="false">Non</option>
                    </select>
                  </td>
                  <td className="py-2">
                    <button onClick={saveEdit} className="text-xs text-good mr-2">✓ Sauver</button>
                    <button onClick={() => setEditing(null)} className="text-xs text-muted">✕ Annuler</button>
                  </td>
                </>
              ) : (
                <>
                  <td className="py-2 pr-3 font-mono text-xs">{cat.category_key as string}</td>
                  <td className="py-2 pr-3">{cat.title as string}</td>
                  <td className="py-2 pr-3">{((cat.recommended_ratio as number) * 100).toFixed(0)}%</td>
                  <td className="py-2 pr-3">{cat.display_order as number}</td>
                  <td className="py-2 pr-3">{cat.is_active ? "✅" : "⛔"}</td>
                  <td className="py-2"><button onClick={() => startEdit(cat)} className="text-xs text-accent">Modifier</button></td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Sectors Tab ────────────────────────────────────────────────────────────────

function SectorsTab({ setMessage }: { setMessage: (m: { type: "success" | "error"; text: string } | null) => void }) {
  const [sectors, setSectors] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  async function load() { setLoading(true); try { setSectors(await apiFetch("/admin/prompt-framework/sectors") as unknown as Record<string, unknown>[]); } catch {} finally { setLoading(false); } }

  if (loading) return <div className="text-sm text-muted">Chargement…</div>;

  return (
    <div className="card space-y-4">
      <div className="label">Secteurs</div>
      <div className="grid grid-cols-3 gap-3">
        {sectors.map((s) => (
          <div key={s.sector_key as string} className={`rounded-lg border px-4 py-3 ${s.is_active ? "border-border" : "border-border border-dashed opacity-60"}`}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold">{s.sector_key as string}</span>
              <span className={`text-xs font-bold ${s.is_active ? "text-good" : "text-muted"}`}>{s.is_active ? "ACTIVE" : "INACTIVE"}</span>
            </div>
            <div className="mt-1 text-sm text-text">{s.title as string}</div>
            {s.description ? <div className="mt-1 text-xs text-muted">{(s.description as string)}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Core Templates Tab ───────────────────────────────────────────────────────

function CoreTemplatesTab({ setMessage }: { setMessage: (m: { type: "success" | "error"; text: string } | null) => void }) {
  const [templates, setTemplates] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSector, setFilterSector] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => { load(); }, [filterSector, filterCat]);
  async function load() {
    setLoading(true);
    try {
      const url = `/admin/prompt-framework/core-templates${filterSector || filterCat ? `?${filterSector ? `sector_key=${filterSector}&` : ""}${filterCat ? `category_key=${filterCat}` : ""}` : ""}`;
      setTemplates(await apiFetch(url) as unknown as Record<string, unknown>[]);
    } catch {} finally { setLoading(false); }
  }

  async function saveEdit(id: string) {
    try {
      await apiFetch(`/admin/prompt-framework/core-templates/${id}`, { method: "PUT", body: JSON.stringify({ text: editText }) });
      setEditId(null); load(); setMessage({ type: "success", text: "Template modifié." });
    } catch { setMessage({ type: "error", text: "Erreur." }); }
  }

  async function resetSector(sector: string) {
    if (!confirm(`Réinitialiser tous les templates du secteur "${sector}" vers les defaults ?`)) return;
    try {
      await apiFetch(`/admin/prompt-framework/core-templates/reset/${sector}`, { method: "POST" });
      load(); setMessage({ type: "success", text: `Secteur "${sector}" réinitialisé.` });
    } catch { setMessage({ type: "error", text: "Erreur." }); }
  }

  return (
    <div className="space-y-4">
      {/* Filters + reset */}
      <div className="card space-y-3">
        <div className="flex flex-wrap gap-3">
          <select className="input text-sm" value={filterSector} onChange={(e) => setFilterSector(e.target.value)}>
            <option value="">Tous secteurs</option>
            {["assurance","banque","immobilier","santé","saas","e-commerce","consulting","restaurant","générique"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input text-sm" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">Toutes catégories</option>
            {["discovery","comparison","reputation","authority"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {filterSector && (
            <button onClick={() => resetSector(filterSector)} className="btn-ghost text-xs border border-border">🔄 Réinitialiser {filterSector}</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? <div className="text-sm text-muted">Chargement…</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="pb-2 pr-3">Secteur</th><th className="pb-2 pr-3">Catégorie</th><th className="pb-2 pr-3">Idx</th><th className="pb-2">Template</th><th className="pb-2 pr-3">Active</th><th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id as string} className="border-b border-border">
                  <td className="py-2 pr-3 font-mono text-xs">{t.sector_key as string}</td>
                  <td className="py-2 pr-3 text-xs">{t.category_key as string}</td>
                  <td className="py-2 pr-3 text-xs text-muted">{t.template_index as number}</td>
                  <td className="py-2 min-w-0 flex-1">
                    {editId === t.id ? (
                      <textarea className="input text-sm w-full" rows={2} value={editText} onChange={(e) => setEditText(e.target.value)} />
                    ) : (
                      <span className="text-xs leading-relaxed">{t.text as string}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{t.is_active ? "✅" : "⛔"}</td>
                  <td className="py-2">
                    {editId === t.id ? (
                      <>
                        <button onClick={() => saveEdit(t.id as string)} className="text-xs text-good mr-2">✓</button>
                        <button onClick={() => setEditId(null)} className="text-xs text-muted">✕</button>
                      </>
                    ) : (
                      <button onClick={() => { setEditId(t.id as string); setEditText(t.text as string); }} className="text-xs text-accent">Modifier</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Strategic Tab ─────────────────────────────────────────────────────────────

function StrategicTab({ setMessage }: { setMessage: (m: { type: "success" | "error"; text: string } | null) => void }) {
  const [configs, setConfigs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  async function load() { setLoading(true); try { setConfigs(await apiFetch("/admin/prompt-framework/strategic-configs") as unknown as Record<string, unknown>[]); } catch {} finally { setLoading(false); } }

  if (loading) return <div className="text-sm text-muted">Chargement…</div>;

  return (
    <div className="card space-y-4">
      <div className="label">Configurations Strategic</div>
      <p className="text-sm text-muted">Les règles de génération des prompts Strategic par secteur/catégorie.</p>
      {configs.length === 0 ? (
        <div className="text-sm text-muted">Aucune configuration — les defaults s&apos;appliquent.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="pb-2 pr-3">Secteur</th><th className="pb-2 pr-3">Catégorie</th><th className="pb-2 pr-3">Count</th><th className="pb-2 pr-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((c) => (
              <tr key={`${c.sector_key}-${c.category_key}`} className="border-b border-border">
                <td className="py-2 pr-3 font-mono text-xs">{c.sector_key as string}</td>
                <td className="py-2 pr-3 text-xs">{c.category_key as string}</td>
                <td className="py-2 pr-3">{c.target_count != null ? String(c.target_count) : "—"}</td>
                <td className="py-2 pr-3">{c.is_active ? "✅" : "⛔"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Preview Tab ───────────────────────────────────────────────────────────────

function PreviewTab({ setMessage }: { setMessage: (m: { type: "success" | "error"; text: string } | null) => void }) {
  const [brandName, setBrandName] = useState("Ma Banque Test");
  const [sector, setSector] = useState("banque");
  const [competitors, setCompetitors] = useState("BNP Paribas, Société Générale");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function preview() {
    setLoading(true);
    try {
      const data = await apiFetch<Record<string, unknown>>("/admin/prompt-framework/preview", {
        method: "POST",
        body: JSON.stringify({
          brand_name: brandName,
          sector_key: sector,
          competitors: competitors.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      setResult(data);
    } catch {
      setMessage({ type: "error", text: "Erreur lors de la prévisualisation." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div className="label">Prévisualisation du portfolio</div>
        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-xs text-muted">Nom de la marque</span>
            <input className="input text-sm w-full" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted">Secteur</span>
            <select className="input text-sm w-full" value={sector} onChange={(e) => setSector(e.target.value)}>
              {["assurance","banque","immobilier","santé","saas","e-commerce","consulting","restaurant","générique"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="space-y-1 col-span-2">
            <span className="text-xs text-muted">Concurrents (séparés par virgule)</span>
            <input className="input text-sm w-full" value={competitors} onChange={(e) => setCompetitors(e.target.value)} />
          </label>
        </div>
        <button onClick={preview} disabled={loading} className="btn-primary text-sm">
          {loading ? "⏳ Prévisualisation…" : "👁️ Prévisualiser"}
        </button>
      </div>

      {result && (
        <div className="card space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-semibold">Benchmark: {((result.scoring as Record<string, unknown>)?.benchmark_weight as number * 100).toFixed(0)}%</span>
            <span className="font-semibold">Strategic: {((result.scoring as Record<string, unknown>)?.strategic_weight as number * 100).toFixed(0)}%</span>
            <span className="text-muted">Formule: {(result.scoring as Record<string, unknown>)?.global_formula as string}</span>
          </div>

          {(["core", "strategic"] as const).map((scope) => {
            const scopeData = result[scope] as Record<string, unknown>;
            const byCategory = scopeData?.by_category as Record<string, unknown>;
            return (
              <div key={scope} className="space-y-2">
                <div className="label text-base">{scope === "core" ? "🎯 Core" : "🚀 Strategic"} — {String(scopeData?.count ?? 0)} prompts</div>
                {byCategory && Object.entries(byCategory).map(([cat, prompts]) => {
                  const list = prompts as Record<string, unknown>[];
                  if (!list.length) return null;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="text-sm font-semibold text-muted uppercase">{cat} ({list.length})</div>
                      {list.map((p, i) => (
                        <div key={i} className="rounded border border-border bg-bg px-3 py-2 text-xs">
                          {(p as Record<string, unknown>).text as string}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Audit Tab ───────────────────────────────────────────────────────────────────────────

function AuditTab({ setMessage }: { setMessage: (m: { type: "success" | "error"; text: string } | null) => void }) {
  const [entries, setEntries] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<{ total: number; entries: Record<string, unknown>[] }>("/admin/prompt-framework/audit-log");
      setTotal(data.total); setEntries(data.entries);
    } catch {} finally { setLoading(false); }
  }

  return (
    <div className="card space-y-4">
      <div className="label">Historique des modifications ({total} entrées)</div>
      {loading ? <div className="text-sm text-muted">Chargement…</div> : entries.length === 0 ? (
        <div className="text-sm text-muted">Aucune entrée.</div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id as string} className="flex items-start gap-3 rounded border border-border bg-bg px-3 py-2 text-xs">
              <div className="flex flex-shrink-0 flex-col items-center gap-1">
                <span className="text-lg">
                  {(e.action as string) === "create" ? "✅" : (e.action as string) === "delete" ? "🗑️" : (e.action as string) === "refresh_defaults" ? "🔄" : "✏️"}
                </span>
                <span className="font-mono text-[9px] text-muted">{e.action as string}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-text">{e.table_name as string}</div>
                <div className="text-muted">
                  {e.changed_by_email as string} — {new Date(e.created_at as string).toLocaleString("fr-FR")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
