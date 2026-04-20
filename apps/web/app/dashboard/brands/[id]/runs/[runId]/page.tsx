"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, type Mention, type Citation, type Prompt, type PromptRun } from "@/lib/api";
import { MarkdownContent } from "@/components/MarkdownContent";

type PageProps = { params: Promise<{ id: string; runId: string }> };

/* ─── helpers ────────────────────────────────────────────── */

function StatusBadge({ status }: { status: PromptRun["status"] }) {
  const styles = {
    done:    { label: "✓ Terminé",    bg: "rgba(45,158,95,0.15)",  color: "var(--good)" },
    failed:  { label: "✗ Erreur",     bg: "rgba(217,64,64,0.15)",  color: "var(--bad)"  },
    pending: { label: "⏳ En attente", bg: "rgba(201,123,24,0.15)", color: "var(--warn)" },
    running: { label: "⏳ En cours",   bg: "rgba(201,123,24,0.15)", color: "var(--warn)" },
  } as const;
  const s = styles[status];
  return (
    <span className="rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return null;
  const map: Record<string, { label: string; bg: string; color: string }> = {
    positive: { label: "Positif", bg: "rgba(45,158,95,0.15)",   color: "var(--good)" },
    neutral:  { label: "Neutre",  bg: "rgba(122,121,114,0.12)", color: "var(--muted)" },
    negative: { label: "Négatif", bg: "rgba(217,64,64,0.15)",   color: "var(--bad)"  },
    cautious: { label: "Mitigé",  bg: "rgba(201,123,24,0.15)",  color: "var(--warn)" },
  };
  const s = map[sentiment] ?? { label: sentiment, bg: "rgba(122,121,114,0.12)", color: "var(--muted)" };
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function MentionCard({ m }: { m: Mention }) {
  const isTarget = m.is_target_brand;
  return (
    <li className="rounded-xl border p-3" style={{
      borderColor: isTarget ? "rgba(61,122,41,0.35)" : "var(--border)",
      background:  isTarget ? "rgba(61,122,41,0.05)" : "transparent",
    }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {m.rank_position != null && (
            <span className="num text-sm font-bold text-text">#{m.rank_position}</span>
          )}
          <span className="text-sm font-semibold text-text">{m.entity_name}</span>
          {isTarget && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: "rgba(61,122,41,0.15)", color: "#3D7A29" }}
              title="L'analyseur a identifié cette entité comme votre marque — vérifiez que le nom apparaît bien dans la réponse ci-dessus"
            >
              Votre marque
            </span>
          )}
          {m.is_known_competitor && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: "rgba(201,123,24,0.15)", color: "var(--warn)" }}>
              Concurrent
            </span>
          )}
        </div>
        <SentimentBadge sentiment={m.sentiment} />
      </div>
      {m.context_excerpt && (
        <p className="mt-2 text-xs italic leading-relaxed text-muted">
          &ldquo;{m.context_excerpt}&rdquo;
        </p>
      )}
    </li>
  );
}

function CitationCard({ c }: { c: Citation }) {
  return (
    <li className="rounded-xl border p-3" style={{
      borderColor: c.refers_to_target ? "rgba(61,122,41,0.35)" : "var(--border)",
      background:  c.refers_to_target ? "rgba(61,122,41,0.05)" : "transparent",
    }}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {c.title && <p className="truncate text-sm font-medium text-text">{c.title}</p>}
          {c.url ? (
            <a href={c.url} target="_blank" rel="noopener noreferrer"
              className="block truncate text-xs text-muted hover:underline">
              {c.domain || c.url}
            </a>
          ) : c.domain ? (
            <p className="text-xs text-muted">{c.domain}</p>
          ) : null}
        </div>
        {c.refers_to_target && (
          <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "rgba(61,122,41,0.15)", color: "#3D7A29" }}>
            Votre marque
          </span>
        )}
      </div>
    </li>
  );
}

/* ─── page ───────────────────────────────────────────────── */

export default function RunDetailPage({ params }: PageProps) {
  const { id, runId } = use(params);

  const [run, setRun]         = useState<PromptRun | null>(null);
  const [prompt, setPrompt]   = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function loadAll() {
      try {
        const [r, prompts] = await Promise.all([
          apiFetch<PromptRun>(`/brands/${id}/runs/${runId}`),
          apiFetch<Prompt[]>(`/brands/${id}/prompts`),
        ]);
        setRun(r);
        setPrompt(prompts.find((p) => p.id === r.prompt_id) ?? null);

        // Poll every 3s until finished
        if (r.status !== "done" && r.status !== "failed") {
          intervalRef.current = setInterval(async () => {
            try {
              const updated = await apiFetch<PromptRun>(`/brands/${id}/runs/${runId}`);
              setRun(updated);
              if (updated.status === "done" || updated.status === "failed") {
                if (intervalRef.current) clearInterval(intervalRef.current);
              }
            } catch { /* ignore polling errors */ }
          }, 3000);
        }
      } catch (e) {
        setPageError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    loadAll();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [id, runId]);

  if (loading)   return <p className="text-sm text-muted">Chargement…</p>;
  if (pageError) return <p className="text-sm text-bad">{pageError}</p>;
  if (!run)      return null;

  const providerColor  = run.provider === "anthropic" ? "#CC785C" : "#10A37F";
  const targetMention  = run.mentions.find((m) => m.is_target_brand);
  const sortedMentions = run.mentions.slice().sort((a, b) => {
    if (a.is_target_brand && !b.is_target_brand) return -1;
    if (!a.is_target_brand && b.is_target_brand) return 1;
    if (a.rank_position != null && b.rank_position != null) return a.rank_position - b.rank_position;
    return 0;
  });
  const sortedCitations = run.citations.slice().sort(
    (a, b) => (b.refers_to_target ? 1 : 0) - (a.refers_to_target ? 1 : 0)
  );

  return (
    <div className="space-y-5">

      {/* ── Back ── */}
      <Link href={`/dashboard/brands/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        ← Retour à la marque
      </Link>

      {/* ── Header card ── */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* Provider */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ background: providerColor }}>
              {run.provider[0].toUpperCase()}
            </div>
            <div>
              <div className="font-semibold capitalize text-text">{run.provider}</div>
              <div className="text-xs text-muted">{run.model}</div>
            </div>
          </div>
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={run.status} />
            {run.latency_ms != null && (
              <span className="text-xs text-muted">{(run.latency_ms / 1000).toFixed(1)} s</span>
            )}
            {run.input_tokens != null && (
              <span className="text-xs text-muted">
                {(run.input_tokens + (run.output_tokens ?? 0)).toLocaleString("fr-FR")} tokens
              </span>
            )}
            {run.executed_at && (
              <span className="text-xs text-muted">
                {new Date(run.executed_at).toLocaleString("fr-FR", {
                  dateStyle: "short", timeStyle: "short",
                })}
              </span>
            )}
          </div>
        </div>

        {/* Question */}
        {prompt && (
          <div className="mt-4 rounded-xl p-3"
            style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              Question posée à l&apos;IA
            </div>
            <p className="text-sm font-medium text-text">{prompt.text}</p>
          </div>
        )}

        {/* Quick-stats strip (done only) */}
        {run.status === "done" && (
          <div className="mt-4 flex flex-wrap gap-2">
            {/* Citée */}
            <div className="rounded-lg px-3 py-2 text-center"
              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
              <div className="text-[11px] text-muted">Citée</div>
              <div className="num mt-0.5 text-lg font-bold text-text">
                {targetMention ? "✓" : "○"}
              </div>
              {targetMention && (
                <div className="mt-0.5 max-w-[120px] truncate text-[10px] text-muted"
                  title={targetMention.entity_name}>
                  {targetMention.entity_name}
                </div>
              )}
            </div>

            {/* Position */}
            {targetMention?.rank_position != null && (
              <div className="rounded-lg px-3 py-2 text-center"
                style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <div className="text-[11px] text-muted">Position</div>
                <div className="num mt-0.5 text-lg font-bold text-text">
                  #{targetMention.rank_position}
                </div>
              </div>
            )}

            {/* Entités / Sources */}
            {[
              { label: "Entités", value: String(run.mentions.length) },
              { label: "Sources", value: String(run.citations.length) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg px-3 py-2 text-center"
                style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <div className="text-[11px] text-muted">{label}</div>
                <div className="num mt-0.5 text-lg font-bold text-text">{value}</div>
              </div>
            ))}

            {/* Ton */}
            {targetMention?.sentiment && (
              <div className="rounded-lg px-3 py-2 text-center"
                style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <div className="text-[11px] text-muted">Ton</div>
                <div className="mt-1.5">
                  <SentimentBadge sentiment={targetMention.sentiment} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {run.status === "failed" && run.error && (
        <div className="card" style={{ borderColor: "rgba(217,64,64,0.3)" }}>
          <div className="label mb-2" style={{ color: "var(--bad)" }}>Erreur</div>
          <pre className="whitespace-pre-wrap text-sm" style={{ color: "var(--bad)" }}>
            {run.error}
          </pre>
        </div>
      )}

      {/* ── Pending / Running ── */}
      {(run.status === "pending" || run.status === "running") && (
        <div className="card">
          <div className="flex items-center gap-3">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--warn)", borderTopColor: "transparent" }} />
            <p className="text-sm text-muted">
              {run.status === "pending" ? "En attente d'exécution…" : "L'IA génère sa réponse…"}
            </p>
          </div>
        </div>
      )}

      {/* ── Raw AI response ── */}
      {run.raw_response && (
        <div className="card">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold text-white"
              style={{ background: providerColor }}>
              {run.provider[0].toUpperCase()}
            </div>
            <div className="label">Réponse de l&apos;IA</div>
          </div>
          <div
            className="rounded-xl p-4"
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              maxHeight: "560px",
              overflowY: "auto",
            }}
          >
            <MarkdownContent content={run.raw_response} />
          </div>
        </div>
      )}

      {/* ── Extracted analysis ── */}
      {run.status === "done" && (
        <div className="grid gap-4 lg:grid-cols-2">

          {/* Mentions */}
          <div className="card">
            <div className="label mb-1">Entités détectées</div>
            <p className="mb-3 text-sm text-muted">Marques et organisations citées dans la réponse</p>
            {sortedMentions.length === 0 ? (
              <p className="text-sm text-muted">Aucune entité détectée.</p>
            ) : (
              <ul className="space-y-2">
                {sortedMentions.map((m, i) => <MentionCard key={i} m={m} />)}
              </ul>
            )}
          </div>

          {/* Citations */}
          <div className="card">
            <div className="label mb-1">Sources citées</div>
            <p className="mb-3 text-sm text-muted">Liens et domaines référencés dans la réponse</p>
            {sortedCitations.length === 0 ? (
              <p className="text-sm text-muted">Aucune source citée dans cette réponse.</p>
            ) : (
              <ul className="space-y-2">
                {sortedCitations.map((c, i) => <CitationCard key={i} c={c} />)}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
