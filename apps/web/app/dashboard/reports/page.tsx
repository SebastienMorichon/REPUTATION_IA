"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, getToken, API_URL, type Brand, type Scores } from "@/lib/api";
import { InfoTooltip } from "@/components/InfoTooltip";

interface RecommendationAction {
  text: string;
  type: string;
}

interface Recommendation {
  priority: "high" | "medium";
  category: string;
  icon: string;
  title: string;
  description: string;
  metric_value: number | null;
  actions: RecommendationAction[];
}

interface BrandReport {
  brand: Brand;
  scores: Scores | null;
}

/* ── Letter grade helper ─────────────────────────────────── */
function grade(value: number): { letter: string; color: string; label: string } {
  if (value >= 75) return { letter: "A", color: "var(--good)",  label: "Excellent" };
  if (value >= 55) return { letter: "B", color: "var(--good)",  label: "Bien" };
  if (value >= 35) return { letter: "C", color: "var(--warn)",  label: "Moyen" };
  if (value >= 15) return { letter: "D", color: "var(--warn)",  label: "Faible" };
  return               { letter: "E", color: "var(--bad)",   label: "Insuffisant" };
}

/* ── KPI definitions with plain-French labels & tooltips ─── */
const KPI_INFO = {
  visibility: {
    label:  "Visibilité dans les IA",
    emoji:  "👁️",
    what:   "Proportion de fois où votre marque est citée lorsqu'un internaute pose une question à une IA (ChatGPT, Claude…) dans votre secteur.",
    how:    "Au-dessus de 60 % : excellent — les IA vous recommandent fréquemment.\n30 – 60 % : correct — vous existez mais pas systématiquement.\nEn dessous de 30 % : votre marque est quasi invisible dans les IA.",
    tips:   "Publiez du contenu de qualité, obtenez des mentions sur des sites de référence et vérifiez que votre fiche Google est à jour.",
  },
  sov: {
    label:  "Présence face aux concurrents",
    emoji:  "📊",
    what:   "Sur toutes les réponses des IA, quelle part vous est consacrée par rapport à vos concurrents ? C'est votre « part de voix » dans les conversations IA.",
    how:    "50 % = vous êtes cité autant que l'ensemble de vos concurrents réunis.\n20 – 50 % : bonne visibilité relative.\nEn dessous de 20 % : vos concurrents dominent la conversation.",
    tips:   "Ajoutez vos principaux concurrents dans l'onglet Marque pour affiner ce calcul.",
  },
  sentiment: {
    label:  "Image perçue",
    emoji:  "💬",
    what:   "Quand les IA parlent de vous, le font-elles de manière positive, neutre ou négative ? Ce score résume le ton global des réponses.",
    how:    "Au-dessus de 60 % : les IA vous présentent favorablement.\n30 – 60 % : ton neutre ou mitigé — attention aux formulations prudentes.\nEn dessous de 30 % : des éléments négatifs ressortent souvent.",
    tips:   "Consultez les runs individuels pour identifier quels sujets génèrent un ton négatif et travaillez votre communication sur ces points.",
  },
  citation: {
    label:  "Sources qui vous mentionnent",
    emoji:  "🔗",
    what:   "Pourcentage de réponses IA qui citent une source externe (article, site web) en lien avec votre marque. Plus vous êtes mentionné par des sources fiables, plus les IA vous font confiance.",
    how:    "Au-dessus de 50 % : vous avez une bonne couverture médiatique et web.\n20 – 50 % : couverture partielle.\nEn dessous de 20 % : peu de sources vous mentionnent — les IA ont du mal à vous « justifier ».",
    tips:   "Visez des publications dans des médias spécialisés, des annuaires professionnels et des blogs reconnus dans votre secteur.",
  },
};

/* ── Score bar ───────────────────────────────────────────── */
function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(value, 100)}%`, background: color }}
      />
    </div>
  );
}

/* ── Single KPI row for per-brand card ───────────────────── */
function KpiRow({
  info,
  value,
}: {
  info: typeof KPI_INFO[keyof typeof KPI_INFO];
  value: number;
}) {
  const g = grade(value);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{info.emoji}</span>
          <span className="text-sm text-muted">{info.label}</span>
          <InfoTooltip title={info.label} what={info.what} how={info.how} tips={info.tips} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: g.color }}>
            {g.label}
          </span>
          <span
            className="flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white"
            style={{ background: g.color }}
          >
            {g.letter}
          </span>
          <span className="num w-12 text-right text-sm font-semibold text-text">
            {Math.round(value)} %
          </span>
        </div>
      </div>
      <ScoreBar value={value} color={g.color} />
    </div>
  );
}

/* ── Global grade summary ────────────────────────────────── */
function GlobalGrade({ value }: { value: number }) {
  const g = grade(value);
  return (
    <div
      className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl text-3xl font-black text-white"
      style={{ background: g.color }}
    >
      {g.letter}
    </div>
  );
}

/* ── PDF download helper ─────────────────────────────────── */
async function downloadPdf(brandId: string, brandName: string, days: number) {
  const token = getToken();
  const res = await fetch(`${API_URL}/brands/${brandId}/report.pdf?days=${days}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Génération du PDF échouée");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rapport-${brandName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Recommendation card ─────────────────────────────────── */
function RecCard({ rec }: { rec: Recommendation }) {
  const borderColor = rec.priority === "high" ? "var(--bad)" : "var(--warn)";
  const badgeBg     = rec.priority === "high" ? "rgba(217,64,64,0.1)" : "rgba(201,123,24,0.1)";
  const badgeColor  = rec.priority === "high" ? "var(--bad)" : "var(--warn)";
  const typeColors: Record<string, string> = {
    seo:       "rgba(99,102,241,0.12)",
    content:   "rgba(16,163,127,0.12)",
    pr:        "rgba(201,123,24,0.12)",
    technical: "rgba(100,116,139,0.12)",
  };
  const typeFg: Record<string, string> = {
    seo: "#6366F1", content: "#10A37F", pr: "#C97B18", technical: "#64748B",
  };
  return (
    <div
      className="rounded-xl border border-border p-4"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">{rec.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-text text-sm">{rec.title}</span>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ background: badgeBg, color: badgeColor }}
            >
              {rec.priority === "high" ? "Priorité haute" : "Priorité moyenne"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted leading-relaxed">{rec.description}</p>
          <ul className="mt-3 space-y-1.5">
            {rec.actions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                <span className="text-text">
                  {a.text}
                  <span
                    className="ml-1.5 rounded px-1 py-0.5 text-[9px] font-semibold uppercase"
                    style={{
                      background: typeColors[a.type] ?? "var(--border)",
                      color: typeFg[a.type] ?? "var(--muted)",
                    }}
                  >
                    {a.type}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────── */
export default function ReportsPage() {
  const [reports, setReports] = useState<BrandReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [recsByBrand, setRecsByBrand] = useState<Record<string, Recommendation[]>>({});
  const [recsLoading, setRecsLoading] = useState<string | null>(null);
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<Brand[]>("/brands")
      .then((brands) =>
        Promise.all(
          brands.map((brand) =>
            apiFetch<Scores>(`/brands/${brand.id}/scores?days=${days}`)
              .then((scores) => ({ brand, scores }))
              .catch(() => ({ brand, scores: null }))
          )
        )
      )
      .then(setReports)
      .finally(() => setLoading(false));
  }, [days]);

  const globalVisibility =
    reports.length && reports.some((r) => r.scores)
      ? reports.reduce((s, r) => s + (r.scores?.visibility_score ?? 0), 0) /
        reports.filter((r) => r.scores).length
      : null;

  const brandsWithData = reports.filter(
    (r) => r.scores && r.scores.runs_count > 0
  );

  async function handleDownloadPdf(brandId: string, brandName: string) {
    setPdfLoading(brandId);
    try {
      await downloadPdf(brandId, brandName, days);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur lors de la génération du PDF");
    } finally {
      setPdfLoading(null);
    }
  }

  async function toggleRecs(brandId: string) {
    if (expandedBrand === brandId) {
      setExpandedBrand(null);
      return;
    }
    setExpandedBrand(brandId);
    if (recsByBrand[brandId]) return; // already loaded
    setRecsLoading(brandId);
    try {
      const data = await apiFetch<Recommendation[]>(
        `/brands/${brandId}/recommendations?days=${days}`
      );
      setRecsByBrand((prev) => ({ ...prev, [brandId]: data }));
    } finally {
      setRecsLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="num text-3xl text-text">Mon rapport de visibilité</h1>
          <p className="mt-1 text-sm text-muted">
            Comment les intelligences artificielles parlent de vos marques.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Période :</span>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                days === d
                  ? "bg-sidebar text-[#E4E2DC]"
                  : "bg-card text-muted hover:text-text border border-border"
              }`}
            >
              {d === 7 ? "7 jours" : d === 30 ? "30 jours" : "3 mois"}
            </button>
          ))}
        </div>
      </div>

      {/* Global KPI highlight */}
      {globalVisibility !== null && (
        <div className="card-feat rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <GlobalGrade value={globalVisibility} />
            <div>
              <div
                className="label"
                style={{ color: "var(--muted)" }}
              >
                Visibilité IA moyenne — toutes vos marques
              </div>
              <div
                className="num mt-1 text-5xl"
                style={{ color: "var(--feat-text)" }}
              >
                {Math.round(globalVisibility)} %
              </div>
              <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                sur {days === 7 ? "7 jours" : days === 30 ? "30 jours" : "3 mois"}{" "}
                · {brandsWithData.length} marque
                {brandsWithData.length > 1 ? "s" : ""} avec données
              </div>
            </div>
          </div>
          <p
            className="mt-4 max-w-lg text-sm leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            En moyenne, les IA citent votre marque dans{" "}
            <strong style={{ color: "var(--feat-text)" }}>
              {Math.round(globalVisibility)} % des réponses
            </strong>{" "}
            liées à votre secteur d&apos;activité.{" "}
            {globalVisibility >= 60
              ? "C'est un excellent résultat — vous êtes bien installé dans la mémoire des IA."
              : globalVisibility >= 30
              ? "Il y a une marge de progression — certaines questions clés ne vous mentionnent pas encore."
              : "Votre visibilité est encore faible — les IA ne vous connaissent pas suffisamment. Lancez plus de runs et enrichissez votre présence en ligne."}
          </p>
        </div>
      )}

      {/* Per-brand cards */}
      {loading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : reports.length === 0 ? (
        <div className="card">
          <p className="text-sm text-muted">
            Aucune marque.{" "}
            <Link
              href="/dashboard/brands/new"
              className="text-text underline underline-offset-2"
            >
              Créer votre première marque →
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(({ brand, scores }) => {
            const overall = scores
              ? (scores.visibility_score +
                  scores.share_of_voice +
                  scores.sentiment_score +
                  scores.citation_score) /
                4
              : null;

            return (
              <div key={brand.id} className="card space-y-5">
                {/* Brand header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {overall !== null ? (
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-base font-black text-white"
                        style={{ background: grade(overall).color }}
                      >
                        {grade(overall).letter}
                      </div>
                    ) : (
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                        style={{
                          background: "var(--accent)",
                          color: "var(--accent-fg)",
                        }}
                      >
                        {brand.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-text">{brand.name}</div>
                      <div className="text-xs text-muted">
                        {brand.domain || "—"} · {brand.category || "—"}
                        {overall !== null && (
                          <>
                            {" "}·{" "}
                            <span
                              style={{ color: grade(overall).color }}
                              className="font-medium"
                            >
                              Note globale : {grade(overall).label}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/brands/${brand.id}`}
                      className="text-xs font-medium text-muted underline underline-offset-2 hover:text-text"
                    >
                      Tableau de bord →
                    </Link>
                    {scores && scores.runs_count > 0 && (
                      <button
                        onClick={() => handleDownloadPdf(brand.id, brand.name)}
                        disabled={pdfLoading === brand.id}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-sidebar hover:text-[#E4E2DC] disabled:opacity-50"
                      >
                        {pdfLoading === brand.id ? (
                          <>
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Génération…
                          </>
                        ) : (
                          <>📄 Télécharger PDF</>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {scores && scores.runs_count > 0 ? (
                  <>
                    {/* KPI rows */}
                    <div className="space-y-3">
                      <KpiRow info={KPI_INFO.visibility} value={scores.visibility_score} />
                      <KpiRow info={KPI_INFO.sov}        value={scores.share_of_voice} />
                      <KpiRow info={KPI_INFO.sentiment}  value={scores.sentiment_score} />
                      <KpiRow info={KPI_INFO.citation}   value={scores.citation_score} />
                    </div>

                    {/* Footer + actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                        <span>
                          Basé sur{" "}
                          <strong className="text-text">{scores.runs_count} analyses</strong>{" "}
                          sur{" "}
                          {days === 7 ? "7 jours" : days === 30 ? "30 jours" : "3 mois"}
                        </span>
                        {scores.top_competitors.length > 0 && (
                          <span>
                            Concurrent principal :{" "}
                            <span className="text-text font-medium">
                              {scores.top_competitors[0].name}
                            </span>
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleRecs(brand.id)}
                        className="text-xs font-medium text-muted hover:text-text"
                      >
                        {expandedBrand === brand.id ? "▲ Masquer les conseils" : "💡 Voir les recommandations"}
                      </button>
                    </div>

                    {/* Recommendations panel */}
                    {expandedBrand === brand.id && (
                      <div className="space-y-3 border-t border-border pt-4">
                        <div className="label">Plan d&apos;action</div>
                        {recsLoading === brand.id ? (
                          <p className="text-sm text-muted">Analyse en cours…</p>
                        ) : (recsByBrand[brand.id] ?? []).length === 0 ? (
                          <p className="text-sm text-muted">
                            ✅ Aucune recommandation critique — continuez sur votre lancée !
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {(recsByBrand[brand.id] ?? []).map((rec, i) => (
                              <RecCard key={i} rec={rec} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-border bg-bg px-4 py-4">
                    <p className="text-sm font-medium text-text">
                      Aucune donnée disponible pour cette période.
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Lancez votre première analyse pour commencer à mesurer votre visibilité dans les IA.
                    </p>
                    <Link
                      href={`/dashboard/brands/${brand.id}`}
                      className="mt-3 inline-block text-xs font-medium text-text underline underline-offset-2 hover:opacity-70"
                    >
                      Lancer une analyse →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="card">
        <div className="label mb-3">Comment lire les notes ?</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { letter: "A", label: "Excellent", threshold: "≥ 75 %", color: "var(--good)" },
            { letter: "B", label: "Bien",      threshold: "55–75 %", color: "var(--good)" },
            { letter: "C", label: "Moyen",     threshold: "35–55 %", color: "var(--warn)" },
            { letter: "D", label: "Faible",    threshold: "15–35 %", color: "var(--warn)" },
            { letter: "E", label: "Insuffisant", threshold: "< 15 %", color: "var(--bad)" },
          ].map((g) => (
            <div key={g.letter} className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ background: g.color }}
              >
                {g.letter}
              </div>
              <div>
                <div className="text-xs font-medium text-text">{g.label}</div>
                <div className="text-[10px] text-muted">{g.threshold}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
