"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, type BillingSubscription } from "@/lib/api";

/* ── Plan metadata ───────────────────────────────────────── */
const PLANS: {
  key: "starter" | "pro" | "agency";
  name: string;
  price: number;
  recommended?: boolean;
  features: string[];
}[] = [
  {
    key: "starter",
    name: "Starter",
    price: 49,
    features: [
      "1 marque suivie",
      "Claude + GPT-4o",
      "1 analyse / semaine",
      "Alertes email",
      "Rapport PDF mensuel",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: 149,
    recommended: true,
    features: [
      "5 marques suivies",
      "Tous les providers IA",
      "Analyses quotidiennes",
      "Alertes email temps réel",
      "Rapports PDF illimités",
      "Recommandations avancées",
    ],
  },
  {
    key: "agency",
    name: "Agence",
    price: 499,
    features: [
      "Marques illimitées",
      "Tous les providers IA",
      "Analyses temps réel",
      "Multi-utilisateurs",
      "Rapports white-label",
      "Support prioritaire",
      "API access",
    ],
  },
];

const PLAN_BADGE_STYLES: Record<string, { background: string; color: string; label: string }> = {
  free:    { background: "rgba(100,116,139,0.15)", color: "var(--muted)",  label: "Gratuit" },
  starter: { background: "rgba(59,130,246,0.15)",  color: "#3B82F6",       label: "Starter" },
  pro:     { background: "rgba(16,163,127,0.15)",  color: "var(--good)",   label: "Pro" },
  agency:  { background: "rgba(139,92,246,0.15)",  color: "#8B5CF6",       label: "Agence" },
};

/* ── FAQ item ────────────────────────────────────────────── */
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-4 text-left text-sm font-medium text-text transition-colors hover:text-muted"
      >
        <span>{question}</span>
        <span
          className="ml-4 flex-shrink-0 text-muted transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>
      {open && (
        <p className="pb-4 text-sm text-muted leading-relaxed">{answer}</p>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────── */
export default function BillingPage() {
  const searchParams = useSearchParams();
  const success  = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(() => {
    setLoadingSub(true);
    apiFetch<BillingSubscription>("/billing/subscription")
      .then(setSubscription)
      .catch(() => setError("Impossible de charger les informations d'abonnement."))
      .finally(() => setLoadingSub(false));
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  async function handlePortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const { portal_url } = await apiFetch<{ portal_url: string }>("/billing/portal", {
        method: "POST",
      });
      window.location.href = portal_url;
    } catch {
      setError("Impossible d'ouvrir le portail client. Réessayez plus tard.");
      setPortalLoading(false);
    }
  }

  async function handleCheckout(plan: string) {
    setCheckoutLoading(plan);
    setError(null);
    try {
      const { checkout_url } = await apiFetch<{ checkout_url: string }>(
        `/billing/checkout?plan=${plan}`,
        { method: "POST" }
      );
      window.location.href = checkout_url;
    } catch {
      setError("Impossible de démarrer le paiement. Réessayez plus tard.");
      setCheckoutLoading(null);
    }
  }

  const currentPlan = subscription?.plan ?? "free";
  const effectivePlan = subscription?.effective_plan ?? currentPlan;
  const stripeEnabled = subscription?.stripe_enabled ?? true;
  const isTrial = subscription?.is_trial ?? false;
  const trialDaysRemaining = subscription?.trial_days_remaining ?? null;
  const badge = PLAN_BADGE_STYLES[effectivePlan] ?? PLAN_BADGE_STYLES[currentPlan] ?? PLAN_BADGE_STYLES.free;
  const trialProgress = trialDaysRemaining !== null ? Math.round((trialDaysRemaining / 14) * 100) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="num text-3xl text-text">Abonnement</h1>
        <p className="mt-1 text-sm text-muted">
          Gérez votre plan et votre facturation.
        </p>
      </div>

      {/* Success / canceled banners */}
      {success === "1" && (
        <div
          className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{ background: "rgba(16,163,127,0.12)", color: "var(--good)", border: "1px solid rgba(16,163,127,0.25)" }}
        >
          Votre abonnement a bien été activé. Bienvenue !
        </div>
      )}
      {canceled === "1" && (
        <div
          className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{ background: "rgba(201,123,24,0.12)", color: "var(--warn)", border: "1px solid rgba(201,123,24,0.25)" }}
        >
          Paiement annulé. Vous pouvez réessayer à tout moment.
        </div>
      )}
      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{ background: "rgba(217,64,64,0.1)", color: "var(--bad)", border: "1px solid rgba(217,64,64,0.2)" }}
        >
          {error}
        </div>
      )}

      {/* ── Section 1 — Plan actuel ─────────────────────────── */}
      {loadingSub ? (
        <div className="card">
          <p className="text-sm text-muted">Chargement…</p>
        </div>
      ) : (
        <div className={effectivePlan !== "free" ? "card-feat" : "card"}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div
                  className="label mb-1"
                  style={effectivePlan !== "free" ? { color: "rgba(228,226,220,0.45)" } : undefined}
                >
                  Votre plan actuel
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-sm font-semibold"
                    style={{ background: badge.background, color: badge.color }}
                  >
                    {isTrial
                      ? subscription?.effective_plan_label ?? badge.label
                      : badge.label}
                  </span>
                  {isTrial && trialDaysRemaining !== null && (
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{
                        background: trialDaysRemaining <= 3
                          ? "rgba(201,123,24,0.15)"
                          : "rgba(197,242,54,0.1)",
                        color: trialDaysRemaining <= 3 ? "var(--warn)" : "var(--accent)",
                      }}
                    >
                      {trialDaysRemaining === 0
                        ? "Dernier jour"
                        : `${trialDaysRemaining} jour${trialDaysRemaining > 1 ? "s" : ""} restant${trialDaysRemaining > 1 ? "s" : ""}`}
                    </span>
                  )}
                </div>

                {/* Trial progress bar */}
                {isTrial && trialProgress !== null && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-xs" style={{ color: "rgba(228,226,220,0.45)" }}>
                      <span>Progression de l&apos;essai</span>
                      <span>{trialDaysRemaining} / 14 jours restants</span>
                    </div>
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full"
                      style={{ background: "rgba(255,255,255,0.1)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${trialProgress}%`,
                          background: trialProgress <= 25
                            ? "var(--bad)"
                            : trialProgress <= 50
                            ? "var(--warn)"
                            : "var(--accent)",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {subscription?.has_active_subscription ? (
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-60"
                style={{ background: "rgba(255,255,255,0.12)", color: "var(--feat-text)" }}
              >
                {portalLoading ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Redirection…
                  </>
                ) : (
                  "Gérer mon abonnement →"
                )}
              </button>
            ) : (
              <p className="text-sm text-muted">
                {isTrial
                  ? "Choisissez un plan avant la fin de votre essai."
                  : "Passez à un plan payant pour débloquer toutes les fonctionnalités."}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Section 2 — Grille de pricing ─────────────────── */}
      <div>
        <div className="label mb-4">Choisir un plan</div>

        {!stripeEnabled && (
          <div
            className="mb-4 rounded-xl px-4 py-3 text-sm"
            style={{ background: "rgba(100,116,139,0.1)", color: "var(--muted)", border: "1px solid var(--border)" }}
          >
            Fonctionnalité de paiement non disponible en local.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.key;
            const isLoading = checkoutLoading === plan.key;

            return (
              <div
                key={plan.key}
                className="card flex flex-col"
                style={
                  plan.recommended
                    ? { borderColor: "var(--accent)", borderWidth: "2px" }
                    : undefined
                }
              >
                {/* Card header */}
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-text">{plan.name}</div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="num text-2xl font-bold text-text">{plan.price}€</span>
                      <span className="text-xs text-muted">/mois</span>
                    </div>
                  </div>
                  {plan.recommended && (
                    <span
                      className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ background: "rgba(var(--accent-rgb, 197,242,54),0.15)", color: "var(--accent)" }}
                    >
                      Recommandé
                    </span>
                  )}
                </div>

                {/* Features */}
                <ul className="mb-6 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 flex-shrink-0 font-bold" style={{ color: "var(--good)" }}>
                        ✓
                      </span>
                      <span className="text-muted">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full rounded-xl px-4 py-2.5 text-sm font-medium"
                    style={{ background: "var(--border)", color: "var(--muted)", cursor: "default" }}
                  >
                    Plan actuel
                  </button>
                ) : stripeEnabled ? (
                  <button
                    onClick={() => handleCheckout(plan.key)}
                    disabled={isLoading || checkoutLoading !== null}
                    className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
                    style={
                      plan.recommended
                        ? { background: "var(--accent)", color: "var(--sidebar)" }
                        : { background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)" }
                    }
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Redirection…
                      </span>
                    ) : (
                      "Choisir ce plan"
                    )}
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full rounded-xl px-4 py-2.5 text-sm font-medium"
                    style={{ background: "var(--border)", color: "var(--muted)", cursor: "not-allowed" }}
                  >
                    Non disponible
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 3 — FAQ ───────────────────────────────── */}
      <div className="card">
        <div className="label mb-2">Questions fréquentes</div>
        <FaqItem
          question="Comment fonctionne l'essai gratuit ?"
          answer="14 jours gratuits, résiliation en 1 clic. Aucune carte bancaire requise pour démarrer."
        />
        <FaqItem
          question="Puis-je changer de plan ?"
          answer="Oui, à tout moment depuis le portail client. Le changement est pris en compte immédiatement et la facturation est proratisée."
        />
        <FaqItem
          question="Quels moyens de paiement ?"
          answer="Carte bancaire via Stripe. Factures automatiques envoyées par email à chaque renouvellement."
        />
        <FaqItem
          question="Comment résilier mon abonnement ?"
          answer="Depuis le portail client accessible via le bouton « Gérer mon abonnement ». Vous conservez l'accès jusqu'à la fin de la période payée."
        />
      </div>
    </div>
  );
}
