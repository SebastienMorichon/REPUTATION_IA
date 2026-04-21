"""Plan limits and feature flags per subscription tier.

Each plan defines hard limits applied at the API layer.
During an active 14-day trial the user gets Pro-level access.
After trial expires, users fall back to free plan limits.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class PlanLimits:
    max_brands: int       # -1 = unlimited
    pdf_export: bool
    recommendations: bool
    scheduled_runs: bool
    max_providers: int    # -1 = unlimited
    auto_generate_prompts: bool  # Can auto-generate prompts via LLM
    max_runs_per_week: int  # -1 = unlimited, 0 = no runs allowed


_LIMITS: dict[str, PlanLimits] = {
    "free": PlanLimits(
        max_brands=3,
        pdf_export=False,
        recommendations=False,
        scheduled_runs=False,
        max_providers=1,
        auto_generate_prompts=False,  # Disabled for free plan
        max_runs_per_week=1,  # 1 run per week
    ),
    "starter": PlanLimits(
        max_brands=5,
        pdf_export=True,
        recommendations=True,
        scheduled_runs=True,
        max_providers=2,
        auto_generate_prompts=True,
        max_runs_per_week=-1,  # unlimited
    ),
    "pro": PlanLimits(
        max_brands=10,
        pdf_export=True,
        recommendations=True,
        scheduled_runs=True,
        max_providers=-1,
        auto_generate_prompts=True,
        max_runs_per_week=-1,  # unlimited
    ),
    "agency": PlanLimits(
        max_brands=-1,
        pdf_export=True,
        recommendations=True,
        scheduled_runs=True,
        max_providers=-1,
        auto_generate_prompts=True,
        max_runs_per_week=-1,  # unlimited
    ),
}

# Trial users get Pro-level access for 14 days
_TRIAL_LIMITS = _LIMITS["pro"]


def is_trial_active(trial_ends_at: datetime | None) -> bool:
    if not trial_ends_at:
        return False
    return trial_ends_at > datetime.now(timezone.utc)


def effective_plan(plan: str | None, trial_ends_at: datetime | None) -> str:
    """Return 'trial' if trial is active, otherwise the stored plan (defaulting to 'free')."""
    if is_trial_active(trial_ends_at):
        return "trial"
    return plan or "free"


def get_limits(plan: str | None, trial_ends_at: datetime | None) -> PlanLimits:
    """Return PlanLimits for the user's effective plan."""
    ep = effective_plan(plan, trial_ends_at)
    if ep == "trial":
        return _TRIAL_LIMITS
    return _LIMITS.get(ep, _LIMITS["free"])


def trial_days_remaining(trial_ends_at: datetime | None) -> int | None:
    """Return integer days left in trial, or None if no active trial."""
    if not trial_ends_at:
        return None
    delta = trial_ends_at - datetime.now(timezone.utc)
    if delta.total_seconds() <= 0:
        return None
    return max(0, delta.days)


def plan_display(plan: str | None, trial_ends_at: datetime | None) -> dict:
    """Return display metadata for the current effective plan."""
    ep = effective_plan(plan, trial_ends_at)
    days = trial_days_remaining(trial_ends_at)
    labels = {
        "free":    "Gratuit",
        "trial":   "Essai Pro",
        "starter": "Starter",
        "pro":     "Pro",
        "agency":  "Agence",
    }
    return {
        "effective_plan": ep,
        "label": labels.get(ep, ep.capitalize()),
        "is_trial": ep == "trial",
        "trial_days_remaining": days,
    }


def can_run(org: "Organization", db: Session) -> tuple[bool, str | None]:
    """Check if the organization can run new prompts.

    Returns (can_run, reason) tuple.
    - During trial: always allowed
    - After trial on free plan: blocked
    - Weekly limit check for free plan
    """
    from app.models import Brand, Organization, PromptRun
    from datetime import timedelta

    ep = effective_plan(org.plan, org.trial_ends_at)
    limits = get_limits(org.plan, org.trial_ends_at)

    # Trial users can always run
    if ep == "trial":
        return True, None

    # Free plan users cannot run after trial expires
    if ep == "free":
        return False, "Votre période d'essai est terminée. Veuillez souscrire à un abonnement pour continuer à lancer des RUNs."

    # Check weekly limit for paid plans with limits
    if limits.max_runs_per_week >= 0:
        # Count runs in the last 7 days
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        run_count = db.query(PromptRun).filter(
            PromptRun.brand_id.in_(
                db.query(Brand.id).filter(Brand.organization_id == org.id)
            ),
            PromptRun.created_at >= week_ago,
        ).count()

        if run_count >= limits.max_runs_per_week:
            return False, f"Vous avez atteint votre limite de {limits.max_runs_per_week} RUN(s) par semaine."

    return True, None
