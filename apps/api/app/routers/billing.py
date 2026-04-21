"""Stripe billing — checkout sessions, webhook, customer portal.

Endpoints:
  GET  /billing/subscription      → plan actuel de l'organisation
  POST /billing/checkout?plan=pro → crée une Checkout Session Stripe
  POST /billing/portal            → crée une session Billing Portal
  POST /billing/webhook           → reçoit les événements Stripe (signature vérifiée)

Configuration .env requise :
  STRIPE_SECRET_KEY=sk_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  STRIPE_STARTER_PRICE_ID=price_...
  STRIPE_PRO_PRICE_ID=price_...
  STRIPE_AGENCY_PRICE_ID=price_...
"""
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from datetime import datetime, timedelta, timezone

from app.config import get_settings
from app.database import get_db
from app.deps import current_user
from app.models import Brand, Organization, PromptRun, User
from app.plan_limits import can_run, effective_plan, get_limits, plan_display, trial_days_remaining

log = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])

PLAN_LABELS = {
    "free":    "Gratuit",
    "starter": "Starter",
    "pro":     "Pro",
    "agency":  "Agence",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _stripe_enabled() -> bool:
    return bool(get_settings().stripe_secret_key)


def _init_stripe():
    import stripe
    stripe.api_key = get_settings().stripe_secret_key
    return stripe


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/subscription")
def get_subscription(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Return the current billing plan, trial info, and quota usage."""
    org = db.get(Organization, user.organization_id)
    display = plan_display(org.plan, org.trial_ends_at)
    limits = get_limits(org.plan, org.trial_ends_at)
    ep = display["effective_plan"]

    # ── Quota usage: runs this week ───────────────────────────────
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    runs_this_week = (
        db.query(PromptRun)
        .filter(
            PromptRun.brand_id.in_(
                db.query(Brand.id).filter(Brand.organization_id == org.id)
            ),
            PromptRun.created_at >= week_ago,
        )
        .count()
    )
    max_runs = limits.max_runs_per_week
    runs_remaining = None if max_runs == -1 else max(0, max_runs - runs_this_week)
    can_run_now, block_reason = can_run(org, db)

    return {
        # Raw / stored plan
        "plan": org.plan or "free",
        "plan_label": PLAN_LABELS.get(org.plan or "free", "Gratuit"),
        # Effective (accounts for trial)
        "effective_plan": ep,
        "effective_plan_label": display["label"],
        # Trial
        "is_trial": display["is_trial"],
        "trial_days_remaining": display["trial_days_remaining"],
        # Stripe
        "stripe_enabled": _stripe_enabled(),
        "has_active_subscription": org.plan not in (None, "free"),
        # Feature flags exposed to frontend
        "limits": {
            "max_brands": limits.max_brands,
            "pdf_export": limits.pdf_export,
            "recommendations": limits.recommendations,
            "scheduled_runs": limits.scheduled_runs,
            "auto_generate_prompts": limits.auto_generate_prompts,
            "max_runs_per_week": max_runs,
        },
        # Quota usage
        "quota": {
            "runs_this_week": runs_this_week,
            "runs_remaining": runs_remaining,       # null = unlimited
            "can_run": can_run_now,
            "block_reason": block_reason,           # null if can run
        },
    }


@router.post("/checkout")
def create_checkout_session(
    plan: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Create a Stripe Checkout Session for the requested plan.

    Returns ``{"checkout_url": "https://checkout.stripe.com/..."}``
    """
    if not _stripe_enabled():
        raise HTTPException(503, "Paiement non configuré sur ce serveur.")
    if plan not in ("starter", "pro", "agency"):
        raise HTTPException(400, f"Plan inconnu : '{plan}'")

    s = get_settings()
    stripe = _init_stripe()

    price_map = {
        "starter": s.stripe_starter_price_id,
        "pro":     s.stripe_pro_price_id,
        "agency":  s.stripe_agency_price_id,
    }
    price_id = price_map[plan]
    if not price_id:
        raise HTTPException(503, f"Prix Stripe non configuré pour le plan '{plan}'. "
                                 "Ajoutez STRIPE_{PLAN}_PRICE_ID dans .env.")

    org = db.get(Organization, user.organization_id)

    # Create or reuse Stripe customer
    if not org.stripe_customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=org.name,
            metadata={"organization_id": str(org.id)},
        )
        org.stripe_customer_id = customer.id
        db.commit()

    session = stripe.checkout.Session.create(
        customer=org.stripe_customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=f"{s.web_origin}/dashboard/billing?success=1",
        cancel_url=f"{s.web_origin}/dashboard/billing?canceled=1",
        subscription_data={
            "metadata": {"plan": plan, "organization_id": str(org.id)},
        },
        allow_promotion_codes=True,
    )
    log.info("Checkout session created for org %s plan=%s", org.id, plan)
    return {"checkout_url": session.url}


@router.post("/portal")
def create_portal_session(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Create a Stripe Billing Portal session so the user can manage their subscription."""
    if not _stripe_enabled():
        raise HTTPException(503, "Paiement non configuré sur ce serveur.")

    stripe = _init_stripe()
    s = get_settings()
    org = db.get(Organization, user.organization_id)

    if not org.stripe_customer_id:
        raise HTTPException(400, "Aucun abonnement actif à gérer.")

    portal = stripe.billing_portal.Session.create(
        customer=org.stripe_customer_id,
        return_url=f"{s.web_origin}/dashboard/billing",
    )
    return {"portal_url": portal.url}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """Receive Stripe webhook events (signature verified).

    Register this URL in the Stripe dashboard:
    https://dashboard.stripe.com/webhooks → add endpoint → {your-domain}/billing/webhook

    Events handled:
    - checkout.session.completed        → activate plan
    - customer.subscription.updated     → sync plan changes
    - customer.subscription.deleted     → downgrade to free
    """
    if not _stripe_enabled():
        return {"received": True}

    stripe = _init_stripe()
    s = get_settings()
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig, s.stripe_webhook_secret)
    except Exception as exc:
        log.warning("Stripe webhook signature invalid: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    ev_type: str = event["type"]
    data = event["data"]["object"]
    log.info("Stripe event received: %s", ev_type)

    if ev_type == "checkout.session.completed":
        org_id = data.get("metadata", {}).get("organization_id")
        plan   = data.get("metadata", {}).get("plan", "starter")
        sub_id = data.get("subscription")
        cust_id = data.get("customer")

        if org_id:
            org = db.get(Organization, UUID(org_id))
            if org:
                org.plan = plan
                org.stripe_subscription_id = sub_id
                org.stripe_customer_id = cust_id
                db.commit()
                log.info("Plan activated: org=%s plan=%s", org_id, plan)

    elif ev_type == "customer.subscription.updated":
        cust_id = data.get("customer")
        status  = data.get("status")
        plan    = data.get("metadata", {}).get("plan")
        org = db.query(Organization).filter(
            Organization.stripe_customer_id == cust_id
        ).first()
        if org:
            if status in ("active", "trialing") and plan:
                org.plan = plan
            elif status in ("past_due", "paused"):
                pass  # keep existing plan, just warn
            db.commit()

    elif ev_type == "customer.subscription.deleted":
        cust_id = data.get("customer")
        org = db.query(Organization).filter(
            Organization.stripe_customer_id == cust_id
        ).first()
        if org:
            org.plan = "free"
            org.stripe_subscription_id = None
            db.commit()
            log.info("Subscription canceled — org downgraded to free: %s", cust_id)

    return {"received": True}
