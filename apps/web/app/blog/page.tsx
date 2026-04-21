import Link from "next/link";
import type { BlogPost } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getBlogPosts(): Promise<BlogPost[]> {
  try {
    const res = await fetch(`${API_URL}/content/blog?limit=20`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export const metadata = {
  title: "Blog — AI Reputation Shield",
  description:
    "Conseils, analyses et stratégies pour maîtriser comment ChatGPT, Claude et Perplexity présentent votre marque.",
  openGraph: {
    title: "Blog — AI Reputation Shield",
    description: "Ressources sur la réputation de marque dans les IA génératives.",
    type: "website",
  },
};

function readingTime(excerpt: string | null): number {
  if (!excerpt) return 3;
  const words = excerpt.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil((words * 10) / 200)); // excerpt ≈ 10% of article
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogPage() {
  const posts = await getBlogPosts();
  const [featured, ...rest] = posts;

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-border bg-card py-16 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-accent">
          Blog
        </p>
        <h1 className="text-4xl font-bold text-text md:text-5xl">
          Réputation IA
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-muted">
          Conseils, analyses et stratégies pour maîtriser comment ChatGPT, Claude et Perplexity
          présentent votre marque.
        </p>
      </section>

      {posts.length === 0 ? (
        /* ── Empty state ─────────────────────────────────────── */
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <div className="mb-5 text-5xl">✍️</div>
          <h2 className="text-xl font-semibold text-text">Le blog arrive bientôt</h2>
          <p className="mt-3 text-sm text-muted">
            Nos premiers articles sont en cours de rédaction. Revenez dans quelques jours !
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg hover:opacity-90 transition-opacity"
          >
            Essayer gratuitement en attendant →
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-5xl px-6 py-14">

          {/* ── Article vedette ────────────────────────────────── */}
          {featured && (
            <Link
              href={`/blog/${featured.slug}`}
              className="group mb-12 flex flex-col gap-6 overflow-hidden rounded-2xl border border-border bg-card p-8 transition-all hover:border-accent/40 hover:shadow-md md:flex-row md:items-center"
            >
              {/* Accent block */}
              <div className="flex h-40 w-full shrink-0 items-center justify-center rounded-xl bg-accent/10 md:h-36 md:w-52">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                    À la une
                  </span>
                  {featured.published_at && (
                    <span className="text-xs text-muted">{formatDate(featured.published_at)}</span>
                  )}
                  <span className="text-xs text-muted">· {readingTime(featured.excerpt)} min de lecture</span>
                </div>
                <h2 className="text-2xl font-bold text-text leading-snug group-hover:text-accent transition-colors">
                  {featured.title}
                </h2>
                {featured.excerpt && (
                  <p className="mt-3 text-sm leading-relaxed text-muted line-clamp-3">
                    {featured.excerpt}
                  </p>
                )}
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                  Lire l&apos;article <span className="group-hover:translate-x-1 transition-transform">→</span>
                </span>
              </div>
            </Link>
          )}

          {/* ── Grille d'articles ───────────────────────────────── */}
          {rest.length > 0 && (
            <>
              <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-muted">
                Tous les articles
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {rest.map((post) => (
                  <ArticleCard key={post.slug} post={post} />
                ))}
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}

function ArticleCard({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:border-accent/40 hover:shadow-sm"
    >
      {/* Top meta */}
      <div className="mb-3 flex items-center gap-2 text-xs text-muted">
        {post.published_at && <span>{formatDate(post.published_at)}</span>}
        <span>·</span>
        <span>{readingTime(post.excerpt)} min</span>
      </div>

      <h3 className="flex-1 text-base font-semibold text-text leading-snug group-hover:text-accent transition-colors">
        {post.title}
      </h3>

      {post.excerpt && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted line-clamp-2">{post.excerpt}</p>
      )}

      <span className="mt-4 text-xs font-medium text-accent opacity-0 group-hover:opacity-100 transition-opacity">
        Lire →
      </span>
    </Link>
  );
}
