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
      "5 marques suivies",
      "Claude + GPT-4o",
      "RUNs illimités",
      "Génération auto de questions",
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
      "10 marques suivies",
      "Tous les providers IA",
      "RUNs illimités",
      "Génération auto de questions",
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
      "RUNs illimités",
      "Génération auto de questions",
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

/* ── Quota card ──────────────────────────────────────────── */
function QuotaCard({ subscription }: { subscription: BillingSubscription }) {
  const quota = subscription.quota;
  const maxRuns = subscription.limits.max_runs_per_week;
  const isUnlimited = maxRuns === -1;
  const canRun = quota?.can_run ?? true;
  const runsThisWeek = quota?.runs_this_week ?? 0;
  const runsRemaining = quota?.runs_remaining ?? null;
  const blockReason = quota?.block_reason ?? null;

  const pct = isUnlimited ? 0 : Math.min(100, Math.round((runsThisWeek / maxRuns) * 100));
  const barColor = pct >= 100 ? "var(--bad)" : pct >= 75 ? "var(--warn)" : "var(--accent)";

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text">Quota d&apos;exécutions</p>
          <p className="text-xs text-muted mt-0.5">Runs lancés sur les 7 derniers jours glissants</p>
        </div>
        {!canRun && (
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: "rgba(220,38,38,0.1)", color: "var(--bad)", border: "1px solid rgba(220,38,38,0.2)" }}
          >
            Quota atteint
          </span>
        )}
        {canRun && !isUnlimited && runsRemaining !== null && runsRemaining <= 1 && (
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: "rgba(180,83,9,0.1)", color: "var(--warn)", border: "1px solid rgba(180,83,9,0.2)" }}
          >
            Presque épuisé
          </span>
        )}
      </div>

      {isUnlimited ? (
        /* Unlimited plan */
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
            style={{ background: "rgba(79,70,229,0.1)" }}
          >
            ∞
          </div>
          <div>
            <p className="text-sm font-semibold text-text">Illimité</p>
            <p className="text-xs text-muted">{runsThisWeek} run{runsThisWeek > 1 ? "s" : ""} lancé{runsThisWeek > 1 ? "s" : ""} cette semaine</p>
          </div>
        </div>
      ) : (
        /* Limited plan — show progress */
        <div>
          <div className="mb-2 flex items-end justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-text">{runsThisWeek}</span>
              <span className="text-sm text-muted">/ {maxRuns} run{maxRuns > 1 ? "s" : ""}</span>
            </div>
            <span className="text-xs font-medium" style={{ color: runsRemaining === 0 ? "var(--bad)" : "var(--muted)" }}>
              {runsRemaining === 0
                ? "Aucun run restant"
                : `${runsRemaining} run${runsRemaining! > 1 ? "s" : ""} restant${runsRemaining! > 1 ? "s" : ""}`}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: barColor }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Réinitialisation chaque semaine • Plan {subscription.effective_plan_label}
          </p>
        </div>
      )}

      {/* Block reason */}
      {blockReason && (
        <div
          className="mt-4 rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(220,38,38,0.06)", color: "var(--bad)", border: "1px solid rgba(220,38,38,0.15)" }}
        >
          {blockReason}
        </div>
      )}

      {/* Upgrade CTA if limited */}
      {!isUnlimited && (
        <p className="mt-4 text-xs text-muted">
          Passez au plan <span className="font-semibold text-accent">Starter ou supérieur</span> pour des runs illimités.
        </p>
      )}
    </div>
  );
}

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
                  style={effectivePlan !== "free" ? { color: "var(--muted)" } : undefined}
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
                    <div className="flex items-center justify-between text-xs" style={{ color: "var(--muted)" }}>
                      <span>Progression de l&apos;essai</span>
                      <span>{trialDaysRemaining} / 14 jours restants</span>
                    </div>
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full"
                      style={{ background: "var(--border)" }}
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
                style={{ background: "var(--sidebar-chip)", color: "var(--feat-text)", border: "1px solid var(--border)" }}
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

      {/* ── Section 1b — Quota d'exécution ────────────────── */}
      {subscription && (
        <QuotaCard subscription={subscription} />
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
