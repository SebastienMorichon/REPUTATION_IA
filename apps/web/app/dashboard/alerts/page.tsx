"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, type Brand } from "@/lib/api";

interface Alert {
  id: string;
  kind: "absent" | "negative" | "failed" | "new_citation";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  brand_id: string;
  run_id: string;
  provider: string;
  created_at: string;
}

const KIND_LABEL: Record<Alert["kind"], string> = {
  absent:       "Marque absente",
  negative:     "Sentiment négatif",
  failed:       "Run en erreur",
  new_citation: "Nouvelle source",
};

const KIND_ICON: Record<Alert["kind"], string> = {
  absent:       "👻",
  negative:     "⚠️",
  failed:       "❌",
  new_citation: "🔗",
};

function severityStyle(s: Alert["severity"]): { dot: string; badge: string } {
  return {
    high:   { dot: "bg-bad",  badge: "bg-bad/10 text-bad border-bad/20" },
    medium: { dot: "bg-warn", badge: "bg-warn/10 text-warn border-warn/20" },
    low:    { dot: "bg-muted",badge: "bg-card text-muted border-border" },
  }[s] ?? { dot: "bg-muted", badge: "bg-card text-muted border-border" };
}

export default function AlertsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    apiFetch<Brand[]>("/brands").then(setBrands);
  }, []);

  useEffect(() => {
    if (!brands.length) return;
    setLoading(true);
    Promise.all(
      brands.map((b) =>
        apiFetch<Alert[]>(`/brands/${b.id}/alerts?days=${days}`).catch(() => [] as Alert[])
      )
    )
      .then((results) => setAlerts(results.flat()))
      .finally(() => setLoading(false));
  }, [brands, days]);

  const high   = alerts.filter((a) => a.severity === "high");
  const medium = alerts.filter((a) => a.severity === "medium");
  const low    = alerts.filter((a) => a.severity === "low");

  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="num text-3xl text-text">Alertes</h1>
          <p className="mt-1 text-sm text-muted">
            Anomalies détectées automatiquement sur vos runs récents.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Fenêtre :</span>
          {[3, 7, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                days === d ? "bg-sidebar text-[#E4E2DC]" : "bg-card text-muted hover:text-text border border-border"
              }`}
            >
              {d}j
            </button>
          ))}
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3">
        {[
          { label: "Critique", count: high.length,   color: "text-bad"  },
          { label: "Moyen",    count: medium.length, color: "text-warn" },
          { label: "Info",     count: low.length,    color: "text-muted"},
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-3 py-3 px-4">
            <span className={`num text-2xl ${s.color}`}>{s.count}</span>
            <span className="text-sm text-muted">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Alerts list */}
      {loading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : alerts.length === 0 ? (
        <div className="card">
          <p className="text-sm text-muted">
            ✅ Aucune alerte sur les {days} derniers jours.{" "}
            {brands.length === 0 && (
              <>
                Commencez par{" "}
                <Link href="/dashboard/brands/new" className="text-text underline underline-offset-2">
                  créer une marque
                </Link>{" "}
                et lancer vos premiers runs.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const style = severityStyle(alert.severity);
            return (
              <div key={alert.id} className="card flex gap-4">
                {/* Severity dot */}
                <div className="mt-1 flex-shrink-0">
                  <span className={`block h-2 w-2 rounded-full ${style.dot}`} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span>{KIND_ICON[alert.kind]}</span>
                      <span className="font-medium text-text">{alert.title}</span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wide ${style.badge}`}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3 text-xs text-muted">
                      <span className="capitalize">{brandName(alert.brand_id)}</span>
                      <span>·</span>
                      <span className="capitalize">{alert.provider}</span>
                      <span>·</span>
                      <span>{new Date(alert.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>

                  <div className="mt-2 whitespace-pre-line text-sm text-muted">
                    {alert.description}
                  </div>

                  <div className="mt-3">
                    <Link
                      href={`/dashboard/brands/${alert.brand_id}/runs/${alert.run_id}`}
                      className="text-xs font-medium text-text underline underline-offset-2 hover:opacity-70"
                    >
                      Voir le run →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
