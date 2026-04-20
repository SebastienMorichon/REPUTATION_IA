"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { apiFetch } from "@/lib/api";

interface TimeseriesRow { period: string; total: number; done: number; failed: number; }
interface ProviderStat  { provider: string; total_runs: number; done: number; success_rate: number; avg_latency_ms: number | null; }
interface RecentRun     { id: string; provider: string; model: string; status: string; latency_ms: number | null; created_at: string; prompt_text: string | null; brand_name: string | null; org_name: string | null; }

const STATUS_COLOR: Record<string, string> = { done: "var(--good)", failed: "var(--bad)", pending: "var(--warn)", running: "var(--warn)" };
const PROVIDER_COLOR: Record<string, string> = { anthropic: "#C5F236", openai: "#10A37F", perplexity: "#6366F1" };

function fmt(iso: string, gran: string) {
  const d = new Date(iso);
  if (gran === "hour")  return d.toLocaleString("fr-FR",  { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  if (gran === "month") return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

const PAGE_SIZE = 50;

export default function UsagePage() {
  const [gran,     setGran]     = useState<"hour" | "day" | "month">("day");
  const [days,     setDays]     = useState(30);
  const [series,   setSeries]   = useState<TimeseriesRow[]>([]);
  const [providers,setProviders]= useState<ProviderStat[]>([]);
  const [runs,     setRuns]     = useState<RecentRun[]>([]);
  const [page,     setPage]     = useState(0);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const periodDays = gran === "month" ? 365 : gran === "hour" ? 2 : days;
    setLoading(true);
    Promise.all([
      apiFetch<TimeseriesRow[]>(`/admin/usage/timeseries?granularity=${gran}&days=${periodDays}`),
      apiFetch<ProviderStat[]>(`/admin/usage/providers?days=${days}`),
      apiFetch<RecentRun[]>("/admin/runs/recent?limit=200"),
    ]).then(([s, p, r]) => { setSeries(s); setProviders(p); setRuns(r); setPage(0); })
      .finally(() => setLoading(false));
  }, [gran, days]);

  const chartData  = series.map((r) => ({ ...r, label: fmt(r.period, gran) }));
  const pageRuns   = runs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(runs.length / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="num text-3xl text-text">Usage</h1>
          <p className="mt-1 text-sm text-muted">Analyses et performance des providers.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Période :</span>
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={days === d ? { background: "var(--sidebar)", color: "#E4E2DC" } : { background: "var(--border)", color: "var(--muted)" }}>
              {d === 7 ? "7j" : d === 30 ? "30j" : "90j"}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-sm text-muted">Chargement…</p> : (
        <>
          {/* Volume chart */}
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <div className="label">Volume d'analyses</div>
              <div className="flex gap-1">
                {(["hour","day","month"] as const).map((g) => (
                  <button key={g} onClick={() => setGran(g)}
                    className="rounded-lg px-3 py-1 text-xs font-medium transition-colors"
                    style={gran === g ? { background: "var(--sidebar)", color: "#E4E2DC" } : { background: "var(--border)", color: "var(--muted)" }}>
                    {g === "hour" ? "Heure" : g === "day" ? "Jour" : "Mois"}
                  </button>
                ))}
              </div>
            </div>
            {chartData.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted">Aucune donnée sur cette période</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
                  <Bar dataKey="done"   fill="var(--accent)"  name="Succès"  radius={[4,4,0,0]} stackId="a" />
                  <Bar dataKey="failed" fill="var(--bad)"     name="Erreurs" radius={[4,4,0,0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Providers */}
          <div className="grid gap-4 sm:grid-cols-3">
            {providers.map((p) => (
              <div key={p.provider} className="card">
                <div className="flex items-center justify-between">
                  <span className="font-semibold capitalize text-text">{p.provider}</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: PROVIDER_COLOR[p.provider] ?? "var(--muted)" }} />
                </div>
                <div className="num mt-3 text-3xl text-text">{p.total_runs.toLocaleString("fr-FR")}</div>
                <div className="mt-1 text-xs text-muted">analyses sur {days} jours</div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Taux de succès</span>
                    <span className="font-semibold" style={{ color: p.success_rate >= 95 ? "var(--good)" : "var(--warn)" }}>{p.success_rate} %</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full" style={{ width: `${p.success_rate}%`, background: p.success_rate >= 95 ? "var(--good)" : "var(--warn)" }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Latence moy.</span>
                    <span className="text-text">{p.avg_latency_ms ? `${p.avg_latency_ms} ms` : "—"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent runs table */}
          <div className="card overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="label">Tous les runs récents</div>
              <span className="text-xs text-muted">{runs.length} entrées</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg text-left">
                    {["Horodatage","Organisation","Marque","Provider","Statut","Latence","Prompt"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-xs font-medium text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRuns.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-card">
                      <td className="px-4 py-2 text-xs text-muted whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("fr-FR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                      </td>
                      <td className="px-4 py-2 text-xs text-text">{r.org_name ?? "—"}</td>
                      <td className="px-4 py-2 text-xs text-muted">{r.brand_name ?? "—"}</td>
                      <td className="px-4 py-2 text-xs capitalize text-text">{r.provider}</td>
                      <td className="px-4 py-2">
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                          style={{ color: STATUS_COLOR[r.status] ?? "var(--muted)", background: `${STATUS_COLOR[r.status] ?? "var(--muted)"}20` }}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted">{r.latency_ms ? `${r.latency_ms} ms` : "—"}</td>
                      <td className="px-4 py-2 max-w-[240px] truncate text-xs text-muted" title={r.prompt_text ?? ""}>
                        {r.prompt_text ? `« ${r.prompt_text} »` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                  className="rounded-lg border border-border px-3 py-1 text-xs text-muted hover:text-text disabled:opacity-40">
                  ← Précédent
                </button>
                <span className="text-xs text-muted">Page {page + 1} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="rounded-lg border border-border px-3 py-1 text-xs text-muted hover:text-text disabled:opacity-40">
                  Suivant →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
