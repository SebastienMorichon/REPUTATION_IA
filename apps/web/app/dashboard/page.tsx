"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, type Brand, type ProviderStatus } from "@/lib/api";

export default function DashboardHome() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiFetch<Brand[]>("/brands"), apiFetch<ProviderStatus[]>("/providers")])
      .then(([b, p]) => { setBrands(b); setProviders(p); })
      .finally(() => setLoading(false));
  }, []);

  const enabledProviders = providers.filter((p) => p.enabled);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="num text-3xl text-text">Vos marques</h1>
          <p className="mt-1 text-sm text-muted">
            Suivez comment les IA parlent de vos marques.
          </p>
        </div>
        <Link href="/dashboard/brands/new" className="btn-primary">+ Nouvelle marque</Link>
      </div>

      {/* Provider status */}
      <div className="card">
        <div className="label">Providers LLM configurés</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {providers.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: p.enabled ? "var(--good)" : "var(--border)",
                background: p.enabled ? "var(--good)/10" : "transparent",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: p.enabled ? "var(--good)" : "var(--muted)" }}
              />
              <span className="font-medium capitalize text-text">{p.name}</span>
              <span className="text-muted">{p.default_model}</span>
              {!p.enabled && <span className="text-muted italic">(désactivé)</span>}
            </div>
          ))}
          {providers.length === 0 && <span className="text-sm text-muted">Aucun provider chargé.</span>}
        </div>
        {enabledProviders.length === 0 && (
          <p className="mt-3 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
            Aucun provider activé. Renseignez une clé API et mettez <code>*_ENABLED=true</code> dans <code>.env</code>, puis redémarrez l&apos;API.
          </p>
        )}
      </div>

      {/* Brands grid */}
      {loading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : brands.length === 0 ? (
        <div className="card">
          <p className="text-sm text-muted">
            Aucune marque.{" "}
            <Link href="/dashboard/brands/new" className="font-medium text-text underline underline-offset-2">
              Créer votre première marque →
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {brands.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/brands/${b.id}`}
              className="card group flex flex-col gap-3 hover:border-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                  style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
                >
                  {b.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-text">{b.name}</div>
                  <div className="truncate text-xs text-muted">{b.domain || "—"}</div>
                </div>
              </div>
              {b.category && (
                <div className="inline-flex w-fit items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted">
                  {b.category}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
