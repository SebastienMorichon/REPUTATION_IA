"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getUser, type Article, ApiError } from "@/lib/api";

type Status = Article["status"];

const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  idea:      { label: "Idée",       color: "text-muted" },
  drafting:  { label: "En cours…",  color: "text-warn" },
  draft:     { label: "Brouillon",  color: "text-warn" },
  review:    { label: "À relire",   color: "text-accent" },
  approved:  { label: "Approuvé",   color: "text-good" },
  published: { label: "Publié",     color: "text-good" },
  failed:    { label: "Erreur",     color: "text-bad" },
};

const RISK_COLOR: Record<string, string> = {
  low:    "text-good",
  medium: "text-warn",
  high:   "text-bad",
};

export default function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"content" | "review" | "linkedin">("content");

  function fetchArticle() {
    return apiFetch<Article>(`/content/articles/${id}`).then(setArticle);
  }

  useEffect(() => {
    // Guard: redirect non-admins immediately
    const user = getUser();
    if (!user?.is_admin) {
      router.replace("/dashboard");
      return;
    }
    fetchArticle().finally(() => setLoading(false));
  }, [id, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll while in-progress
  useEffect(() => {
    if (!article) return;
    if (article.status !== "idea" && article.status !== "drafting") return;
    const timer = setInterval(fetchArticle, 5000);
    return () => clearInterval(timer);
  }, [article?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAction(endpoint: string) {
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(`/content/articles/${id}/${endpoint}`, { method: "POST" });
      await fetchArticle();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-muted text-sm">Chargement…</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-bad text-sm">Article introuvable.</p>
      </div>
    );
  }

  const sc = STATUS_CONFIG[article.status] ?? STATUS_CONFIG.idea;
  const isInProgress = article.status === "idea" || article.status === "drafting";

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="mx-auto max-w-3xl">
        {/* Back */}
        <Link href="/dashboard/content" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors">
          ← Retour aux articles
        </Link>

        {/* Header */}
        <div className="mt-2 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-semibold uppercase tracking-wider ${sc.color}`}>
              {sc.label}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-text">
            {article.title || (isInProgress ? "Génération en cours…" : "(sans titre)")}
          </h1>
          {article.excerpt && (
            <p className="mt-2 text-sm text-muted leading-relaxed">{article.excerpt}</p>
          )}
        </div>

        {/* In-progress state */}
        {isInProgress && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-sm text-muted">
              {article.status === "idea"
                ? "En attente du démarrage du pipeline…"
                : "Agent IA en train de rédiger l'article…"}
            </p>
            <p className="mt-1 text-xs text-muted">La page se rafraîchit automatiquement.</p>
          </div>
        )}

        {/* Failed state */}
        {article.status === "failed" && article.error && (
          <div className="mb-4 rounded-xl border border-bad/30 bg-bad/10 p-4">
            <p className="text-sm font-medium text-bad">Pipeline échoué</p>
            <p className="mt-1 text-xs text-bad/80 font-mono">{article.error}</p>
          </div>
        )}

        {/* Action buttons */}
        {!isInProgress && article.status !== "published" && (
          <div className="mb-6 flex flex-wrap gap-3">
            {(article.status === "review" || article.status === "draft") && (
              <button
                onClick={() => handleAction("approve")}
                disabled={actionLoading}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {actionLoading ? "…" : "✓ Approuver"}
              </button>
            )}
            {article.status === "approved" && (
              <button
                onClick={() => handleAction("publish")}
                disabled={actionLoading}
                className="rounded-lg bg-good px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {actionLoading ? "Publication…" : "🚀 Publier sur LinkedIn"}
              </button>
            )}
            {error && <p className="text-sm text-bad self-center">{error}</p>}
          </div>
        )}

        {/* Published info */}
        {article.status === "published" && (
          <div className="mb-6 rounded-xl border border-good/30 bg-good/10 p-4 flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-sm font-medium text-good">Article publié</p>
              {article.published_at && (
                <p className="text-xs text-muted">
                  {new Date(article.published_at).toLocaleDateString("fr-FR", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              )}
              {article.linkedin_post_url && (
                <a
                  href={article.linkedin_post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  Voir sur LinkedIn →
                </a>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        {!isInProgress && article.status !== "idea" && (
          <>
            <div className="mb-4 flex gap-1 rounded-xl border border-border bg-card p-1">
              {(["content", "review", "linkedin"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    tab === t
                      ? "bg-accent text-accent-fg"
                      : "text-muted hover:text-text"
                  }`}
                >
                  {t === "content" ? "Contenu" : t === "review" ? "Revue IA" : "LinkedIn"}
                </button>
              ))}
            </div>

            {/* Content tab */}
            {tab === "content" && (
              <div className="space-y-4">
                {/* SEO info */}
                {(article.seo_title || article.seo_description) && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">SEO</h3>
                    {article.seo_title && (
                      <p className="text-sm font-medium text-text mb-1">{article.seo_title}</p>
                    )}
                    {article.seo_description && (
                      <p className="text-xs text-muted">{article.seo_description}</p>
                    )}
                    {article.slug && (
                      <p className="mt-2 font-mono text-[11px] text-muted">/{article.slug}</p>
                    )}
                  </div>
                )}

                {/* Article content */}
                {article.content_markdown && (
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Contenu Markdown</h3>
                    <pre className="whitespace-pre-wrap text-sm text-text leading-relaxed font-sans overflow-auto max-h-[500px]">
                      {article.content_markdown}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Review tab */}
            {tab === "review" && article.review && (
              <div className="space-y-4">
                {/* Scores */}
                <div className="grid grid-cols-2 gap-3">
                  <ScoreCard label="Qualité" score={article.review.quality_score} />
                  <ScoreCard label="SEO" score={article.review.seo_score} />
                </div>

                {/* Risk badges */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Risques</h3>
                  <div className="flex flex-wrap gap-3">
                    <RiskBadge label="Risque factuel" level={article.review.factual_risk} />
                    <RiskBadge label="Risque dupliquer" level={article.review.duplicate_risk} />
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted">Relecture humaine :</span>
                      <span className={`text-xs font-medium ${article.review.needs_human_review ? "text-warn" : "text-good"}`}>
                        {article.review.needs_human_review ? "Recommandée" : "Non requise"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {article.review.review_notes && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Notes de la revue</h3>
                    <p className="text-sm text-text leading-relaxed">{article.review.review_notes}</p>
                  </div>
                )}

                {/* Suggested edits */}
                {article.review.suggested_edits?.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Suggestions d'amélioration</h3>
                    <ul className="space-y-1.5">
                      {article.review.suggested_edits.map((edit, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-text">
                          <span className="text-accent mt-0.5">→</span>
                          <span>{edit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* LinkedIn tab */}
            {tab === "linkedin" && article.linkedin_variants && (
              <div className="space-y-4">
                {/* Hook */}
                {article.linkedin_variants.hook && (
                  <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">Hook</h3>
                    <p className="text-sm font-medium text-text">{article.linkedin_variants.hook}</p>
                  </div>
                )}

                {/* Full post */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Post LinkedIn complet</h3>
                    <CopyButton text={article.linkedin_variants.post} />
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-text leading-relaxed font-sans">
                    {article.linkedin_variants.post}
                  </pre>
                </div>

                {/* Short variant */}
                {article.linkedin_variants.short_variant && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Version courte (Twitter/X)</h3>
                      <CopyButton text={article.linkedin_variants.short_variant} />
                    </div>
                    <p className="text-sm text-text">{article.linkedin_variants.short_variant}</p>
                  </div>
                )}

                {/* Hashtags */}
                {article.linkedin_variants.hashtags?.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Hashtags</h3>
                    <div className="flex flex-wrap gap-2">
                      {article.linkedin_variants.hashtags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Empty state for tabs */}
            {tab === "review" && !article.review && (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-sm text-muted">Revue IA non disponible pour cet article.</p>
              </div>
            )}
            {tab === "linkedin" && !article.linkedin_variants && (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-sm text-muted">Variantes LinkedIn non disponibles.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ label, score }: { label: string; score: number }) {
  const color = score >= 75 ? "text-good" : score >= 50 ? "text-warn" : "text-bad";
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <p className={`text-3xl font-bold ${color}`}>{score}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

function RiskBadge({ label, level }: { label: string; level: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted">{label} :</span>
      <span className={`text-xs font-semibold capitalize ${RISK_COLOR[level] ?? "text-muted"}`}>
        {level === "low" ? "Faible" : level === "medium" ? "Modéré" : "Élevé"}
      </span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="text-xs text-muted hover:text-text transition-colors"
    >
      {copied ? "✓ Copié" : "Copier"}
    </button>
  );
}
