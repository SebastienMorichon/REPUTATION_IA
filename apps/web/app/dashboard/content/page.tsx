"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getUser, type ArticleListItem, type Brand, ApiError } from "@/lib/api";

const STATUS_CONFIG: Record<
  ArticleListItem["status"],
  { label: string; dot: string; badge: string }
> = {
  idea:      { label: "Idée",       dot: "bg-muted",  badge: "bg-muted/10 text-muted border-muted/20" },
  drafting:  { label: "En cours…",  dot: "bg-warn",   badge: "bg-warn/10 text-warn border-warn/20" },
  draft:     { label: "Brouillon",  dot: "bg-warn",   badge: "bg-warn/10 text-warn border-warn/20" },
  review:    { label: "À relire",   dot: "bg-accent", badge: "bg-accent/10 text-accent border-accent/20" },
  approved:  { label: "Approuvé",   dot: "bg-good",   badge: "bg-good/10 text-good border-good/20" },
  published: { label: "Publié",     dot: "bg-good",   badge: "bg-good/10 text-good border-good/20" },
  failed:    { label: "Erreur",     dot: "bg-bad",    badge: "bg-bad/10 text-bad border-bad/20" },
};

function StatusBadge({ status }: { status: ArticleListItem["status"] }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.idea;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${c.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export default function ContentPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [topicHint, setTopicHint] = useState("");
  const [error, setError] = useState<string | null>(null);

  function fetchArticles() {
    return apiFetch<ArticleListItem[]>("/content/articles").then(setArticles);
  }

  useEffect(() => {
    // Guard: redirect non-admins immediately
    const user = getUser();
    if (!user?.is_admin) {
      router.replace("/dashboard");
      return;
    }
    Promise.all([
      fetchArticles(),
      apiFetch<Brand[]>("/brands").then(setBrands),
    ]).finally(() => setLoading(false));
  }, [router]);

  // Poll while any article is in an in-progress status
  useEffect(() => {
    const hasPending = articles.some((a) => a.status === "idea" || a.status === "drafting");
    if (!hasPending) return;
    const timer = setInterval(fetchArticles, 6000);
    return () => clearInterval(timer);
  }, [articles]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      await apiFetch<ArticleListItem>("/content/articles/generate", {
        method: "POST",
        body: JSON.stringify({
          brand_id: selectedBrandId || null,
          topic_hint: topicHint || null,
        }),
      });
      await fetchArticles();
      setTopicHint("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors du lancement");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-muted text-sm">Chargement…</p>
      </div>
    );
  }

  const byStatus = (s: ArticleListItem["status"]) => articles.filter((a) => a.status === s);
  const inProgress = [...byStatus("idea"), ...byStatus("drafting")];
  const needsReview = byStatus("review");
  const approved = byStatus("approved");
  const published = byStatus("published");
  const failed = byStatus("failed");
  const drafts = byStatus("draft");

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text">Contenu éditorial</h1>
            <p className="mt-1 text-sm text-muted">
              Pipeline automatisé : idée → rédaction → relecture → publication LinkedIn
            </p>
          </div>
          <Link
            href="/blog"
            target="_blank"
            className="text-sm text-muted hover:text-accent transition-colors"
          >
            Blog public →
          </Link>
        </div>

        {/* Generate card */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-text">Générer un nouvel article</h2>
          <div className="flex flex-wrap gap-3">
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="flex-1 min-w-[160px] rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Marque automatique</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={topicHint}
              onChange={(e) => setTopicHint(e.target.value)}
              placeholder="Thème / hint (optionnel)"
              className="flex-[2] min-w-[200px] rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {generating ? "Lancement…" : "✦ Générer"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-bad">{error}</p>}
        </div>

        {articles.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <p className="text-4xl mb-3">✍️</p>
            <p className="text-sm text-muted">
              Aucun article pour l&apos;instant. Cliquez sur &quot;Générer&quot; pour démarrer le pipeline.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* In-progress */}
            {inProgress.length > 0 && (
              <Section title="En cours de génération" articles={inProgress} brands={brands} />
            )}

            {/* Needs review */}
            {needsReview.length > 0 && (
              <Section title="À relire" articles={needsReview} brands={brands} highlight />
            )}

            {/* Approved */}
            {approved.length > 0 && (
              <Section title="Approuvés — prêts à publier" articles={approved} brands={brands} />
            )}

            {/* Drafts */}
            {drafts.length > 0 && (
              <Section title="Brouillons" articles={drafts} brands={brands} />
            )}

            {/* Published */}
            {published.length > 0 && (
              <Section title="Publiés" articles={published} brands={brands} />
            )}

            {/* Failed */}
            {failed.length > 0 && (
              <Section title="Erreurs" articles={failed} brands={brands} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  articles,
  brands,
  highlight = false,
}: {
  title: string;
  articles: ArticleListItem[];
  brands: Brand[];
  highlight?: boolean;
}) {
  return (
    <div>
      <h2
        className={`mb-2 text-xs font-semibold uppercase tracking-wider ${
          highlight ? "text-accent" : "text-muted"
        }`}
      >
        {title}
      </h2>
      <div className="space-y-2">
        {articles.map((a) => (
          <ArticleRow key={a.id} article={a} brands={brands} />
        ))}
      </div>
    </div>
  );
}

function ArticleRow({ article, brands }: { article: ArticleListItem; brands: Brand[] }) {
  const brand = brands.find((b) => b.id === article.brand_id);
  const isInProgress = article.status === "idea" || article.status === "drafting";

  return (
    <Link
      href={`/dashboard/content/${article.id}`}
      className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 hover:border-accent/40 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <StatusBadge status={article.status} />
          {brand && (
            <span className="text-[11px] text-muted">{brand.name}</span>
          )}
        </div>
        {isInProgress ? (
          <p className="text-sm text-muted italic">
            {article.status === "idea" ? "En attente du pipeline…" : "Rédaction en cours…"}
          </p>
        ) : (
          <p className="text-sm font-medium text-text truncate">
            {article.title || "(sans titre)"}
          </p>
        )}
        {article.excerpt && !isInProgress && (
          <p className="text-[12px] text-muted truncate mt-0.5">{article.excerpt}</p>
        )}
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-[11px] text-muted">
          {new Date(article.created_at).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
          })}
        </p>
        {article.published_at && (
          <p className="text-[11px] text-good">
            Publié {new Date(article.published_at).toLocaleDateString("fr-FR")}
          </p>
        )}
      </div>
    </Link>
  );
}
