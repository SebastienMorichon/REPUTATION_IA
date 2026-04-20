"use client";

import { useEffect, useState, Fragment } from "react";
import { apiFetch } from "@/lib/api";

interface OrgUser { id: string; email: string; full_name: string | null; is_admin: boolean; }
interface OrgBrand { id: string; name: string; category: string | null; runs_30d: number; runs_total: number; }
interface Org {
  id: string; name: string; plan: string; effective_plan: string;
  is_trial: boolean; trial_days_remaining: number | null; trial_ends_at: string | null;
  stripe_customer_id: string | null; mrr: number;
  users: OrgUser[]; brand_count: number; brands?: OrgBrand[];
  runs_30d: number; runs_total: number; last_activity: string | null; created_at: string;
}

const PLAN_BG:  Record<string, string> = { free: "rgba(100,116,139,.18)", trial: "rgba(197,242,54,.15)", starter: "rgba(59,130,246,.15)", pro: "rgba(16,163,127,.15)", agency: "rgba(139,92,246,.15)" };
const PLAN_FG:  Record<string, string> = { free: "#64748B", trial: "#C5F236", starter: "#3B82F6", pro: "#10A37F", agency: "#8B5CF6" };
const PLAN_LBL: Record<string, string> = { free: "Gratuit", trial: "Essai", starter: "Starter", pro: "Pro", agency: "Agence" };

function PlanBadge({ plan, isTrialOrg, days }: { plan: string; isTrialOrg: boolean; days: number | null }) {
  const ep = isTrialOrg ? "trial" : plan;
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: PLAN_BG[ep] ?? "var(--border)", color: PLAN_FG[ep] ?? "var(--muted)" }}>
      {PLAN_LBL[ep] ?? ep}
      {isTrialOrg && days !== null && <span className="opacity-70">• {days}j</span>}
    </span>
  );
}

function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1)  return "< 1h";
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}j`;
  return `${Math.floor(d / 30)}mois`;
}

export default function CustomersPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing,  setEditing]  = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [editTrial, setEditTrial] = useState("");
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch<Org[]>("/admin/organizations?limit=200")
      .then(setOrgs).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = orgs.filter((o) => {
    const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.users.some((u) => u.email.toLowerCase().includes(search.toLowerCase()));
    const ep = o.is_trial ? "trial" : (o.plan || "free");
    const matchPlan = planFilter === "all" || ep === planFilter;
    return matchSearch && matchPlan;
  });

  async function saveEdit(orgId: string) {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (editPlan) body.plan = editPlan;
      if (editTrial) body.trial_ends_at = new Date(editTrial).toISOString();
      await apiFetch(`/admin/organizations/${orgId}`, { method: "PATCH", body: JSON.stringify(body) });
      setEditing(null);
      load();
    } finally { setSaving(false); }
  }

  async function deleteOrg(org: Org) {
    if (!window.confirm(`Supprimer définitivement "${org.name}" et toutes ses données ?`)) return;
    setDeleting(org.id);
    try {
      await apiFetch(`/admin/organizations/${org.id}`, { method: "DELETE" });
      load();
    } finally { setDeleting(null); }
  }

  async function toggleExpand(org: Org) {
    if (expanded === org.id) { setExpanded(null); return; }
    setExpanded(org.id);
    if (!org.brands) {
      const detail = await apiFetch<Org>(`/admin/organizations/${org.id}`);
      setOrgs((prev) => prev.map((o) => o.id === org.id ? { ...o, brands: detail.brands } : o));
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="num text-3xl text-text">Clients</h1>
          <p className="mt-1 text-sm text-muted">{orgs.length} organisation{orgs.length > 1 ? "s" : ""} enregistrée{orgs.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <select
            value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-text focus:outline-none"
          >
            <option value="all">Tous les plans</option>
            <option value="free">Gratuit</option>
            <option value="trial">Essai</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="agency">Agence</option>
          </select>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted">Chargement…</p> : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg text-left">
                {["Organisation", "Plan", "MRR", "Marques", "Runs 30j", "Dernière activité", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-medium text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((org) => (
                <Fragment key={org.id}>
                  <tr
                    className="cursor-pointer border-b border-border transition-colors hover:bg-card"
                    onClick={() => toggleExpand(org)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-text">{org.name}</div>
                      <div className="text-[11px] text-muted">{org.users[0]?.email ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <PlanBadge plan={org.plan} isTrialOrg={org.is_trial} days={org.trial_days_remaining} />
                    </td>
                    <td className="num px-4 py-3 text-text">{org.mrr > 0 ? `${org.mrr} €` : "—"}</td>
                    <td className="num px-4 py-3 text-text">{org.brand_count}</td>
                    <td className="num px-4 py-3 text-text">{org.runs_30d}</td>
                    <td className="px-4 py-3 text-muted">{relativeTime(org.last_activity)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditing(editing === org.id ? null : org.id); setEditPlan(org.plan ?? "free"); setEditTrial(""); }}
                          className="rounded px-2 py-1 text-xs font-medium text-text transition-colors hover:bg-card border border-border"
                        >Modifier</button>
                        <button
                          onClick={() => deleteOrg(org)}
                          disabled={deleting === org.id}
                          className="rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-red-50 disabled:opacity-50"
                          style={{ color: "var(--bad)", border: "1px solid var(--bad)", opacity: 0.7 }}
                        >{deleting === org.id ? "…" : "Supprimer"}</button>
                      </div>
                    </td>
                  </tr>

                  {/* Edit panel */}
                  {editing === org.id && (
                    <tr key={`edit-${org.id}`} className="border-b border-border bg-card">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="flex flex-wrap items-end gap-4">
                          <div>
                            <label className="label mb-1 block">Plan</label>
                            <select value={editPlan} onChange={(e) => setEditPlan(e.target.value)}
                              className="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text focus:outline-none">
                              {["free","starter","pro","agency"].map((p) => (
                                <option key={p} value={p}>{PLAN_LBL[p]}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="label mb-1 block">Prolonger essai jusqu'au</label>
                            <input type="date" value={editTrial} onChange={(e) => setEditTrial(e.target.value)}
                              className="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text focus:outline-none" />
                          </div>
                          <div className="flex gap-2">
                            {["+7j", "+14j", "+30j"].map((label) => {
                              const days = parseInt(label);
                              return (
                                <button key={label} onClick={() => {
                                  const d = new Date(); d.setDate(d.getDate() + days);
                                  setEditTrial(d.toISOString().slice(0, 10));
                                }}
                                  className="rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-muted hover:text-text">
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                          <button onClick={() => saveEdit(org.id)} disabled={saving}
                            className="rounded-lg bg-sidebar px-4 py-1.5 text-sm font-medium text-accent disabled:opacity-50">
                            {saving ? "Enregistrement…" : "Sauvegarder"}
                          </button>
                          <button onClick={() => setEditing(null)} className="text-xs text-muted hover:text-text">Annuler</button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Expanded detail */}
                  {expanded === org.id && (
                    <tr key={`exp-${org.id}`} className="border-b border-border bg-bg">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <div className="label mb-2">Utilisateurs</div>
                            {org.users.map((u) => (
                              <div key={u.id} className="flex items-center gap-2 py-1 text-xs">
                                <span className="text-text">{u.email}</span>
                                {u.full_name && <span className="text-muted">({u.full_name})</span>}
                                {u.is_admin && <span className="rounded bg-accent px-1 text-[10px] font-bold" style={{ color: "#1C1C1A" }}>ADMIN</span>}
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className="label mb-2">Marques</div>
                            {(org.brands ?? []).map((b) => (
                              <div key={b.id} className="flex items-center justify-between py-1 text-xs">
                                <span className="text-text">{b.name}{b.category && <span className="ml-1 text-muted">({b.category})</span>}</span>
                                <span className="text-muted">{b.runs_30d} runs/30j</span>
                              </div>
                            ))}
                            {!org.brands && <span className="text-xs text-muted">Chargement…</span>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">Aucun client trouvé.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
