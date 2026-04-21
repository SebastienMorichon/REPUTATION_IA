"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, type Brand, type Scores } from "@/lib/api";

interface BrandWithScore extends Brand {
  scores?: Scores | null;
}

function getScoreGrade(score: number): { grade: string; color: string; label: string } {
  if (score >= 75) return { grade: "A", color: "var(--good)", label: "Excellent" };
  if (score >= 60) return { grade: "B", color: "var(--accent)", label: "Bon" };
  if (score >= 45) return { grade: "C", color: "var(--warn)", label: "Moyen" };
  if (score >= 30) return { grade: "D", color: "orange", label: "Faible" };
  return { grade: "E", color: "var(--bad)", label: "Critique" };
}

function formatPct(value: number | undefined | null): string {
  if (value == null) return "—";
  return `${Math.round(value)}%`;
}

export default function BrandsList() {
  const [brands, setBrands] = useState<BrandWithScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Brand[]>("/brands")
      .then(async (brandList) => {
        // Fetch scores for each brand
        const brandsWithScores = await Promise.all(
          brandList.map(async (b) => {
            try {
              const scores = await apiFetch<Scores>(`/brands/${b.id}/scores?days=30`).catch(() => null);
              return { ...b, scores };
            } catch {
              return { ...b, scores: null };
            }
          })
        );
        setBrands(brandsWithScores);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Marques</h1>
          <p className="text-sm text-muted">Gérez et suivez vos marques</p>
        </div>
        <Link href="/dashboard/brands/new" className="btn-primary">+ Nouvelle marque</Link>
      </div>
      {loading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : brands.length === 0 ? (
        <div className="card text-center py-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl" style={{ background: "var(--accent)/20" }}>
            🏷️
          </div>
          <h2 className="text-xl font-semibold text-text">Aucune marque</h2>
          <p className="mt-2 text-sm text-muted max-w-md mx-auto">
            Créez votre première marque pour commencer à analyser votre réputation IA.
          </p>
          <Link href="/dashboard/brands/new" className="btn-primary mt-6 inline-flex">
            + Créer une marque
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((b) => {
            const visibility = b.scores?.visibility_score ?? null;
            const grade = visibility != null ? getScoreGrade(visibility) : null;

            return (
              <Link
                key={b.id}
                href={`/dashboard/brands/${b.id}`}
                className="card group hover:border-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  {/* Logo/Initial */}
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                    style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
                  >
                    {b.name.slice(0, 2).toUpperCase()}
                  </div>

                  {/* Score badge */}
                  {grade ? (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold"
                      style={{ background: grade.color, color: "white" }}
                      title={grade.label}
                    >
                      {grade.grade}
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-border text-xs text-muted">
                      —
                    </div>
                  )}
                </div>

                {/* Brand info */}
                <div className="mt-4">
                  <h3 className="font-medium text-text group-hover:text-accent transition-colors">{b.name}</h3>
                  {b.domain && (
                    <p className="mt-0.5 text-xs text-muted truncate">{b.domain}</p>
                  )}
                  {b.category && (
                    <span className="mt-2 inline-flex rounded-md border border-border px-2 py-0.5 text-xs text-muted">
                      {b.category}
                    </span>
                  )}
                </div>

                {/* Visibility score */}
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-xs text-muted">Visibilité IA</div>
                    <div className="num text-2xl font-bold" style={{ color: grade?.color || "var(--muted)" }}>
                      {formatPct(visibility)}
                    </div>
                  </div>
                  {grade && (
                    <div className="text-xs" style={{ color: grade.color }}>
                      {grade.label}
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {visibility != null && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${visibility}%`, background: grade?.color || "var(--accent)" }}
                    />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
