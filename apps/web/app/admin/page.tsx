"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { apiFetch } from "@/lib/api";

interface AdminStats {
  total_organizations: number;
  total_users: number;
  new_organizations_30d: number;
  active_trials: number;
  plan_distribution: Record<string, number>;
  estimated_mrr: number;
  estimated_arr: number;
  runs_last_1h: number;
  runs_last_24h: number;
  runs_last_7d: number;
  runs_last_30d: number;
  runs_all_time: number;
  success_rate_30d: number | null;
  avg_latency_ms_7d: number | null;
  total_brands: number;
  total_prompts: number;
  provider_usage_30d: Record<string, number>;
}

interface TimeseriesRow { period: string; total: number; done: number; failed: number; }
interface ProviderUsage { provider: string; total_runs: number; done: number; success_rate: number; avg_latency_ms: number | null; }
interface RecentRun { id: string; provider: string; model: string; status: string; latency_ms: number | null; created_at: string; prompt_text: string | null; brand_name: string | null; org_name: string | null; org_id: string | null; }

const PLAN_COLORS: Record<string, string> = {
  free: "rgba(100,116,139,0.25)", trial: "rgba(197,242,54,0.2)",
  starter: "rgba(59,130,246,0.2)", pro: "rgba(16,163,127,0.2)", agency: "rgba(139,92,246,0.2)",
};
const PLAN_FG: Record<string, string> = {
  free: "#64748B", trial: "#C5F236", starter: "#3B82F6", pro: "#10A37F", agency: "#8B5CF6",
};
const PLAN_LABELS: Record<string, string> = {
  free: "Gratuit", trial: "Essai", starter: "Starter", pro: "Pro", agency: "Agence",
};
const STATUS_COLOR: Record<string, string> = { done: "var(--good)", failed: "var(--bad)", pending: "var(--warn)", running: "var(--warn)" };

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <div className="label mb-1">{label}</div>
      <div className="num text-3xl text-text">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function fmt(iso: string, gran: string) {
  const d = new Date(iso);
  if (gran === "hour") return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  if (gran === "month") return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesRow[]>([]);
  const [providers, setProviders] = useState<ProviderUsage[]>([]);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [gran, setGran] = useState<"hour" | "day" | "month">("day");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<AdminStats>("/admin/stats"),
      apiFetch<ProviderUsage[]>("/admin/usage/providers"),
      apiFetch<RecentRun[]>("/admin/runs/recent?limit=20"),
    ]).then(([s, p, r]) => { setStats(s); setProviders(p); setRecentRuns(r); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const days = gran === "month" ? 365 : gran === "hour" ? 2 : 30;
    apiFetch<TimeseriesRow[]>(`/admin/usage/timeseries?granularity=${gran}&days=${days}`)
      .then(setTimeseries).catch(() => {});
  }, [gran]);

  if (loading) return <p className="text-sm text-muted">Chargement…</p>;
  if (!stats) return <p className="text-sm text-bad">Erreur de chargement.</p>;

  const chartData = timeseries.map((r) => ({ ...r, label: fmt(r.period, gran) }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="num text-3xl text-text">Administration</h1>
        <p className="mt-1 text-sm text-muted">Vue globale de la plateforme.</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="MRR estimé" value={`${stats.estimated_mrr} €`} sub={`ARR : ${stats.estimated_arr} €`} />
        <KpiCard label="Analyses (30j)" value={stats.runs_last_30d.toLocaleString("fr-FR")} sub={`Total : ${stats.runs_all_time}`} />
        <KpiCard label="Clients" value={stats.total_organizations} sub={`${stats.new_organizations_30d} nouveaux ce mois`} />
        <KpiCard label="Taux de succès" value={stats.success_rate_30d !== null ? `${stats.success_rate_30d} %` : "—"} sub={stats.avg_latency_ms_7d ? `Latence moy. ${stats.avg_latency_ms_7d} ms` : undefined} />
      </div>

      {/* Sub-stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "1 heure", val: stats.runs_last_1h },
          { label: "24 heures", val: stats.runs_last_24h },
          { label: "7 jours", val: stats.runs_last_7d },
          { label: "30 jours", val: stats.runs_last_30d },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
            <div className="num text-xl text-text">{s.val}</div>
            <div className="text-[11px] text-muted">Analyses / {s.label}</div>
          </div>
        ))}
      </div>

      {/* Plans distribution */}
      <div className="card">
        <div className="label mb-3">Répartition des plans</div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(stats.plan_distribution).map(([plan, count]) => (
            <div key={plan} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: PLAN_COLORS[plan] ?? "var(--border)" }}>
              <span className="text-sm font-semibold" style={{ color: PLAN_FG[plan] ?? "var(--text)" }}>
                {PLAN_LABELS[plan] ?? plan}
              </span>
              <span className="num text-lg text-text">{count}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
            <span className="text-sm text-muted">Essais actifs</span>
            <span className="num text-lg text-text">{stats.active_trials}</span>
          </div>
        </div>
      </div>

      {/* Timeseries chart */}
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <div className="label">Volume d'analyses</div>
          <div className="flex gap-1">
            {(["hour", "day", "month"] as const).map((g) => (
              <button key={g} onClick={() => setGran(g)}
                className="rounded-lg px-3 py-1 text-xs font-medium transition-colors"
                style={gran === g ? { background: "var(--sidebar)", color: "#E4E2DC" } : { background: "var(--border)", color: "var(--muted)" }}>
                {g === "hour" ? "Heure" : g === "day" ? "Jour" : "Mois"}
              </button>
            ))}
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted">Pas encore de données</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Total" />
              <Bar dataKey="failed" fill="var(--bad)" radius={[4, 4, 0, 0]} name="Erreurs" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Providers */}
      <div className="card">
        <div className="label mb-3">Providers LLM — 30 derniers jours</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {["Provider", "Runs", "Succès", "Taux", "Latence moy."].map((h) => (
                  <th key={h} className="pb-2 pr-6 text-xs font-medium text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.provider} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-6 font-medium text-text capitalize">{p.provider}</td>
                  <td className="num py-2.5 pr-6 text-text">{p.total_runs}</td>
                  <td className="num py-2.5 pr-6 text-text">{p.done}</td>
                  <td className="py-2.5 pr-6">
                    <span className="rounded px-1.5 py-0.5 text-xs font-semibold" style={{ background: p.success_rate >= 95 ? "rgba(16,163,127,0.1)" : "rgba(217,64,64,0.1)", color: p.success_rate >= 95 ? "var(--good)" : "var(--bad)" }}>
                      {p.success_rate} %
                    </span>
                  </td>
                  <td className="py-2.5 text-muted">{p.avg_latency_ms ? `${p.avg_latency_ms} ms` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent runs */}
      <div className="card">
        <div className="label mb-3">Derniers runs</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {["Heure", "Organisation", "Marque", "Provider", "Statut", "Latence"].map((h) => (
                  <th key={h} className="pb-2 pr-4 text-xs font-medium text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-card">
                  <td className="py-2 pr-4 text-xs text-muted">{new Date(r.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="py-2 pr-4 text-xs text-text">{r.org_name ?? "—"}</td>
                  <td className="py-2 pr-4 text-xs text-muted">{r.brand_name ?? "—"}</td>
                  <td className="py-2 pr-4 text-xs capitalize text-text">{r.provider}</td>
                  <td className="py-2 pr-4">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ color: STATUS_COLOR[r.status] ?? "var(--muted)", background: `${STATUS_COLOR[r.status] ?? "var(--muted)"}1a` }}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-muted">{r.latency_ms ? `${r.latency_ms} ms` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
