import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { BlogPostFull } from "@/lib/api";
import { BlogMarkdown } from "@/components/BlogMarkdown";
import { ShareLinkedIn } from "@/components/ShareLinkedIn";
import { slugifyHeading } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reputation-iaa.vercel.app";

interface Props {
  params: Promise<{ slug: string }>;
}

/* ─── Data fetching ──────────────────────────────────────── */

async function getPost(slug: string): Promise<BlogPostFull | null> {
  try {
    const res = await fetch(`${API_URL}/content/blog/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getRelatedPosts(currentSlug: string): Promise<BlogPostFull[]> {
  try {
    const res = await fetch(`${API_URL}/content/blog?limit=4`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const all: BlogPostFull[] = await res.json();
    return all.filter((p) => p.slug !== currentSlug).slice(0, 3);
  } catch {
    return [];
  }
}

/* ─── Helpers ────────────────────────────────────────────── */

function readingTime(markdown: string): number {
  const words = markdown.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface TocItem {
  level: 2 | 3;
  text: string;
  id: string;
}

function extractToc(markdown: string): TocItem[] {
  return markdown
    .split("\n")
    .filter((l) => l.startsWith("## ") || l.startsWith("### "))
    .map((l) => {
      const level = l.startsWith("### ") ? 3 : 2;
      const text = l.replace(/^#{2,3} /, "");
      return { level, text, id: slugifyHeading(text) } as TocItem;
    });
}

/* ─── SEO metadata ───────────────────────────────────────── */

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Article introuvable" };

  const title = post.seo_title || post.title || "Article";
  const description = post.seo_description || post.excerpt || "";
  const url = `${SITE_URL}/blog/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "article",
      publishedTime: post.published_at ?? undefined,
      authors: ["AI Reputation Shield"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: { canonical: url },
  };
}

/* ─── Page ───────────────────────────────────────────────── */

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const [post, related] = await Promise.all([getPost(slug), getRelatedPosts(slug)]);

  if (!post) notFound();

  const toc = extractToc(post.content_markdown);
  const mins = readingTime(post.content_markdown);
  const articleUrl = `${SITE_URL}/blog/${slug}`;

  /* JSON-LD structured data */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.published_at,
    author: { "@type": "Organization", name: "AI Reputation Shield" },
    publisher: {
      "@type": "Organization",
      name: "AI Reputation Shield",
      url: SITE_URL,
    },
    url: articleUrl,
  };

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Breadcrumb ───────────────────────────────────────── */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-3">
          <nav className="flex items-center gap-2 text-xs text-muted">
            <Link href="/" className="hover:text-text transition-colors">Accueil</Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-text transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-text truncate max-w-[200px]">{post.title}</span>
          </nav>
        </div>
      </div>

      {/* ── Article header ───────────────────────────────────── */}
      <header className="border-b border-border bg-card py-14">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="mb-5 flex flex-wrap items-center justify-center gap-3 text-xs text-muted">
            {post.published_at && (
              <span>{formatDate(post.published_at)}</span>
            )}
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>{mins} min de lecture</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>AI Reputation Shield</span>
          </div>

          <h1 className="text-3xl font-bold text-text leading-tight md:text-4xl">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted">
              {post.excerpt}
            </p>
          )}
        </div>
      </header>

      {/* ── Body: article + TOC sidebar ──────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex gap-12">

          {/* Article content */}
          <article className="min-w-0 flex-1">
            <BlogMarkdown content={post.content_markdown} />

            {/* Share section */}
            <div className="mt-14 rounded-2xl border border-border bg-card p-6">
              <p className="mb-3 text-sm font-semibold text-text">
                Partager cet article
              </p>
              <div className="flex flex-wrap gap-3">
                <ShareLinkedIn url={articleUrl} title={post.title ?? ""} />
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(post.title ?? "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-4 py-2 text-sm text-muted hover:text-text hover:border-text/30 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
                  </svg>
                  Twitter / X
                </a>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-10 rounded-2xl bg-accent/8 border border-accent/20 p-8 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
                AI Reputation Shield
              </p>
              <h2 className="text-xl font-bold text-text">
                Votre marque est-elle bien représentée par les IA ?
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
                Mesurez votre visibilité dans ChatGPT, Claude et Perplexity en 2 minutes — sans carte bancaire.
              </p>
              <Link
                href="/signup"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg hover:opacity-90 transition-opacity"
              >
                Commencer gratuitement →
              </Link>
            </div>
          </article>

          {/* TOC sidebar */}
          {toc.length > 0 && (
            <aside className="hidden w-56 shrink-0 lg:block">
              <div className="sticky top-28">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted">
                  Dans cet article
                </p>
                <nav className="space-y-1">
                  {toc.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={`block truncate rounded-lg px-3 py-1.5 text-xs leading-relaxed transition-colors hover:bg-card hover:text-accent ${
                        item.level === 3 ? "pl-5 text-muted/80" : "text-muted"
                      }`}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>

                {/* Reading time */}
                <div className="mt-6 rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-text">{mins}</p>
                  <p className="text-[11px] text-muted">min de lecture</p>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ── Related articles ─────────────────────────────────── */}
      {related.length > 0 && (
        <section className="border-t border-border bg-card py-14">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="mb-8 text-xs font-semibold uppercase tracking-widest text-muted">
              À lire aussi
            </h2>
            <div className="grid gap-5 sm:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group flex flex-col rounded-2xl border border-border bg-bg p-5 transition-all hover:border-accent/40 hover:shadow-sm"
                >
                  <p className="mb-2 text-[11px] text-muted">{formatDate(p.published_at)}</p>
                  <h3 className="flex-1 text-sm font-semibold text-text leading-snug group-hover:text-accent transition-colors">
                    {p.title}
                  </h3>
                  {p.excerpt && (
                    <p className="mt-2 text-[12px] text-muted line-clamp-2 leading-relaxed">
                      {p.excerpt}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
