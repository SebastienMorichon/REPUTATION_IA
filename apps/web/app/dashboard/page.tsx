"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch, type Brand, type ProviderStatus, type Scores, type PromptRun } from "@/lib/api";
import { formatPct } from "@/lib/utils";

interface Snapshot {
  period_end: string;
  visibility_score: number;
  share_of_voice: number;
  sentiment_score: number;
  citation_score: number;
  runs_count: number;
}

interface Alert {
  id: string;
  kind: "failed" | "absent" | "negative" | "new_citation";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  created_at: string;
}

export default function DashboardHome() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // Single brand focus
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [scores, setScores] = useState<Scores | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [recentRuns, setRecentRuns] = useState<PromptRun[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [brandLoading, setBrandLoading] = useState(false);

  const enabledProviders = providers.filter((p) => p.enabled);

  // Load brands and select first/only one
  useEffect(() => {
    Promise.all([
      apiFetch<Brand[]>("/brands"),
      apiFetch<ProviderStatus[]>("/providers")
    ])
      .then(([b, p]) => {
        setBrands(b);
        setProviders(p);
        if (b.length > 0) {
          const first = b[0].id;
          setSelectedBrandId(first);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Load brand data when selection changes
  const loadBrandData = useCallback(async (brandId: string) => {
    setBrandLoading(true);
    try {
      const [b, s, snaps, runs, alts] = await Promise.all([
        apiFetch<Brand>(`/brands/${brandId}`),
        apiFetch<Scores>(`/brands/${brandId}/scores?days=30`).catch(() => null),
        apiFetch<Snapshot[]>(`/brands/${brandId}/scores/snapshots`).catch(() => []),
        apiFetch<PromptRun[]>(`/brands/${brandId}/runs?limit=20`).catch(() => []),
        apiFetch<Alert[]>(`/brands/${brandId}/alerts?days=7`).catch(() => []),
      ]);
      setSelectedBrand(b);
      setScores(s);
      setSnapshots(snaps);
      setRecentRuns(runs);
      setAlerts(alts);
    } catch (e) {
      console.error("Failed to load brand data:", e);
    } finally {
      setBrandLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBrandId) {
      loadBrandData(selectedBrandId);
    }
  }, [selectedBrandId, loadBrandData]);

  // Compute overall score (weighted average of all metrics)
  const computeOverallScore = (): number | null => {
    if (!scores) return null;
    const weights = { visibility: 0.35, sov: 0.25, sentiment: 0.25, citation: 0.15 };
    return Math.round(
      scores.visibility_score * weights.visibility +
      scores.share_of_voice * weights.sov +
      scores.sentiment_score * weights.sentiment +
      scores.citation_score * weights.citation
    );
  };

  const overallScore = computeOverallScore();

  const getScoreGrade = (score: number | null): { grade: string; color: string; label: string } => {
    if (score === null) return { grade: "—", color: "var(--muted)", label: "En attente" };
    if (score >= 75) return { grade: "A", color: "var(--good)", label: "Excellent" };
    if (score >= 60) return { grade: "B", color: "var(--accent)", label: "Bon" };
    if (score >= 45) return { grade: "C", color: "var(--warn)", label: "Moyen" };
    if (score >= 30) return { grade: "D", color: "orange", label: "Faible" };
    return { grade: "E", color: "var(--bad)", label: "Critique" };
  };

  const scoreGrade = getScoreGrade(overallScore);

  // Compute trend from snapshots
  const computeTrend = (): number | null => {
    if (snapshots.length < 2) return null;
    const latest = snapshots[snapshots.length - 1];
    const previous = snapshots[snapshots.length - 2];
    const latestScore = latest.visibility_score * 0.35 + latest.share_of_voice * 0.25 + latest.sentiment_score * 0.25 + latest.citation_score * 0.15;
    const previousScore = previous.visibility_score * 0.35 + previous.share_of_voice * 0.25 + previous.sentiment_score * 0.25 + previous.citation_score * 0.15;
    return Math.round(latestScore - previousScore);
  };

  const trend = computeTrend();

  // Generate insights from runs
  const generateInsights = (): string[] => {
    const insights: string[] = [];
    if (!scores || recentRuns.length === 0) return insights;

    // Low visibility
    if (scores.visibility_score < 40) {
      insights.push("Votre visibilité est faible — augmentez votre présence en ligne");
    }

    // Missing brand mentions
    const absentRuns = recentRuns.filter(r =>
      r.status === "done" &&
      !r.mentions.some(m => m.is_target_brand)
    );
    if (absentRuns.length > recentRuns.length / 2) {
      insights.push("Votre marque n'est pas citée dans la majorité des réponses IA");
    }

    // Competitor dominance
    if (scores.share_of_voice < 20) {
      insights.push("Vos concurrents dominent les mentions IA");
    }

    // Negative sentiment
    const negativeMentions = recentRuns.flatMap(r =>
      r.mentions.filter(m => m.is_target_brand && m.sentiment === "negative")
    );
    if (negativeMentions.length > 0) {
      insights.push("Des mentions négatives ont été détectées");
    }

    // Low citations
    if (scores.citation_score < 30) {
      insights.push("Peu de sources externes vous citent — travaillez votre e-réputation");
    }

    return insights.slice(0, 4);
  };

  const insights = generateInsights();

  if (loading) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  // No brands — onboarding
  if (brands.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="num text-3xl text-text">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Analysez comment les IA parlent de votre marque.
          </p>
        </div>

        <div className="card text-center py-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl" style={{ background: "var(--accent)/20" }}>
            🎯
          </div>
          <h2 className="text-xl font-semibold text-text">Commencez votre analyse</h2>
          <p className="mt-2 text-sm text-muted max-w-md mx-auto">
            Créez votre première marque pour lancer un scan de réputation IA et découvrir comment ChatGPT, Claude et Perplexity parlent de vous.
          </p>
          <Link href="/dashboard/brands/new" className="btn-primary mt-6 inline-flex">
            Créer ma première marque →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with brand switcher */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="num text-3xl text-text">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Pilotage de réputation IA.
          </p>
        </div>

        {/* Brand switcher for multi-brand users */}
        {brands.length > 1 && (
          <select
            className="input h-10 w-64 text-sm"
            value={selectedBrandId ?? ""}
            onChange={(e) => setSelectedBrandId(e.target.value)}
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      {brandLoading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : !selectedBrand ? (
        <p className="text-sm text-bad">Marque introuvable</p>
      ) : (
        <>
          {/* Hero: Score + Statut + Tendance */}
          <div className="card-feat">
            <div className="flex flex-wrap items-start justify-between gap-6">
              {/* Main score */}
              <div className="flex items-center gap-4">
                <div
                  className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl text-2xl font-bold"
                  style={{
                    background: scoreGrade.color,
                    color: "white",
                    border: `2px solid ${scoreGrade.color}40`
                  }}
                >
                  {scoreGrade.grade}
                </div>
                <div>
                  <div className="text-sm text-muted">Score de réputation IA</div>
                  <div className="flex items-center gap-2">
                    <span className="num text-4xl font-bold text-text">{overallScore ?? "—"}/100</span>
                    {trend !== null && (
                      <span
                        className="flex items-center text-sm font-medium"
                        style={{ color: trend >= 0 ? "var(--good)" : "var(--bad)" }}
                      >
                        {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)} pts
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: scoreGrade.color }}>{scoreGrade.label}</div>
                </div>
              </div>

              {/* Brand info */}
              <div className="text-right">
                <div className="text-lg font-semibold text-text">{selectedBrand.name}</div>
                {selectedBrand.domain && (
                  <div className="text-xs text-muted">{selectedBrand.domain}</div>
                )}
                {selectedBrand.category && (
                  <div className="mt-1 inline-flex rounded-md border border-border px-2 py-0.5 text-xs text-muted">
                    {selectedBrand.category}
                  </div>
                )}
                <Link
                  href={`/dashboard/brands/${selectedBrand.id}`}
                  className="btn-dark mt-3 inline-flex text-xs"
                >
                  Voir le détail →
                </Link>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div>
              <div className="label mb-2">🚨 Alertes récentes</div>
              <div className="space-y-2">
                {alerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-xl border px-4 py-3"
                    style={{
                      background: alert.severity === "high"
                        ? "rgba(217,64,64,0.1)"
                        : alert.severity === "medium"
                        ? "rgba(201,123,24,0.1)"
                        : "rgba(100,116,139,0.1)",
                      borderColor: alert.severity === "high"
                        ? "rgba(217,64,64,0.3)"
                        : alert.severity === "medium"
                        ? "rgba(201,123,24,0.3)"
                        : "var(--border)",
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-sm" style={{
                          color: alert.severity === "high" ? "var(--bad)" : alert.severity === "medium" ? "var(--warn)" : "var(--muted)"
                        }}>
                          {alert.title}
                        </div>
                        <div className="mt-1 text-xs text-muted">{alert.description}</div>
                      </div>
                      <Link
                        href={`/dashboard/brands/${selectedBrand.id}`}
                        className="text-xs text-text hover:underline"
                      >
                        Voir →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {insights.length > 0 && (
            <div>
              <div className="label mb-2">🔍 Insights — Ce que les IA disent</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {insights.map((insight, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-bg p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-lg">💡</div>
                      <div className="text-sm text-muted">{insight}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KPI row */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="card">
              <div className="text-xs text-muted">Visibilité</div>
              <div className="mt-1 num text-2xl font-bold" style={{ color: scores && scores.visibility_score >= 60 ? "var(--good)" : scores && scores.visibility_score >= 30 ? "var(--warn)" : "var(--bad)" }}>
                {formatPct(scores?.visibility_score)}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-muted">Part de voix</div>
              <div className="mt-1 num text-2xl font-bold" style={{ color: scores && scores.share_of_voice >= 50 ? "var(--good)" : scores && scores.share_of_voice >= 20 ? "var(--warn)" : "var(--bad)" }}>
                {formatPct(scores?.share_of_voice)}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-muted">Sentiment</div>
              <div className="mt-1 num text-2xl font-bold" style={{ color: scores && scores.sentiment_score >= 60 ? "var(--good)" : scores && scores.sentiment_score >= 30 ? "var(--warn)" : "var(--bad)" }}>
                {formatPct(scores?.sentiment_score)}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-muted">Citations</div>
              <div className="mt-1 num text-2xl font-bold" style={{ color: scores && scores.citation_score >= 50 ? "var(--good)" : scores && scores.citation_score >= 20 ? "var(--warn)" : "var(--bad)" }}>
                {formatPct(scores?.citation_score)}
              </div>
            </div>
          </div>

          {/* Activity feed */}
          <div className="card">
            <div className="label mb-4">Activité récente</div>
            {recentRuns.length === 0 ? (
              <p className="text-sm text-muted">Aucune activité. Lancez un premier scan.</p>
            ) : (
              <div className="space-y-3">
                {recentRuns.slice(0, 5).map((run) => (
                  <div key={run.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-2 w-2 rounded-full"
                        style={{
                          background: run.status === "done" ? "var(--good)" : run.status === "failed" ? "var(--bad)" : "var(--warn)"
                        }}
                      />
                      <span className="text-muted capitalize">[{run.provider}]</span>
                      <span className="text-text truncate max-w-[300px]">
                        {run.prompt?.text?.slice(0, 50) ?? "Prompt supprimé"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {run.status === "done" && run.mentions.some(m => m.is_target_brand) && (
                        <span className="text-xs" style={{ color: "var(--good)" }}>✓ Cité</span>
                      )}
                      <span className="text-xs text-muted">
                        {new Date(run.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Provider coverage */}
          <div className="card">
            <div className="label mb-4">Couverture IA</div>
            <div className="flex flex-wrap gap-3">
              {providers.map((p) => {
                const hasRun = recentRuns.some(r => r.provider === p.name && r.status === "done");
                return (
                  <div
                    key={p.name}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                    style={{
                      borderColor: p.enabled ? (hasRun ? "var(--good)" : "var(--border)") : "var(--border)",
                      background: p.enabled ? (hasRun ? "var(--good)/10" : "transparent") : "var(--border)/10",
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: p.enabled ? (hasRun ? "var(--good)" : "var(--warn)") : "var(--muted)" }}
                    />
                    <span className="font-medium capitalize text-text">{p.name}</span>
                    {!p.enabled && <span className="text-muted italic">(désactivé)</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/dashboard/brands/${selectedBrand.id}`}
              className="btn-primary"
            >
              ▶ Lancer un scan complet
            </Link>
            <Link
              href="/dashboard/brands/new"
              className="btn-ghost border border-border"
            >
              + Ajouter une marque
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
