"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Kpi } from "@/components/Kpi";
import { SovBar } from "@/components/SovBar";
import { VisibilityChart } from "@/components/VisibilityChart";
import { SentimentDonut } from "@/components/SentimentDonut";
import { InfoTooltip } from "@/components/InfoTooltip";
import { CompetitorRadar } from "@/components/CompetitorRadar";
import { TrendChart } from "@/components/TrendChart";
import {
  API_URL, apiFetch, getToken, patchBrand, type Brand, type BrandReport, type Competitor, type Prompt,
  type PromptRun, type ProviderStatus, type Scores, type BillingSubscription,
} from "@/lib/api";
import { formatPct } from "@/lib/utils";

type PageProps = { params: Promise<{ id: string }> };

interface RadarEntry {
  name: string;
  is_target: boolean;
  visibility: number;
  share_of_mentions: number;
}

interface RadarData {
  entries: RadarEntry[];
  period_days: number;
  runs_count: number;
}

interface Snapshot {
  period_end: string;
  visibility_score: number;
  share_of_voice: number;
  sentiment_score: number;
  citation_score: number;
  runs_count: number;
}

/* ─── helpers ───────────────────────────────────────────── */

type HeatCellStatus = "cited" | "absent" | "pending" | "failed" | "none";
type HeatCell = { status: HeatCellStatus; rank: number | null; runId: string | null };
type HeatRow  = { prompt: Prompt; cells: Record<string, HeatCell> };

function buildHeatmap(prompts: Prompt[], runs: PromptRun[]): HeatRow[] {
  return prompts.map((p) => {
    const cells: Record<string, HeatCell> = {};
    // All runs for this prompt, newest first — newest per provider wins
    const promptRuns = runs
      .filter((r) => r.prompt_id === p.id)
      .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));

    promptRuns.forEach((r) => {
      if (cells[r.provider]) return; // already have a newer run for this provider
      if (r.status === "done") {
        const targetMention = r.mentions.find((m) => m.is_target_brand);
        cells[r.provider] = {
          status: targetMention ? "cited" : "absent",
          rank: targetMention?.rank_position ?? null,
          runId: r.id,
        };
      } else if (r.status === "failed") {
        cells[r.provider] = { status: "failed", rank: null, runId: r.id };
      } else {
        cells[r.provider] = { status: "pending", rank: null, runId: r.id };
      }
    });
    return { prompt: p, cells };
  });
}

function buildDailySeries(runs: PromptRun[]): { date: string; visibility: number }[] {
  const byDay: Record<string, { total: number; present: number }> = {};
  runs
    .filter((r) => r.status === "done" && r.executed_at)
    .forEach((r) => {
      const day = r.executed_at!.slice(0, 10);
      if (!byDay[day]) byDay[day] = { total: 0, present: 0 };
      byDay[day].total += 1;
      if (r.mentions.some((m) => m.is_target_brand)) byDay[day].present += 1;
    });
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { total, present }]) => ({
      date,
      visibility: total ? Math.round((present / total) * 100) : 0,
    }));
}

function buildSentimentCounts(runs: PromptRun[]) {
  let pos = 0, neu = 0, neg = 0;
  runs.filter((r) => r.status === "done").forEach((r) => {
    r.mentions.filter((m) => m.is_target_brand).forEach((m) => {
      if (m.sentiment === "positive") pos++;
      else if (m.sentiment === "negative") neg++;
      else if (m.sentiment === "cautious") neg++;
      else neu++;
    });
  });
  return { positive: pos, neutral: neu, negative: neg };
}

/* Rank cell rendering helpers */
function cellBg(cell: HeatCell | undefined): string {
  if (!cell || cell.status === "none") return "var(--border)";
  if (cell.status === "pending")       return "var(--warn)/20";
  if (cell.status === "failed")        return "var(--bad)/15";
  if (cell.status === "absent")        return "var(--border)";
  const r = cell.rank;
  // Rang 1 : accent foncé (visible dans les 2 thèmes)
  if (r === 1) return "var(--accent)";
  // Rang 2-4 : versions plus claires de l'accent
  if (r === 2) return "var(--accent)/85";
  if (r === 3) return "var(--accent)/70";
  return "var(--accent)/55";
}
function cellText(cell: HeatCell | undefined): string {
  if (!cell || cell.status === "none")  return "—";
  if (cell.status === "pending")        return "⏳";
  if (cell.status === "failed")         return "✗";
  if (cell.status === "absent")         return "○";
  return cell.rank != null ? `#${cell.rank}` : "✓";
}
function cellTextColor(cell: HeatCell | undefined): string {
  if (!cell || cell.status === "none")   return "var(--muted)";
  if (cell.status === "failed")          return "var(--bad)";
  if (cell.status === "pending")         return "var(--warn)";
  if (cell.status === "absent")          return "var(--muted)";
  // Rang 1-2 : texte clair, Rang 3+ : texte foncé
  const r = cell.rank;
  return r != null && r <= 2 ? "var(--accent-fg)" : "var(--text)";
}
function cellTitle(cell: HeatCell | undefined): string {
  if (!cell || cell.status === "none")  return "Pas encore analysé";
  if (cell.status === "pending")        return "Analyse en cours…";
  if (cell.status === "failed")         return "Erreur lors de l'analyse";
  if (cell.status === "absent")         return "Marque non citée dans cette réponse";
  return cell.rank != null ? `Citée en position #${cell.rank}` : "Citée";
}

/* ─── Prompt Strategy constants ─────────────────────────── */

const STRATEGY_CATS = [
  { key: "discovery",  title: "Discovery",  emoji: "🔍", color: "#6366F1",
    what: "Mesure si votre marque apparaît spontanément quand un utilisateur cherche une solution, sans citer votre nom.",
    how:  "Idéalement 40 % du portfolio. Une forte présence ici signifie que les IA vous recommandent naturellement sans que le prospect vous connaisse.",
    tips: "C'est le signal le plus décisif pour la réputation décisionnelle.",
    desc: "Recommandation spontanée" },
  { key: "comparison", title: "Comparison", emoji: "⚖️", color: "#0EA5E9",
    what: "Mesure si votre marque est préférée lorsqu'elle est comparée à d'autres acteurs.",
    how:  "Idéalement 25 % du portfolio. Mesure votre dominance quand les IA comparent plusieurs acteurs.",
    tips: "Très utile pour surveiller vos concurrents directs.",
    desc: "Comparaison concurrentielle" },
  { key: "reputation", title: "Reputation", emoji: "💬", color: "#F59E0B",
    what: "Mesure ce que les IA disent explicitement de votre marque : confiance, avis, risques ou perception.",
    how:  "Idéalement 20 % du portfolio. Révèle le narratif construit par les IA sur votre marque.",
    tips: "Surveiller régulièrement pour détecter les biais négatifs.",
    desc: "Fiabilité et confiance" },
  { key: "authority",  title: "Authority",  emoji: "🏆", color: "#10B981",
    what: "Mesure si votre marque est reconnue comme une référence crédible dans son domaine.",
    how:  "Idéalement 15 % du portfolio. Mesure si les IA vous citent comme expert ou leader sectoriel.",
    tips: "Publiez du contenu expert et obtenez des mentions dans des sources de référence.",
    desc: "Expertise sectorielle" },
] as const;

const SCOPE_INFO = {
  core: {
    label: "Core",
    badge: "Benchmark",
    emoji: "🎯",
    color: "#8B5CF6",
    tooltipTitle: "Core Prompts",
    tooltipWhat: "Questions standardisées utilisées pour le benchmark.",
    tooltipHow: "16 questions fixes, identiques pour toutes les marques d'un même secteur. Elles permettent de comparer votre marque à vos concurrents de façon fiable.",
    tooltipTips: "Votre Benchmark Score est calculé uniquement sur ces prompts.",
  },
  strategic: {
    label: "Strategic",
    badge: "Opportunités",
    emoji: "🚀",
    color: "#06B6D4",
    tooltipTitle: "Strategic Prompts",
    tooltipWhat: "Questions personnalisées utilisées pour détecter les opportunités business.",
    tooltipHow: "8 questions adaptées à votre marque, vos offres et vos concurrents. Elles servent à identifier les gains actionnables.",
    tooltipTips: "Votre Opportunity Score est calculé uniquement sur ces prompts. Ne pas utiliser pour comparer deux entreprises.",
  },
} as const;

const PRIO_COLOR: Record<string, string> = { critical: "var(--bad)", high: "var(--warn)", medium: "var(--accent)", low: "var(--muted)" };
const PRIO_LABEL: Record<string, string> = { critical: "Critique", high: "Haute", medium: "Moyenne", low: "Faible" };
const DIFF_COLOR: Record<string, string> = { easy: "var(--good)", medium: "var(--warn)", hard: "var(--bad)" };
const DIFF_LABEL: Record<string, string> = { easy: "Facile", medium: "Moyen", hard: "Difficile" };
function bvColor(v: number) { return v >= 80 ? "var(--good)" : v >= 60 ? "var(--warn)" : "var(--muted)"; }

/* ─── component ─────────────────────────────────────────── */

export default function BrandDetailPage({ params }: PageProps) {
  const { id } = use(params);

  const [brand, setBrand] = useState<Brand | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [runs, setRuns] = useState<PromptRun[]>([]);
  const [scores, setScores] = useState<Scores | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [generating, setGenerating] = useState(false);

  // location for geographically-anchored question generation
  const [generateLocation, setGenerateLocation] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`reputation.gen-location.${id}`) ?? "";
    }
    return "";
  });

  // forms
  const [newComp, setNewComp] = useState({ name: "", domain: "" });
  const [newPromptText, setNewPromptText] = useState("");

  // surveillance settings
  const [schedule, setSchedule] = useState<string>("none");
  const [alertEmail, setAlertEmail] = useState<string>("");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  // Billing/limits state
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Reports state
  const [reportList, setReportList] = useState<BrandReport[]>([]);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Prompt Strategy — group prompts by scope AND category (two-level)
  const grouped = useMemo(() => {
    const g: Record<string, Record<string, Prompt[]>> = {
      core:     { discovery: [], comparison: [], reputation: [], authority: [] },
      strategic:{ discovery: [], comparison: [], reputation: [], authority: [] },
    };
    for (const p of prompts) {
      const scope = p.prompt_scope === "core" ? "core" : "strategic";
      const cat = p.prompt_category ?? (p.is_brand_mentioned ? "reputation" : "discovery");
      if (cat in g[scope]) g[scope][cat].push(p); else g[scope].discovery.push(p);
    }
    return g;
  }, [prompts]);

  // Sync surveillance state when brand loads/updates
  useEffect(() => {
    if (!brand) return;
    setSchedule(brand.run_schedule ?? "none");
    setAlertEmail(brand.alert_email ?? "");
  }, [brand]);

  // Fetch subscription info for limits
  useEffect(() => {
    apiFetch<BillingSubscription>("/billing/subscription")
      .then(setSubscription)
      .catch(() => {});
  }, []);

  async function saveSchedule(value: string) {
    setSchedule(value);
    setScheduleSaving(true);
    try {
      await patchBrand(id, { run_schedule: value });
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 2000);
    } finally {
      setScheduleSaving(false);
    }
  }

  async function saveAlertEmail() {
    setEmailSaving(true);
    try {
      await patchBrand(id, { alert_email: alertEmail });
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2000);
    } finally {
      setEmailSaving(false);
    }
  }

  const load = useCallback(async () => {
    try {
      const [b, c, p, r, s, pr, radar, snaps, rpts] = await Promise.all([
        apiFetch<Brand>(`/brands/${id}`),
        apiFetch<Competitor[]>(`/brands/${id}/competitors`),
        apiFetch<Prompt[]>(`/brands/${id}/prompts`),
        apiFetch<PromptRun[]>(`/brands/${id}/runs?limit=100`),
        apiFetch<Scores>(`/brands/${id}/scores?days=30`),
        apiFetch<ProviderStatus[]>(`/providers`),
        apiFetch<RadarData>(`/brands/${id}/scores/radar?days=30`).catch(() => null),
        apiFetch<Snapshot[]>(`/brands/${id}/scores/snapshots`).catch(() => []),
        apiFetch<BrandReport[]>(`/brands/${id}/reports`).catch(() => []),
      ]);
      setBrand(b); setCompetitors(c); setPrompts(p);
      setRuns(r); setScores(s); setProviders(pr);
      setRadarData(radar);
      setSnapshots(snaps);
      setReportList(rpts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  async function triggerRuns() {
    setRunError(null);

    // Check quota from backend (covers both free plan block and weekly limits)
    if (subscription?.quota && !subscription.quota.can_run) {
      setRunError(subscription.quota.block_reason ?? "Quota atteint. Veuillez mettre à niveau votre plan.");
      return;
    }

    setRunning(true);
    try {
      await apiFetch(`/brands/${id}/runs`, { method: "POST", body: JSON.stringify({}) });
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRunError(msg);
      setError(msg);
    } finally {
      setRunning(false);
    }
  }

  async function addCompetitor(e: React.FormEvent) {
    e.preventDefault();
    if (!newComp.name.trim()) return;
    await apiFetch(`/brands/${id}/competitors`, { method: "POST", body: JSON.stringify({ name: newComp.name, domain: newComp.domain || null }) });
    setNewComp({ name: "", domain: "" });
    load();
  }

  async function addPrompt(e: React.FormEvent) {
    e.preventDefault();
    if (!newPromptText.trim()) return;
    await apiFetch(`/brands/${id}/prompts`, { method: "POST", body: JSON.stringify({ text: newPromptText, importance: 1, enabled: true, use_web_search: false }) });
    setNewPromptText("");
    load();
  }

  async function toggleWebSearch(promptId: string, currentValue: boolean) {
    // Check plan eligibility
    if (subscription && !subscription.is_trial && subscription.effective_plan === "free") {
      setRunError("La recherche web est réservée aux plans Pro et Agence.");
      return;
    }
    await apiFetch(`/brands/${id}/prompts/${promptId}`, {
      method: "PATCH",
      body: JSON.stringify({ use_web_search: !currentValue })
    });
    load();
  }

  async function deleteCompetitor(cid: string) {
    await apiFetch(`/brands/${id}/competitors/${cid}`, { method: "DELETE" }); load();
  }

  async function deletePrompt(pid: string) {
    await apiFetch(`/brands/${id}/prompts/${pid}`, { method: "DELETE" }); load();
  }

  function handleLocationChange(v: string) {
    setGenerateLocation(v);
    if (typeof window !== "undefined") {
      if (v.trim()) localStorage.setItem(`reputation.gen-location.${id}`, v);
      else localStorage.removeItem(`reputation.gen-location.${id}`);
    }
  }

  async function generatePrompts() {
    setGenerating(true);
    setRunError(null);

    // Check if auto-generate is allowed for this plan
    if (subscription && !subscription.limits.auto_generate_prompts) {
      setRunError("La génération automatique de questions n'est pas disponible sur votre plan gratuit. Veuillez passer à un abonnement payant.");
      setGenerating(false);
      return;
    }

    try {
      const qs = generateLocation.trim()
        ? `?location=${encodeURIComponent(generateLocation.trim())}`
        : "";
      await apiFetch(`/brands/${id}/prompts/generate${qs}`, { method: "POST", body: JSON.stringify({}) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function generateReport() {
    setReportGenerating(true);
    setReportError(null);
    try {
      await apiFetch(`/brands/${id}/reports/generate`, {
        method: "POST",
        body: JSON.stringify({ period_days: 30 }),
      });
      load();
    } catch (e) {
      setReportError(e instanceof Error ? e.message : String(e));
    } finally {
      setReportGenerating(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Chargement…</p>;
  if (error)   return <p className="text-sm text-bad">{error}</p>;
  if (!brand)  return null;

  const enabledProviders = providers.filter((p) => p.enabled);
  const heatmap = buildHeatmap(prompts, runs);
  const dailySeries = buildDailySeries(runs);
  const sentiment = buildSentimentCounts(runs);
  const pendingRuns = runs.filter((r) => r.status === "pending" || r.status === "running").length;

  // SoV entries: target first, then competitors
  const sovEntries = [
    { name: brand.name, pct: scores?.share_of_voice ?? 0, isTarget: true },
    ...(scores?.top_competitors ?? []).map((c) => ({ name: c.name, pct: 0, isTarget: false })),
  ];
  // Re-derive SoV for competitors from mentions
  const allMentions = runs.flatMap((r) => r.mentions);
  const totalMentions = allMentions.length;
  const targetCount = allMentions.filter((m) => m.is_target_brand).length;
  const competitorCounts: Record<string, number> = {};
  allMentions.filter((m) => m.is_known_competitor).forEach((m) => {
    competitorCounts[m.entity_name] = (competitorCounts[m.entity_name] ?? 0) + 1;
  });
  const grandTotal = totalMentions || 1;
  const sovReal = [
    { name: brand.name, pct: (targetCount / grandTotal) * 100, isTarget: true },
    ...Object.entries(competitorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, pct: (count / grandTotal) * 100, isTarget: false })),
  ];

  return (
    <div className="space-y-6">

      {/* ── Brand header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            {brand.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="num text-3xl text-text">{brand.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              {brand.domain && <span>{brand.domain}</span>}
              {brand.domain && brand.category && <span>·</span>}
              {brand.category && <span>{brand.category}</span>}
              {pendingRuns > 0 && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
                    {pendingRuns} run{pendingRuns > 1 ? "s" : ""} en cours
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {runError && (
            <div className="max-w-xs rounded-lg border px-3 py-2 text-xs" style={{ color: "var(--bad)", background: "rgba(220,38,38,0.06)", borderColor: "rgba(220,38,38,0.2)" }}>
              {runError}
            </div>
          )}

          {/* Quota indicator */}
          {subscription?.quota && (() => {
            const q = subscription.quota!;
            const max = subscription.limits.max_runs_per_week;
            if (max === -1) return (
              <span className="text-[11px] text-muted">Runs illimités</span>
            );
            const pct = Math.min(100, Math.round((q.runs_this_week / max) * 100));
            const color = !q.can_run ? "var(--bad)" : pct >= 75 ? "var(--warn)" : "var(--muted)";
            return (
              <div className="flex flex-col items-end gap-1">
                <span className="text-[11px]" style={{ color }}>
                  {!q.can_run
                    ? "Quota atteint"
                    : `${q.runs_remaining} run${q.runs_remaining !== 1 ? "s" : ""} restant${q.runs_remaining !== 1 ? "s" : ""} / semaine`}
                </span>
                <div className="h-1 w-24 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            );
          })()}

          <button
            onClick={triggerRuns}
            className="btn-dark"
            disabled={running || prompts.length === 0 || enabledProviders.length === 0 || subscription?.quota?.can_run === false}
            title={
              prompts.length === 0 ? "Ajoute d'abord un prompt"
              : enabledProviders.length === 0 ? "Active un provider dans .env"
              : !subscription?.quota?.can_run ? (subscription?.quota?.block_reason ?? "Quota atteint")
              : undefined
            }
          >
            {running ? "Lancement…" : "▶ Lancer un run"}
          </button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi
          featured
          label="Visibilité dans les IA"
          value={formatPct(scores?.visibility_score)}
          sub={`${scores?.runs_count ?? 0} analyses · 30 j`}
          className="lg:col-span-2"
          tooltip={
            <InfoTooltip
              title="Visibilité dans les IA"
              what="Proportion de fois où votre marque est citée dans les réponses des IA sur des questions liées à votre secteur."
              how="Au-dessus de 60 % : excellent. Entre 30 et 60 % : correct. En dessous de 30 % : votre marque est peu visible."
              tips="Publiez du contenu régulier et obtenez des mentions sur des sites de référence."
            />
          }
        />
        <Kpi
          label="Présence face aux concurrents"
          value={formatPct(scores?.share_of_voice)}
          subUp={(scores?.share_of_voice ?? 0) > 30}
          sub="30 j"
          tooltip={
            <InfoTooltip
              title="Présence face aux concurrents"
              what="Sur l'ensemble des réponses IA, quelle portion vous est consacrée comparé à vos concurrents."
              how="50 % = vous êtes autant mentionné que tous vos concurrents réunis. En dessous de 20 % : vos concurrents dominent."
            />
          }
        />
        <Kpi
          label="Image perçue"
          value={formatPct(scores?.sentiment_score)}
          subUp={(scores?.sentiment_score ?? 0) > 50}
          sub="30 j"
          tooltip={
            <InfoTooltip
              title="Image perçue"
              what="Le ton utilisé par les IA pour parler de vous : positif, neutre ou négatif."
              how="Au-dessus de 60 % : image positive. Entre 30 et 60 % : ton neutre. En dessous de 30 % : des éléments négatifs ressortent."
              tips="Consultez les analyses individuelles pour identifier quels sujets génèrent un ton négatif."
            />
          }
        />
        <Kpi
          label="Sources qui vous citent"
          value={formatPct(scores?.citation_score)}
          subUp={(scores?.citation_score ?? 0) > 30}
          sub="30 j"
          tooltip={
            <InfoTooltip
              title="Sources qui vous citent"
              what="Pourcentage de réponses IA qui mentionnent une source externe liée à votre marque (articles, sites…)."
              how="Au-dessus de 50 % : bonne couverture. Entre 20 et 50 % : partielle. En dessous de 20 % : peu de sources vous relaient."
              tips="Visez des publications dans des médias spécialisés et des annuaires professionnels."
            />
          }
        />
      </div>

      {/* ── Visibility chart + breakdown par modèle ── */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="card lg:col-span-3">
          <div className="label">Visibilité IA — 30 jours</div>
          <p className="mb-4 text-sm text-muted">Part des réponses mentionnant la marque</p>
          <VisibilityChart data={dailySeries} />
        </div>

        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="label">Résultats par IA</div>
          </div>
          <p className="mb-4 text-sm text-muted">Votre visibilité selon chaque intelligence artificielle</p>
          {enabledProviders.length === 0 ? (
            <p className="text-sm text-muted">Aucun provider activé.</p>
          ) : (
            <ul className="divide-y divide-border">
              {enabledProviders.map((prov) => {
                const provRuns = runs.filter((r) => r.provider === prov.name && r.status === "done");
                const provPresent = provRuns.filter((r) => r.mentions.some((m) => m.is_target_brand)).length;
                const provVis = provRuns.length ? Math.round((provPresent / provRuns.length) * 100) : null;
                const avgRank = (() => {
                  const ranks = provRuns.flatMap((r) => r.mentions.filter((m) => m.is_target_brand && m.rank_position != null).map((m) => m.rank_position!));
                  return ranks.length ? (ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1) : null;
                })();
                return (
                  <li key={prov.name} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                        style={{ background: prov.name === "anthropic" ? "#CC785C" : "#10A37F" }}
                      >
                        {prov.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium capitalize text-text">{prov.name}</div>
                        <div className="text-[11px] text-muted">{prov.default_model}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="num text-lg text-text">
                        {provVis != null ? `${provVis}%` : "—"}
                      </div>
                      {avgRank && (
                        <div className="text-[11px] text-muted">rang #{avgRank}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 text-xs text-muted">
            {runs.filter((r) => r.status === "done").length} runs terminés
          </div>
        </div>
      </div>

      {/* ── Sentiment + SoV + Alertes récentes ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card">
          <div className="flex items-center gap-1.5">
            <div className="label">Image perçue</div>
            <InfoTooltip
              title="Image perçue"
              what="Le ton utilisé par les IA pour parler de votre marque : positif, neutre ou négatif."
              how="Plus le vert domine, mieux votre marque est perçue. Le rouge signale des formulations négatives à surveiller."
              tips="Consultez les analyses individuelles pour identifier les sujets qui génèrent un ton négatif."
            />
          </div>
          <p className="mb-4 text-sm text-muted">Comment les IA parlent de vous</p>
          <SentimentDonut {...sentiment} />
        </div>

        <div className="card">
          <div className="flex items-center gap-1.5">
            <div className="label">Présence face aux concurrents</div>
            <InfoTooltip
              title="Présence face aux concurrents"
              what="Comparaison du nombre de fois où vous êtes cité versus vos concurrents dans les mêmes réponses IA."
              how="Plus votre barre est longue, plus vous dominez la conversation par rapport à vos concurrents."
              tips="Ajoutez vos principaux concurrents dans la section ci-dessous pour affiner cette comparaison."
            />
          </div>
          <p className="mb-4 text-sm text-muted">Votre place dans la conversation IA</p>
          <SovBar entries={sovReal} />
        </div>

        <div className="card">
          <div className="label">Derniers runs</div>
          <p className="mb-4 text-sm text-muted">Statut des 5 plus récents</p>
          <ul className="space-y-2">
            {runs.slice(0, 5).map((r) => (
              <li key={r.id}>
                <Link
                  href={`/dashboard/brands/${id}/runs/${r.id}`}
                  className="flex items-center justify-between gap-2 text-sm hover:opacity-80"
                >
                  <div className="min-w-0">
                    <div className="truncate text-muted capitalize">[{r.provider}]</div>
                    <div className="truncate text-xs text-muted">
                      {prompts.find((p) => p.id === r.prompt_id)?.text.slice(0, 45) ?? "—"}
                    </div>
                  </div>
                  <span
                    className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      background: r.status === "done" ? "rgba(45,158,95,0.15)" : r.status === "failed" ? "rgba(217,64,64,0.15)" : "rgba(201,123,24,0.15)",
                      color: r.status === "done" ? "var(--good)" : r.status === "failed" ? "var(--bad)" : "var(--warn)",
                    }}
                  >
                    {r.status}
                  </span>
                </Link>
              </li>
            ))}
            {runs.length === 0 && (
              <p className="text-sm text-muted">Aucun run. Cliquez ▶ Lancer un run.</p>
            )}
          </ul>
        </div>
      </div>

      {/* ── Résumé IA : ce que les IA disent de vous ── */}
      {runs.filter((r) => r.status === "done").length > 0 && (
        <div className="card">
          <div className="label">🤖 Ce que les IA disent de vous</div>
          <p className="mb-4 text-sm text-muted">
            Synthèse des réponses analysées sur les 30 derniers jours
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Points forts */}
            <div className="rounded-xl border border-border bg-bg p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg text-lg" style={{ background: "var(--good)/20" }}>
                  ✓
                </div>
                <span className="font-medium text-text">Points forts</span>
              </div>
              <ul className="space-y-2 text-sm text-muted">
                {(() => {
                  const doneRuns = runs.filter((r) => r.status === "done");
                  const citedRuns = doneRuns.filter((r) => r.mentions.some((m) => m.is_target_brand));
                  const citationRate = doneRuns.length ? citedRuns.length / doneRuns.length : 0;

                  // 1. Bon rang moyen
                  const avgRank = (() => {
                    const allRanks = runs.flatMap((r) => r.mentions.filter((m) => m.is_target_brand && m.rank_position != null).map((m) => m.rank_position!));
                    return allRanks.length ? (allRanks.reduce((a, b) => a + b, 0) / allRanks.length).toFixed(1) : null;
                  })();

                  // 2. Sentiment positif
                  const positiveMentions = runs.flatMap((r) => r.mentions.filter((m) => m.is_target_brand && m.sentiment === "positive"));

                  // 3. Visibilité globale
                  if (citationRate >= 0.5) {
                    return <li className="text-text">Votre marque est citée dans {Math.round(citationRate * 100)}% des réponses IA</li>;
                  }
                  if (avgRank && Number(avgRank) <= 3) {
                    return <li className="text-text">Bien positionné dans les réponses (rang moyen #{avgRank})</li>;
                  }
                  if (positiveMentions.length > 0) {
                    return <li className="text-text">Sentiment positif dans les réponses IA</li>;
                  }
                  return <li>Aucun point fort détecté — lancez plus d'analyses</li>;
                })()}
              </ul>
            </div>

            {/* Points de vigilance */}
            <div className="rounded-xl border border-border bg-bg p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg text-lg" style={{ background: "var(--warn)/20" }}>
                  ⚠
                </div>
                <span className="font-medium text-text">Points de vigilance</span>
              </div>
              <ul className="space-y-2 text-sm text-muted">
                {(() => {
                  const negativeRuns = runs.filter((r) => r.status === "done" && r.mentions.some((m) => m.is_target_brand && m.sentiment === "negative"));
                  if (negativeRuns.length > 0) {
                    return negativeRuns.slice(0, 3).map((r, i) => {
                      const mention = r.mentions.find((m) => m.is_target_brand && m.sentiment === "negative");
                      return (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1 text-xs text-warn">•</span>
                          <span className="line-clamp-2">{mention?.context_excerpt || "Sentiment négatif détecté"}</span>
                        </li>
                      );
                    });
                  }
                  const absentRuns = runs.filter((r) => r.status === "done" && !r.mentions.some((m) => m.is_target_brand));
                  if (absentRuns.length > runs.filter((r) => r.status === "done").length / 2) {
                    return <li>Votre marque est absente de la moitié des réponses</li>;
                  }
                  return <li>Aucun point de vigilance majeur</li>;
                })()}
              </ul>
            </div>

            {/* Concurrents cités avec vous */}
            <div className="rounded-xl border border-border bg-bg p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg text-lg" style={{ background: "var(--accent)/20" }}>
                  ⚔
                </div>
                <span className="font-medium text-text">Concurrents cités</span>
              </div>
              <ul className="space-y-2 text-sm text-muted">
                {(() => {
                  const competitorMentions: Record<string, number> = {};
                  runs.filter((r) => r.status === "done").forEach((r) => {
                    r.mentions.filter((m) => m.is_known_competitor).forEach((m) => {
                      competitorMentions[m.entity_name] = (competitorMentions[m.entity_name] ?? 0) + 1;
                    });
                  });
                  const sorted = Object.entries(competitorMentions).sort((a, b) => b[1] - a[1]).slice(0, 4);
                  if (sorted.length > 0) {
                    return sorted.map(([name, count]) => (
                      <li key={name} className="flex items-center justify-between">
                        <span>{name}</span>
                        <span className="rounded bg-border px-2 py-0.5 text-xs text-text">{count}x</span>
                      </li>
                    ));
                  }
                  return <li>Aucun concurrent identifié dans les réponses</li>;
                })()}
              </ul>
            </div>
          </div>

          {/* Citations récentes */}
          {(() => {
            const recentCitations = runs
              .filter((r) => r.status === "done")
              .flatMap((r) => r.citations.filter((c) => c.refers_to_target && c.url).map((c) => ({ ...c, provider: r.provider })))
              .slice(0, 6);

            if (recentCitations.length > 0) {
              return (
                <div className="mt-6">
                  <div className="mb-3 text-sm font-medium text-text">📰 Sources qui vous citent</div>
                  <div className="flex flex-wrap gap-2">
                    {recentCitations.map((c, i) => (
                      <a
                        key={i}
                        href={c.url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-xs text-muted hover:border-accent hover:text-text"
                      >
                        <span className="max-w-[200px] truncate">{c.title || c.domain}</span>
                        <span className="flex-shrink-0 rounded bg-border px-1.5 py-0.5 text-[10px] capitalize">{c.provider}</span>
                      </a>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* ── Performance par question et par IA ── */}
      {heatmap.length > 0 && enabledProviders.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="label">Performance par question et par IA</div>
          <p className="mb-4 text-sm text-muted">
            Position de votre marque dans les réponses (#1 = 1ère place)
          </p>

          {/* KPIs globaux */}
          <div className="mb-6 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-border bg-bg p-3 text-center">
              <div className="text-xs text-muted">Rang moyen</div>
              <div className="mt-1 num text-2xl font-bold" style={{ color: "var(--text)" }}>
                {(() => {
                  const allRanks = runs.flatMap((r) => r.mentions.filter((m) => m.is_target_brand && m.rank_position != null).map((m) => m.rank_position!));
                  return allRanks.length ? `#${(allRanks.reduce((a, b) => a + b, 0) / allRanks.length).toFixed(1)}` : "—";
                })()}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-bg p-3 text-center">
              <div className="text-xs text-muted">Meilleure position</div>
              <div className="mt-1 num text-2xl font-bold" style={{ color: "var(--good)" }}>
                {(() => {
                  const allRanks = runs.flatMap((r) => r.mentions.filter((m) => m.is_target_brand && m.rank_position != null).map((m) => m.rank_position!));
                  return allRanks.length ? `#${Math.min(...allRanks)}` : "—";
                })()}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-bg p-3 text-center">
              <div className="text-xs text-muted">Taux de citation</div>
              <div className="mt-1 num text-2xl font-bold" style={{ color: "var(--accent)" }}>
                {(() => {
                  const doneRuns = runs.filter((r) => r.status === "done");
                  const citedRuns = doneRuns.filter((r) => r.mentions.some((m) => m.is_target_brand));
                  return doneRuns.length ? `${Math.round((citedRuns.length / doneRuns.length) * 100)}%` : "—";
                })()}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-bg p-3 text-center">
              <div className="text-xs text-muted">Analyses terminées</div>
              <div className="mt-1 num text-2xl font-bold" style={{ color: "var(--text)" }}>
                {runs.filter((r) => r.status === "done").length}
              </div>
            </div>
          </div>

          {/* Tableau heatmap */}
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="py-2 text-left text-xs uppercase text-muted font-medium pr-4 min-w-[200px]">
                  Question
                </th>
                {enabledProviders.map((prov) => (
                  <th key={prov.name} className="px-3 py-2 text-center text-xs uppercase text-muted font-medium">
                    <div className="flex flex-col items-center">
                      <span>{prov.name.slice(0, 3).toUpperCase()}</span>
                      <span className="text-[9px] font-normal text-muted">{prov.default_model.split("-").slice(0, 2).join("-")}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {heatmap.map((row) => (
                <tr key={row.prompt.id}>
                  <td className="py-2.5 pr-4 text-sm text-text max-w-[260px]">
                    <span className="line-clamp-2">{row.prompt.text}</span>
                  </td>
                  {enabledProviders.map((prov) => {
                    const cell = row.cells[prov.name];
                    const chip = (
                      <div
                        className="mx-auto flex h-8 w-10 items-center justify-center rounded-lg text-xs font-semibold transition-opacity"
                        style={{ background: cellBg(cell), color: cellTextColor(cell) }}
                        title={cellTitle(cell)}
                      >
                        {cellText(cell)}
                      </div>
                    );
                    return (
                      <td key={prov.name} className="px-3 py-2.5 text-center">
                        {cell?.runId ? (
                          <Link
                            href={`/dashboard/brands/${id}/runs/${cell.runId}`}
                            className="hover:opacity-75"
                          >
                            {chip}
                          </Link>
                        ) : (
                          chip
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Légende */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
            {[
              { bg: "var(--border)",           text: "○",  label: "Non citée", fg: "var(--muted)" },
              { bg: "var(--warn)/20",           text: "⏳", label: "En cours", fg: "var(--warn)" },
              { bg: "var(--bad)/15",            text: "✗",  label: "Erreur", fg: "var(--bad)" },
              { bg: "var(--accent)/55",         text: "#4+", label: "Rang 4+", fg: "var(--text)" },
              { bg: "var(--accent)/70",         text: "#3",  label: "Rang 3", fg: "var(--text)" },
              { bg: "var(--accent)/85",         text: "#2",  label: "Rang 2", fg: "var(--accent-fg)" },
              { bg: "var(--accent)",            text: "#1",  label: "Rang 1 🏆", fg: "var(--accent-fg)" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div
                  className="flex h-5 w-7 items-center justify-center rounded text-[9px] font-semibold"
                  style={{ background: l.bg, color: l.fg }}
                >
                  {l.text}
                </div>
                <span>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Prompt Strategy Engine ── */}
      <div className="card space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="label">Portfolio de questions stratégiques</div>
                <p className="mt-0.5 text-xs text-muted max-w-xl">
                  Les prompts sont organisés selon deux scopes — <strong className="text-text">Core (Benchmark)</strong> pour la comparaison inter-marques et <strong className="text-text">Strategic (Opportunités)</strong> pour les recommandations business.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="input h-8 w-36 text-xs"
                  placeholder="📍 Ville ou région"
                  value={generateLocation}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  title="Ajoute une ville pour des questions géolocalisées (ex : Lyon)"
                  disabled={generating}
                />
                <button
                  onClick={generatePrompts}
                  className="btn-ghost text-xs border border-border"
                  disabled={generating || (subscription?.limits.auto_generate_prompts === false)}
                  title={subscription?.limits.auto_generate_prompts === false ? "Non disponible sur le plan gratuit" : "Générer un portfolio de 24 questions (16 Core + 8 Strategic)"}
                >
                  {generating ? (
                    <><span className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />{brand.domain ? "Analyse…" : "Génération…"}</>
                  ) : (
                    brand.domain ? "🌐 Générer depuis mon site" : "✨ Générer le portfolio"
                  )}
                </button>
                <button onClick={triggerRuns} className="btn-dark text-xs" disabled={running || prompts.length === 0 || enabledProviders.length === 0}>
                  Lancer analyse
                </button>
              </div>
            </div>

            {/* Scope summary chips */}
            <div className="rounded-xl border border-border bg-bg p-4">
              <div className="mb-3 text-xs text-muted">
                <strong>Pourquoi deux types de prompts ?</strong> Les Core Prompts garantissent une comparaison fiable entre marques du même secteur. Les Strategic Prompts personnalisent l&apos;analyse pour identifier les opportunités business spécifiques à votre marque.
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(Object.keys(SCOPE_INFO) as Array<keyof typeof SCOPE_INFO>).map((scope) => {
                  const info = SCOPE_INFO[scope];
                  const total = Object.values(grouped[scope]).reduce((s, arr) => s + arr.length, 0);
                  return (
                    <div key={scope} className="rounded-lg border border-border px-3 py-2" style={{ borderLeft: `3px solid ${info.color}` }}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold" style={{ color: info.color }}>
                          {info.emoji} {info.label}
                        </span>
                        <span className="num text-base font-bold" style={{ color: info.color }}>{total}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] font-medium text-text">{info.badge}</div>
                      <div className="mt-0.5 text-[10px] text-muted">{scope === "core" ? "16 prompts fixes" : "8 prompts personalisés"}</div>
                      <InfoTooltip
                        title={info.tooltipTitle}
                        what={info.tooltipWhat}
                        how={info.tooltipHow}
                        tips={info.tooltipTips}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add prompt form */}
            <form onSubmit={addPrompt} className="flex gap-2">
              <input
                className="input text-sm"
                placeholder="Ex: Quelle est la meilleure banque pour un dirigeant ?"
                value={newPromptText}
                onChange={(e) => setNewPromptText(e.target.value)}
              />
              <button type="submit" className="btn-primary flex-shrink-0 text-sm">+ Ajouter</button>
            </form>

            {/* Empty state */}
            {prompts.length === 0 && (
              <div className="rounded-xl border border-border bg-bg px-4 py-4">
                <p className="text-sm text-muted">
                  Aucune question.{" "}
                  <strong className="text-text">{brand.domain ? "🌐 Générez depuis votre site" : "✨ Générez le portfolio automatiquement"}</strong> pour créer un portefeuille de 24 questions stratégiques.
                </p>
                {!brand.domain && (
                  <p className="mt-1 text-xs text-muted">💡 Ajoutez un domaine web à votre marque pour une génération personnalisée basée sur votre activité réelle.</p>
                )}
              </div>
            )}

            {/* Two-level scope → category rendering */}
            {prompts.length > 0 && (["core", "strategic"] as Array<"core" | "strategic">).map((scope) => {
              const scopeInfo = SCOPE_INFO[scope];
              const scopeTotal = Object.values(grouped[scope]).reduce((s, arr) => s + arr.length, 0);
              if (scopeTotal === 0) return null;
              return (
                <div key={scope} className="space-y-4">
                  {/* Scope section header */}
                  <div className="rounded-lg border border-border px-4 py-3" style={{ borderLeft: `4px solid ${scopeInfo.color}` }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold" style={{ color: scopeInfo.color }}>
                        {scopeInfo.emoji} {scopeInfo.label}
                      </span>
                      <span
                        className="rounded px-2 py-0.5 text-[10px] font-bold uppercase"
                        style={{ background: `${scopeInfo.color}18`, color: scopeInfo.color }}
                      >
                        {scopeInfo.badge}
                      </span>
                      <span className="num text-base font-bold text-text">{scopeTotal}</span>
                      <InfoTooltip
                        title={scopeInfo.tooltipTitle}
                        what={scopeInfo.tooltipWhat}
                        how={scopeInfo.tooltipHow}
                        tips={scopeInfo.tooltipTips}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {scope === "core"
                        ? "16 questions standardisées, identiques pour toutes les marques du même secteur. Score de benchmark."
                        : "8 questions personnalisées selon votre marque et vos concurrents. Score d'opportunité."}
                    </p>
                  </div>

                  {/* Category groups within this scope */}
                  {STRATEGY_CATS.map((cat) => {
                    const catPrompts = grouped[scope][cat.key] ?? [];
                    if (catPrompts.length === 0) return null;
                    return (
                      <div key={`${scope}-${cat.key}`} className="space-y-2">
                        {/* Category header */}
                        <div className="flex items-center gap-2 border-b border-border pb-2">
                          <span className="text-sm font-semibold text-text">{cat.emoji} {cat.title}</span>
                          <span
                            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                            style={{ background: cat.color }}
                          >
                            {catPrompts.length}
                          </span>
                          <InfoTooltip title={cat.title} what={cat.what} how={cat.how} tips={cat.tips} />
                          <span className="text-[11px] text-muted">— {cat.desc}</span>
                        </div>

                        {/* Prompt cards */}
                        <div className="space-y-2">
                          {catPrompts.map((p) => {
                            const promptRuns = runs.filter((r) => r.prompt_id === p.id && r.status === "done");
                            const ranks = promptRuns.flatMap((r) => r.mentions.filter((m) => m.is_target_brand && m.rank_position != null).map((m) => m.rank_position!));
                            const avgRank = ranks.length ? (ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1) : null;
                            const sentiments = promptRuns.flatMap((r) => r.mentions.filter((m) => m.is_target_brand).map((m) => m.sentiment));
                            const sentimentSummary = sentiments.length
                              ? sentiments.includes("negative") ? "Négatif" : sentiments.includes("positive") ? "Positif" : "Neutre"
                              : null;
                            const sentimentColor = sentimentSummary === "Positif" ? "var(--good)" : sentimentSummary === "Négatif" ? "var(--bad)" : "var(--muted)";
                            const usedProviders = [...new Set(promptRuns.map((r) => r.provider))];

                            return (
                              <div
                                key={p.id}
                                className="group rounded-xl border border-border px-4 py-3 hover:border-accent/40 transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="min-w-0 flex-1 space-y-2">
                                    {/* Text */}
                                    <p className="text-sm text-text leading-relaxed">{p.text}</p>

                                    {/* Metadata row */}
                                    <div className="flex flex-wrap items-center gap-2">
                                      {/* Scope badge */}
                                      <span
                                        className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                                        style={{ background: `${scopeInfo.color}18`, color: scopeInfo.color }}
                                      >
                                        {scopeInfo.emoji} {scopeInfo.label}
                                      </span>
                                      {/* Priority */}
                                      {p.priority_level && (
                                        <span
                                          className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                                          style={{ background: `${PRIO_COLOR[p.priority_level]}18`, color: PRIO_COLOR[p.priority_level] }}
                                        >
                                          ⚡ {PRIO_LABEL[p.priority_level] ?? p.priority_level}
                                        </span>
                                      )}
                                      {/* Difficulty */}
                                      {p.difficulty_level && (
                                        <span
                                          className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                                          style={{ background: `${DIFF_COLOR[p.difficulty_level]}18`, color: DIFF_COLOR[p.difficulty_level] }}
                                        >
                                          🎯 {DIFF_LABEL[p.difficulty_level] ?? p.difficulty_level}
                                        </span>
                                      )}
                                      {/* Business value */}
                                      {p.business_value_score != null && (
                                        <span className="text-[10px] font-semibold" style={{ color: bvColor(p.business_value_score) }}>
                                          💼 {Math.round(p.business_value_score)}
                                        </span>
                                      )}
                                                              </div>

                                    {/* Run stats row */}
                                    {promptRuns.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted border-t border-border pt-2">
                                        {avgRank && <span className="num font-semibold text-text">#{avgRank} moy.</span>}
                                        {sentimentSummary && (
                                          <span style={{ color: sentimentColor }}>{sentimentSummary}</span>
                                        )}
                                        <div className="flex gap-1">
                                          {enabledProviders.map((prov) => (
                                            <span
                                              key={prov.name}
                                              className="flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold"
                                              style={{
                                                background: usedProviders.includes(prov.name)
                                                  ? prov.name === "anthropic" ? "#CC785C" : "#10A37F"
                                                  : "var(--border)",
                                                color: usedProviders.includes(prov.name) ? "white" : "var(--muted)",
                                              }}
                                              title={prov.name}
                                            >
                                              {prov.name[0].toUpperCase()}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Right actions */}
                                  <div className="flex flex-shrink-0 flex-col items-end gap-2">
                                    {/* Web search toggle */}
                                    <button
                                      onClick={() => toggleWebSearch(p.id, p.use_web_search)}
                                      disabled={!!(subscription && !subscription.is_trial && subscription.effective_plan === "free")}
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                        subscription && !subscription.is_trial && subscription.effective_plan === "free" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                                      }`}
                                      style={{ background: p.use_web_search ? "var(--accent)" : "rgba(0,0,0,0.18)" }}
                                      title={p.use_web_search ? "Recherche web activée" : "Activer la recherche web"}
                                    >
                                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${p.use_web_search ? "translate-x-4" : "translate-x-1"}`} />
                                    </button>
                                    {/* Delete */}
                                    <button
                                      onClick={() => deletePrompt(p.id)}
                                      className="text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-bad"
                                    >
                                      Supprimer
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
      </div>

      {/* ── Concurrents ── */}
      <div className="card">
        <div className="label">Concurrents</div>
        <form onSubmit={addCompetitor} className="mt-3 flex gap-2">
          <input className="input" placeholder="Nom" value={newComp.name} onChange={(e) => setNewComp((c) => ({ ...c, name: e.target.value }))} />
          <input className="input" placeholder="domaine.com" value={newComp.domain} onChange={(e) => setNewComp((c) => ({ ...c, domain: e.target.value }))} />
          <button type="submit" className="btn-primary flex-shrink-0">+ Ajouter</button>
        </form>
        {competitors.length > 0 ? (
          <ul className="mt-4 divide-y divide-border">
            {competitors.map((c) => (
              <li key={c.id} className="group flex items-center justify-between py-2.5">
                <div>
                  <div className="text-sm font-medium text-text">{c.name}</div>
                  {c.domain && <div className="text-xs text-muted">{c.domain}</div>}
                </div>
                <button
                  onClick={() => deleteCompetitor(c.id)}
                  className="text-[11px] text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-bad"
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Ajoutez 3–5 concurrents pour calculer le Share of Voice.
          </p>
        )}
      </div>

      {/* ── Comparaison concurrents ── */}
      {radarData && radarData.entries.length > 0 && (
        <div className="card">
          <div className="label mb-4">Comparaison concurrents</div>
          <CompetitorRadar entries={radarData.entries} brandName={brand.name} />
        </div>
      )}

      {/* ── Évolution historique ── */}
      {snapshots.length > 1 && (
        <div className="card">
          <div className="label mb-4">Évolution historique</div>
          <TrendChart snapshots={snapshots} />
        </div>
      )}

      {/* ── Rapports PDF ── */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label">Rapports PDF</div>
            <p className="mt-0.5 text-sm text-muted">
              Rapport stratégique complet — visibilité, autorité, concurrents, opportunités et plan d&apos;action
            </p>
          </div>
          <button
            onClick={generateReport}
            disabled={reportGenerating}
            className="btn-primary flex-shrink-0 flex items-center gap-1.5"
          >
            {reportGenerating ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Génération en cours…
              </>
            ) : (
              "Générer le rapport PDF"
            )}
          </button>
        </div>

        {reportError && (
          <div className="mt-3 rounded-lg border px-3 py-2 text-xs" style={{ color: "var(--bad)", background: "rgba(220,38,38,0.06)", borderColor: "rgba(220,38,38,0.2)" }}>
            {reportError}
          </div>
        )}

        {reportList.length === 0 && !reportGenerating ? (
          <div className="mt-4 rounded-xl border border-border bg-bg p-4 text-center">
            <div className="mb-2 text-2xl">📄</div>
            <p className="text-sm text-muted">
              Aucun rapport généré. Cliquez sur{" "}
              <strong className="text-text">Générer le rapport PDF</strong> pour créer
              un rapport stratégique complet sur les 30 derniers jours.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 text-left text-xs uppercase text-muted font-medium">Rapport</th>
                  <th className="px-4 py-2 text-left text-xs uppercase text-muted font-medium">Période</th>
                  <th className="px-4 py-2 text-center text-xs uppercase text-muted font-medium">Statut</th>
                  <th className="py-2 text-right text-xs uppercase text-muted font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportList.map((report) => {
                  const periodStart = new Date(report.period_start).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
                  const periodEnd = new Date(report.period_end).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
                  const createdAt = new Date(report.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
                  const isActive = report.status === "pending" || report.status === "generating";

                  return (
                    <tr key={report.id}>
                      <td className="py-3">
                        <div className="text-sm font-medium text-text">{report.title}</div>
                        <div className="text-xs text-muted">Créé le {createdAt}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {periodStart} – {periodEnd}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            background:
                              report.status === "done"
                                ? "rgba(16,185,129,0.12)"
                                : report.status === "failed"
                                ? "rgba(239,68,68,0.12)"
                                : "rgba(245,158,11,0.12)",
                            color:
                              report.status === "done"
                                ? "var(--good)"
                                : report.status === "failed"
                                ? "var(--bad)"
                                : "var(--warn)",
                          }}
                        >
                          {isActive && (
                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                          )}
                          {report.status === "pending"
                            ? "En attente"
                            : report.status === "generating"
                            ? "Génération…"
                            : report.status === "done"
                            ? "Prêt"
                            : "Erreur"}
                        </span>
                        {report.status === "failed" && report.error_message && (
                          <div className="mt-1 text-[10px] text-bad max-w-[160px] truncate" title={report.error_message}>
                            {report.error_message.slice(0, 50)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {report.status === "done" ? (
                          <button
                            onClick={() => {
                              const token = getToken();
                              const url = `${API_URL}/brands/${id}/reports/${report.id}/download`;
                              // Open in a new tab with auth token via fetch
                              fetch(url, {
                                headers: token ? { Authorization: `Bearer ${token}` } : {},
                              })
                                .then((res) => res.blob())
                                .then((blob) => {
                                  const objUrl = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = objUrl;
                                  a.download = `rapport-${brand.name.toLowerCase().replace(/\s+/g, "-")}.pdf`;
                                  a.click();
                                  URL.revokeObjectURL(objUrl);
                                })
                                .catch(() => {
                                  setReportError("Erreur lors du téléchargement du PDF.");
                                });
                            }}
                            className="btn-ghost text-xs border border-border"
                          >
                            Télécharger
                          </button>
                        ) : isActive ? (
                          <span className="text-xs text-muted">—</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Paramètres de surveillance ── */}
      <div className="card space-y-6">
        <div className="label">Paramètres de surveillance</div>

        {/* Recherche web info */}
        <div className="rounded-xl border border-border bg-bg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-text">Recherche web avec Claude</div>
              <div className="mt-1 text-xs text-muted">
                Activez la recherche web pour que Claude aille chercher des informations en temps réel sur le web avant de répondre.
                Utile pour surveiller l'actualité récente, les nouvelles sources, ou les sujets d'actualité.
              </div>
              <div className="mt-2 text-xs" style={{ color: "var(--accent)" }}>
                🔒 Réservé aux plans Pro et Agence — {subscription?.effective_plan === "free" && !subscription?.is_trial ? "non disponible sur votre plan actuel" : "disponible sur votre plan"}
              </div>
            </div>
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg font-bold"
              style={{ background: "var(--accent)/20", color: "var(--accent)" }}
            >
              🌐
            </div>
          </div>
        </div>

        {/* Fréquence d'analyse automatique */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-text">Analyse automatique</div>
              <div className="mt-0.5 text-xs text-muted">
                Le système lancera une analyse complète à intervalles réguliers.
              </div>
            </div>
            <div className="flex items-center gap-2">
              {scheduleSaving && (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent text-muted" />
              )}
              {scheduleSaved && !scheduleSaving && (
                <span className="text-sm text-good">✓</span>
              )}
              <select
                className="input h-9 pr-8 text-sm"
                value={schedule}
                disabled={scheduleSaving}
                onChange={(e) => saveSchedule(e.target.value)}
              >
                <option value="none">Manuelle uniquement</option>
                <option value="weekly">Hebdomadaire (chaque lundi)</option>
                <option value="monthly">Mensuelle (1er du mois)</option>
              </select>
            </div>
          </div>

          {/* Prochaine analyse estimée */}
          {schedule !== "none" && (() => {
            const lastRun = runs.filter((r) => r.created_at).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
            const base = lastRun ? new Date(lastRun.created_at) : new Date();
            const next = new Date(base);
            if (schedule === "weekly") {
              next.setDate(next.getDate() + 7);
              // Align to Monday
              const dayOfWeek = next.getDay();
              const daysToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
              next.setDate(next.getDate() + (dayOfWeek === 1 ? 0 : daysToMonday));
            } else {
              next.setMonth(next.getMonth() + 1, 1);
            }
            const diffDays = Math.max(0, Math.round((next.getTime() - Date.now()) / 86400000));
            return (
              <p className="mt-2 text-xs text-muted">
                Prochaine analyse automatique : dans <strong className="text-text">{diffDays} jour{diffDays !== 1 ? "s" : ""}</strong>
              </p>
            );
          })()}
        </div>

        {/* Email pour les alertes */}
        <div>
          <div className="text-sm font-medium text-text">Email pour les alertes</div>
          <div className="mt-0.5 text-xs text-muted">
            Recevez un email quand votre visibilité change ou qu&apos;un problème est détecté.
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="email"
              className="input flex-1"
              placeholder="votre@email.com"
              value={alertEmail}
              onChange={(e) => setAlertEmail(e.target.value)}
            />
            <button
              className="btn-primary flex-shrink-0 flex items-center gap-1.5"
              onClick={saveAlertEmail}
              disabled={emailSaving}
            >
              {emailSaving ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Enregistrement…
                </>
              ) : emailSaved ? (
                <>✓ Enregistré</>
              ) : (
                "Enregistrer"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
