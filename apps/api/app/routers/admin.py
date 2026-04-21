"""Super-admin API — accessible uniquement aux utilisateurs avec is_admin=True.

Endpoints :
  GET  /admin/stats                     — KPIs globaux de la plateforme
  GET  /admin/organizations             — liste de tous les clients
  GET  /admin/organizations/{id}        — détail d'un client + usage
  PATCH /admin/organizations/{id}       — modifier plan / trial / nom
  DELETE /admin/organizations/{id}      — supprimer un client
  GET  /admin/usage/timeseries          — runs dans le temps (par heure/jour/mois)
  GET  /admin/usage/providers           — répartition par provider
  GET  /admin/runs/recent               — dernières analyses toutes marques confondues
  GET  /admin/providers                 — statut des providers LLM
  PATCH /admin/providers/{name}         — modifier clé API / activer-désactiver un provider
  GET  /admin/users                     — liste de tous les utilisateurs
  PATCH /admin/users/{id}               — promouvoir/révoquer admin, changer email
  GET  /admin/config                    — liste tous les paramètres de config runtime
  PATCH /admin/config/{key}             — modifier un paramètre
  DELETE /admin/config/{key}            — supprimer un paramètre (repasse à la valeur .env)
  GET  /admin/prices                    — prix des plans
  PATCH /admin/prices/{plan}            — modifier le prix d'un plan
  GET  /admin/promotions                — liste des coupons Stripe
  POST /admin/promotions                — créer un coupon Stripe
  DELETE /admin/promotions/{id}         — supprimer un coupon Stripe
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload

from app.config_store import delete_config, get_config, get_config_int, list_config, set_config
from app.database import get_db
from app.deps import require_admin
from app.models import Brand, LLMProviderConfig, Organization, PlatformConfig, Prompt, PromptRun, User
from app.plan_limits import effective_plan, is_trial_active, trial_days_remaining

log = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

# ── MRR estimate ──────────────────────────────────────────────────────────────
_DEFAULT_PLAN_PRICE = {"starter": 49, "pro": 149, "agency": 499}


def _plan_price(plan: str) -> int:
    """Return plan price, DB config overrides hardcoded default."""
    return get_config_int(f"price.{plan}", _DEFAULT_PLAN_PRICE.get(plan, 0))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _mrr(orgs: list[Organization]) -> int:
    return sum(_plan_price(o.plan or "") for o in orgs)


# ── Serializers ───────────────────────────────────────────────────────────────

def _serialize_org(org: Organization, db: Session) -> dict:
    users = db.query(User).filter(User.organization_id == org.id).all()
    brand_count = db.query(Brand).filter(Brand.organization_id == org.id).count()
    runs_30d = (
        db.query(func.count(PromptRun.id))
        .join(Brand, PromptRun.brand_id == Brand.id)
        .filter(
            Brand.organization_id == org.id,
            PromptRun.created_at >= _now() - timedelta(days=30),
        )
        .scalar() or 0
    )
    runs_total = (
        db.query(func.count(PromptRun.id))
        .join(Brand, PromptRun.brand_id == Brand.id)
        .filter(Brand.organization_id == org.id)
        .scalar() or 0
    )
    last_run = (
        db.query(func.max(PromptRun.created_at))
        .join(Brand, PromptRun.brand_id == Brand.id)
        .filter(Brand.organization_id == org.id)
        .scalar()
    )
    ep = effective_plan(org.plan, org.trial_ends_at)
    return {
        "id": str(org.id),
        "name": org.name,
        "plan": org.plan or "free",
        "effective_plan": ep,
        "is_trial": is_trial_active(org.trial_ends_at),
        "trial_days_remaining": trial_days_remaining(org.trial_ends_at),
        "trial_ends_at": org.trial_ends_at.isoformat() if org.trial_ends_at else None,
        "stripe_customer_id": org.stripe_customer_id,
        "stripe_subscription_id": org.stripe_subscription_id,
        "mrr": _plan_price(org.plan or ""),
        "users": [{"id": str(u.id), "email": u.email, "full_name": u.full_name, "is_admin": u.is_admin} for u in users],
        "brand_count": brand_count,
        "runs_30d": runs_30d,
        "runs_total": runs_total,
        "last_activity": last_run.isoformat() if last_run else None,
        "created_at": org.created_at.isoformat(),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_platform_stats(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Global KPIs — one call to get everything for the admin dashboard."""
    now = _now()

    orgs = db.query(Organization).all()
    users = db.query(User).all()

    # Plan distribution
    plan_dist: dict[str, int] = {}
    active_trials = 0
    for o in orgs:
        ep = effective_plan(o.plan, o.trial_ends_at)
        plan_dist[ep] = plan_dist.get(ep, 0) + 1
        if is_trial_active(o.trial_ends_at):
            active_trials += 1

    # Runs counts
    runs_1h  = db.query(func.count(PromptRun.id)).filter(PromptRun.created_at >= now - timedelta(hours=1)).scalar() or 0
    runs_24h = db.query(func.count(PromptRun.id)).filter(PromptRun.created_at >= now - timedelta(days=1)).scalar() or 0
    runs_7d  = db.query(func.count(PromptRun.id)).filter(PromptRun.created_at >= now - timedelta(days=7)).scalar() or 0
    runs_30d = db.query(func.count(PromptRun.id)).filter(PromptRun.created_at >= now - timedelta(days=30)).scalar() or 0
    runs_all = db.query(func.count(PromptRun.id)).scalar() or 0

    # Success / failure rate (last 30 days)
    done   = db.query(func.count(PromptRun.id)).filter(PromptRun.created_at >= now - timedelta(days=30), PromptRun.status == "done").scalar() or 0
    failed = db.query(func.count(PromptRun.id)).filter(PromptRun.created_at >= now - timedelta(days=30), PromptRun.status == "failed").scalar() or 0

    # Brands / prompts
    brand_count  = db.query(func.count(Brand.id)).scalar() or 0
    prompt_count = db.query(func.count(Prompt.id)).scalar() or 0

    # Provider breakdown (last 30 days)
    provider_rows = (
        db.query(PromptRun.provider, func.count(PromptRun.id))
        .filter(PromptRun.created_at >= now - timedelta(days=30))
        .group_by(PromptRun.provider)
        .all()
    )

    # Avg latency last 7d
    avg_latency = (
        db.query(func.avg(PromptRun.latency_ms))
        .filter(PromptRun.created_at >= now - timedelta(days=7), PromptRun.status == "done")
        .scalar()
    )

    # New signups last 30d
    new_orgs_30d = db.query(func.count(Organization.id)).filter(Organization.created_at >= now - timedelta(days=30)).scalar() or 0

    return {
        # Clients
        "total_organizations": len(orgs),
        "total_users": len(users),
        "new_organizations_30d": new_orgs_30d,
        "active_trials": active_trials,
        "plan_distribution": plan_dist,
        # Revenue
        "estimated_mrr": _mrr(orgs),
        "estimated_arr": _mrr(orgs) * 12,
        # Usage
        "runs_last_1h":  runs_1h,
        "runs_last_24h": runs_24h,
        "runs_last_7d":  runs_7d,
        "runs_last_30d": runs_30d,
        "runs_all_time": runs_all,
        # Quality
        "success_rate_30d": round(100 * done / (done + failed), 1) if (done + failed) else None,
        "avg_latency_ms_7d": round(avg_latency) if avg_latency else None,
        # Catalog
        "total_brands":  brand_count,
        "total_prompts": prompt_count,
        # Providers
        "provider_usage_30d": {row[0]: row[1] for row in provider_rows},
    }


@router.get("/organizations")
def list_organizations(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
    plan: str | None = None,        # filter by plan
    search: str | None = None,      # filter by name/email
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """All customer organisations with usage summary."""
    q = db.query(Organization)
    if plan:
        q = q.filter(Organization.plan == plan)
    if search:
        q = q.filter(Organization.name.ilike(f"%{search}%"))
    orgs = q.order_by(Organization.created_at.desc()).offset(offset).limit(limit).all()
    return [_serialize_org(o, db) for o in orgs]


@router.get("/organizations/{org_id}")
def get_organization(
    org_id: UUID,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Full detail for one organisation including brands and recent runs."""
    org = db.get(Organization, org_id)
    if not org:
        raise HTTPException(404, "Organisation introuvable")
    data = _serialize_org(org, db)

    # Add brands detail
    brands = db.query(Brand).filter(Brand.organization_id == org_id).all()
    data["brands"] = [
        {
            "id": str(b.id),
            "name": b.name,
            "domain": b.domain,
            "category": b.category,
            "run_schedule": b.run_schedule,
            "runs_total": db.query(func.count(PromptRun.id)).filter(PromptRun.brand_id == b.id).scalar() or 0,
            "runs_30d": db.query(func.count(PromptRun.id)).filter(
                PromptRun.brand_id == b.id,
                PromptRun.created_at >= _now() - timedelta(days=30),
            ).scalar() or 0,
        }
        for b in brands
    ]
    return data


class OrgUpdate(BaseModel):
    plan: str | None = None
    trial_ends_at: datetime | None = None
    clear_trial: bool = False   # explicitly terminate trial immediately
    name: str | None = None


@router.patch("/organizations/{org_id}")
def update_organization(
    org_id: UUID,
    body: OrgUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Change a customer's plan, extend/revoke trial, rename org."""
    org = db.get(Organization, org_id)
    if not org:
        raise HTTPException(404, "Organisation introuvable")
    if body.plan is not None:
        valid_plans = ("free", "starter", "pro", "agency")
        if body.plan not in valid_plans:
            raise HTTPException(400, f"Plan invalide. Valeurs acceptées : {valid_plans}")
        org.plan = body.plan
        # Assigning a paid plan while trial is active → terminate trial immediately
        # so effective_plan() returns the new plan instead of "trial".
        if body.plan != "free" and is_trial_active(org.trial_ends_at):
            org.trial_ends_at = None
    if body.trial_ends_at is not None:
        org.trial_ends_at = body.trial_ends_at
    if body.clear_trial:
        org.trial_ends_at = None
    if body.name is not None:
        org.name = body.name
    db.commit()
    log.info("Admin updated org %s: plan=%s trial=%s clear_trial=%s", org_id, body.plan, body.trial_ends_at, body.clear_trial)
    return _serialize_org(org, db)


@router.delete("/organizations/{org_id}", status_code=200)
def delete_organization(
    org_id: UUID,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Hard-delete an organisation and all its data (CASCADE)."""
    org = db.get(Organization, org_id)
    if not org:
        raise HTTPException(404, "Organisation introuvable")
    name = org.name
    db.delete(org)
    db.commit()
    log.warning("Admin DELETED org %s (%s)", org_id, name)
    return {"deleted": str(org_id)}


# ── Usage ─────────────────────────────────────────────────────────────────────

@router.get("/usage/timeseries")
def usage_timeseries(
    granularity: str = "day",   # "hour" | "day" | "month"
    days: int = 30,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Runs aggregated by hour, day, or month over the last N days."""
    if granularity not in ("hour", "day", "month"):
        raise HTTPException(400, "granularity must be 'hour', 'day' or 'month'")

    since = _now() - timedelta(days=days)

    from sqlalchemy import case
    # PostgreSQL date_trunc
    trunc_expr = func.date_trunc(granularity, PromptRun.created_at)
    rows = (
        db.query(
            trunc_expr.label("period"),
            func.count(PromptRun.id).label("total"),
            func.sum(case((PromptRun.status == "done",   1), else_=0)).label("done"),
            func.sum(case((PromptRun.status == "failed", 1), else_=0)).label("failed"),
        )
        .filter(PromptRun.created_at >= since)
        .group_by("period")
        .order_by("period")
        .all()
    )

    return [
        {
            "period": row.period.isoformat(),
            "total": row.total,
            "done": int(row.done or 0),
            "failed": int(row.failed or 0),
        }
        for row in rows
    ]


@router.get("/usage/providers")
def usage_by_provider(
    days: int = 30,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Run counts and success rate per provider over the last N days."""
    since = _now() - timedelta(days=days)
    rows = (
        db.query(
            PromptRun.provider,
            func.count(PromptRun.id).label("total"),
            func.avg(PromptRun.latency_ms).label("avg_latency"),
        )
        .filter(PromptRun.created_at >= since)
        .group_by(PromptRun.provider)
        .order_by(func.count(PromptRun.id).desc())
        .all()
    )
    result = []
    for row in rows:
        done = db.query(func.count(PromptRun.id)).filter(
            PromptRun.created_at >= since,
            PromptRun.provider == row.provider,
            PromptRun.status == "done",
        ).scalar() or 0
        result.append({
            "provider": row.provider,
            "total_runs": row.total,
            "done": done,
            "success_rate": round(100 * done / row.total, 1) if row.total else 0,
            "avg_latency_ms": round(row.avg_latency) if row.avg_latency else None,
        })
    return result


@router.get("/runs/recent")
def recent_runs(
    limit: int = 50,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Most recent runs across all customers."""
    runs = (
        db.query(PromptRun)
        .options(joinedload(PromptRun.prompt))
        .order_by(PromptRun.created_at.desc())
        .limit(limit)
        .all()
    )
    result = []
    for r in runs:
        brand = db.get(Brand, r.brand_id)
        org = db.get(Organization, brand.organization_id) if brand else None
        result.append({
            "id": str(r.id),
            "provider": r.provider,
            "model": r.model,
            "status": r.status,
            "latency_ms": r.latency_ms,
            "error": r.error,
            "created_at": r.created_at.isoformat(),
            "prompt_text": (r.prompt.text[:80] if r.prompt else None),
            "brand_name": brand.name if brand else None,
            "org_name": org.name if org else None,
            "org_id": str(org.id) if org else None,
        })
    return result


# ── Providers ─────────────────────────────────────────────────────────────────

def _mask(key: str) -> str:
    if not key:
        return ""
    return key[:8] + "••••••••" + key[-4:] if len(key) > 12 else "••••••••"


_PROVIDER_META = {
    "anthropic":  {"label": "Anthropic (Claude)", "env_key": "anthropic_api_key",  "env_enabled": "anthropic_enabled",  "env_model": "anthropic_default_model"},
    "openai":     {"label": "OpenAI (GPT)",        "env_key": "openai_api_key",     "env_enabled": "openai_enabled",     "env_model": "openai_default_model"},
    "perplexity": {"label": "Perplexity (Sonar)",  "env_key": "perplexity_api_key", "env_enabled": "perplexity_enabled", "env_model": "perplexity_default_model"},
}


@router.get("/providers")
def get_providers_status(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Status of all LLM providers (built-ins + dynamic DB providers)."""
    result = [_builtin_provider_status(name) for name in _PROVIDER_META]

    # Append custom providers from DB
    customs = db.query(LLMProviderConfig).order_by(LLMProviderConfig.created_at).all()
    for cfg in customs:
        result.append(_custom_provider_status(cfg))
    return result


class ProviderUpdate(BaseModel):
    api_key: str | None = None       # plain text
    enabled: bool | None = None
    default_model: str | None = None


@router.patch("/providers/{provider_name}")
def update_provider(
    provider_name: str,
    body: ProviderUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Update any provider's API key, enabled flag, or default model at runtime.

    Built-ins → stored in platform_config.
    Custom    → stored in llm_providers table.
    """
    if provider_name in _PROVIDER_META:
        # ── Built-in ──
        meta = _PROVIDER_META[provider_name]
        if body.api_key is not None:
            set_config(f"provider.{provider_name}.api_key", body.api_key,
                       description=f"{meta['label']} API key (set via admin UI)")
        if body.enabled is not None:
            set_config(f"provider.{provider_name}.enabled", "true" if body.enabled else "false",
                       description=f"{meta['label']} enabled flag")
        if body.default_model is not None:
            set_config(f"provider.{provider_name}.model", body.default_model,
                       description=f"{meta['label']} default model")
        log.info("Admin updated built-in provider %s", provider_name)
        return _builtin_provider_status(provider_name)

    # ── Custom ──
    cfg = db.get(LLMProviderConfig, provider_name)
    if not cfg:
        raise HTTPException(404, f"Provider introuvable : {provider_name}")
    if body.api_key is not None:
        cfg.api_key = body.api_key
    if body.enabled is not None:
        cfg.enabled = body.enabled
    if body.default_model is not None:
        cfg.default_model = body.default_model
    db.commit()
    log.info("Admin updated custom provider %s", provider_name)
    return _custom_provider_status(cfg)


# ── NEW: create a custom provider ──────────────────────────────────────────────

class ProviderCreate(BaseModel):
    name: str                          # slug, e.g. "mistral"
    label: str                         # display name, e.g. "Mistral AI"
    api_type: str = "openai_compat"    # "openai_compat" | "anthropic"
    base_url: str | None = None        # e.g. "https://api.mistral.ai/v1"
    api_key: str | None = None
    default_model: str                 # e.g. "mistral-large-latest"
    enabled: bool = True


@router.post("/providers", status_code=201)
def create_provider(
    body: ProviderCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Add a new LLM provider (OpenAI-compatible or Anthropic-compatible)."""
    import re
    if not re.match(r"^[a-z0-9_-]+$", body.name):
        raise HTTPException(400, "Le nom doit contenir uniquement des lettres minuscules, chiffres, - ou _")
    if body.name in _PROVIDER_META:
        raise HTTPException(409, f"'{body.name}' est un provider intégré — utilisez PATCH pour le modifier.")
    if db.get(LLMProviderConfig, body.name):
        raise HTTPException(409, f"Un provider nommé '{body.name}' existe déjà.")
    if body.api_type not in ("openai_compat", "anthropic"):
        raise HTTPException(400, "api_type doit être 'openai_compat' ou 'anthropic'")

    cfg = LLMProviderConfig(
        name=body.name,
        label=body.label,
        api_type=body.api_type,
        base_url=body.base_url or None,
        api_key=body.api_key or None,
        default_model=body.default_model,
        enabled=body.enabled,
    )
    db.add(cfg)
    db.commit()
    log.info("Admin created custom provider %s (%s)", body.name, body.api_type)
    return _custom_provider_status(cfg)


@router.delete("/providers/{provider_name}", status_code=200)
def delete_provider(
    provider_name: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Delete a custom provider (built-ins cannot be deleted)."""
    if provider_name in _PROVIDER_META:
        raise HTTPException(400, "Les providers intégrés ne peuvent pas être supprimés.")
    cfg = db.get(LLMProviderConfig, provider_name)
    if not cfg:
        raise HTTPException(404, f"Provider introuvable : {provider_name}")
    db.delete(cfg)
    db.commit()
    log.info("Admin deleted custom provider %s", provider_name)
    return {"deleted": provider_name}


# ── Internal status helpers ────────────────────────────────────────────────────

def _builtin_provider_status(name: str) -> dict:
    """Status dict for a built-in provider (reads platform_config / .env)."""
    from app.config import get_settings
    from app.config_store import get_config, get_config_bool

    s = get_settings()
    meta = _PROVIDER_META[name]
    env_key  = getattr(s, meta["env_key"],  "") or ""
    env_enbl = getattr(s, meta["env_enabled"], False)
    env_mdl  = getattr(s, meta["env_model"], "") or ""

    api_key = get_config(f"provider.{name}.api_key") or env_key
    enabled = get_config_bool(f"provider.{name}.enabled", bool(env_enbl))
    model   = get_config(f"provider.{name}.model") or env_mdl

    return {
        "name":          name,
        "label":         meta["label"],
        "api_type":      "anthropic" if name == "anthropic" else "openai_compat",
        "base_url":      None,
        "enabled":       enabled,
        "default_model": model,
        "api_key_set":   bool(api_key),
        "api_key_masked": _mask(api_key),
        "is_builtin":    True,
    }


def _custom_provider_status(cfg: LLMProviderConfig) -> dict:
    """Status dict for a custom (DB-stored) provider."""
    return {
        "name":          cfg.name,
        "label":         cfg.label,
        "api_type":      cfg.api_type,
        "base_url":      cfg.base_url,
        "enabled":       cfg.enabled,
        "default_model": cfg.default_model,
        "api_key_set":   bool(cfg.api_key),
        "api_key_masked": _mask(cfg.api_key or ""),
        "is_builtin":    False,
    }


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
    search: str | None = None,
    limit: int = 100,
) -> list[dict]:
    """All users across the platform."""
    q = db.query(User)
    if search:
        q = q.filter(User.email.ilike(f"%{search}%"))
    users = q.order_by(User.created_at.desc()).limit(limit).all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "full_name": u.full_name,
            "is_admin": u.is_admin,
            "organization_id": str(u.organization_id),
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


class UserUpdate(BaseModel):
    is_admin: bool | None = None
    full_name: str | None = None


@router.patch("/users/{user_id}")
def update_user(
    user_id: UUID,
    body: UserUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Promote/revoke admin, update name."""
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "Utilisateur introuvable")
    # Prevent self-demotion
    if body.is_admin is False and target.id == admin.id:
        raise HTTPException(400, "Vous ne pouvez pas vous révoquer vous-même.")
    if body.is_admin is not None:
        target.is_admin = body.is_admin
    if body.full_name is not None:
        target.full_name = body.full_name
    db.commit()
    return {
        "id": str(target.id),
        "email": target.email,
        "full_name": target.full_name,
        "is_admin": target.is_admin,
        "organization_id": str(target.organization_id),
    }


# ── Plan config ───────────────────────────────────────────────────────────────

@router.get("/plans")
def get_plan_config(
    _: User = Depends(require_admin),
) -> dict:
    """Return current plan limits + dynamic prices."""
    from app.plan_limits import _LIMITS, _TRIAL_LIMITS
    result = {}
    for name, limits in _LIMITS.items():
        result[name] = {
            "max_brands":      limits.max_brands,
            "pdf_export":      limits.pdf_export,
            "recommendations": limits.recommendations,
            "scheduled_runs":  limits.scheduled_runs,
            "max_providers":   limits.max_providers,
            "price_eur":       _plan_price(name),
        }
    result["trial"] = {
        "max_brands":      _TRIAL_LIMITS.max_brands,
        "pdf_export":      _TRIAL_LIMITS.pdf_export,
        "recommendations": _TRIAL_LIMITS.recommendations,
        "scheduled_runs":  _TRIAL_LIMITS.scheduled_runs,
        "max_providers":   _TRIAL_LIMITS.max_providers,
        "price_eur":       0,
    }
    return result


# ── Runtime config ────────────────────────────────────────────────────────────

class ConfigUpdate(BaseModel):
    value: str
    description: str | None = None


@router.get("/config")
def list_platform_config(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    """All runtime config entries (API keys are NOT masked here — admin only)."""
    rows = db.query(PlatformConfig).order_by(PlatformConfig.key).all()
    return [
        {
            "key": r.key,
            "value": r.value,
            "description": r.description,
            "updated_at": r.updated_at.isoformat(),
        }
        for r in rows
    ]


@router.patch("/config/{key:path}")
def update_platform_config(
    key: str,
    body: ConfigUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Upsert a runtime config entry."""
    row = db.get(PlatformConfig, key)
    if row is None:
        row = PlatformConfig(key=key, value=body.value)
        db.add(row)
    else:
        row.value = body.value
    if body.description is not None:
        row.description = body.description
    db.commit()
    log.info("Admin SET config[%s]", key)
    return {"key": row.key, "value": row.value, "description": row.description}


@router.delete("/config/{key:path}", status_code=200)
def delete_platform_config(
    key: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Delete a config entry (falls back to .env value on next read)."""
    row = db.get(PlatformConfig, key)
    if not row:
        raise HTTPException(404, "Clé de configuration introuvable")
    db.delete(row)
    db.commit()
    log.info("Admin DELETE config[%s]", key)
    return {"deleted": key}


# ── Prices ────────────────────────────────────────────────────────────────────

class PriceUpdate(BaseModel):
    price_eur: int


@router.get("/prices")
def get_prices(
    _: User = Depends(require_admin),
) -> dict:
    """Current plan prices (DB overrides hardcoded defaults)."""
    return {
        plan: _plan_price(plan)
        for plan in ("starter", "pro", "agency")
    }


@router.patch("/prices/{plan}")
def update_price(
    plan: str,
    body: PriceUpdate,
    _: User = Depends(require_admin),
) -> dict:
    """Set the monthly price (in EUR) for a plan."""
    valid = ("starter", "pro", "agency")
    if plan not in valid:
        raise HTTPException(400, f"Plan invalide. Valeurs acceptées : {valid}")
    if body.price_eur < 0:
        raise HTTPException(400, "Le prix ne peut pas être négatif.")
    set_config(f"price.{plan}", str(body.price_eur), description=f"Prix mensuel plan {plan} (EUR)")
    log.info("Admin SET price.%s = %s EUR", plan, body.price_eur)
    return {"plan": plan, "price_eur": body.price_eur}


# ── Stripe promotions (coupons) ───────────────────────────────────────────────

class PromotionCreate(BaseModel):
    name: str                          # Display name / promotion code
    percent_off: float | None = None   # e.g. 20 for 20%
    amount_off: int | None = None      # cents, e.g. 1000 = 10 €
    currency: str = "eur"              # only used with amount_off
    duration: str = "once"             # "once" | "repeating" | "forever"
    duration_in_months: int | None = None  # required when duration="repeating"
    max_redemptions: int | None = None


@router.get("/promotions")
def list_promotions(
    _: User = Depends(require_admin),
) -> list[dict]:
    """List active Stripe coupons."""
    try:
        import stripe
        from app.config import get_settings
        stripe.api_key = get_settings().stripe_secret_key
        coupons = stripe.Coupon.list(limit=50)
        return [
            {
                "id": c["id"],
                "name": c.get("name") or c["id"],
                "percent_off": c.get("percent_off"),
                "amount_off": c.get("amount_off"),
                "currency": c.get("currency"),
                "duration": c.get("duration"),
                "duration_in_months": c.get("duration_in_months"),
                "max_redemptions": c.get("max_redemptions"),
                "times_redeemed": c.get("times_redeemed", 0),
                "valid": c.get("valid", True),
            }
            for c in coupons.data
        ]
    except Exception as exc:
        raise HTTPException(502, f"Erreur Stripe : {exc}") from exc


@router.post("/promotions", status_code=201)
def create_promotion(
    body: PromotionCreate,
    _: User = Depends(require_admin),
) -> dict:
    """Create a Stripe coupon / promotion code."""
    if body.percent_off is None and body.amount_off is None:
        raise HTTPException(400, "Spécifiez percent_off ou amount_off.")
    if body.percent_off is not None and body.amount_off is not None:
        raise HTTPException(400, "Spécifiez soit percent_off, soit amount_off, pas les deux.")
    try:
        import stripe
        from app.config import get_settings
        stripe.api_key = get_settings().stripe_secret_key

        params: dict = {
            "name": body.name,
            "duration": body.duration,
        }
        if body.percent_off is not None:
            params["percent_off"] = body.percent_off
        else:
            params["amount_off"] = body.amount_off
            params["currency"] = body.currency
        if body.duration == "repeating" and body.duration_in_months:
            params["duration_in_months"] = body.duration_in_months
        if body.max_redemptions:
            params["max_redemptions"] = body.max_redemptions

        coupon = stripe.Coupon.create(**params)
        log.info("Admin created Stripe coupon %s", coupon["id"])
        return {
            "id": coupon["id"],
            "name": coupon.get("name") or coupon["id"],
            "percent_off": coupon.get("percent_off"),
            "amount_off": coupon.get("amount_off"),
            "duration": coupon.get("duration"),
        }
    except Exception as exc:
        raise HTTPException(502, f"Erreur Stripe : {exc}") from exc


@router.delete("/promotions/{coupon_id}", status_code=200)
def delete_promotion(
    coupon_id: str,
    _: User = Depends(require_admin),
) -> dict:
    """Delete a Stripe coupon."""
    try:
        import stripe
        from app.config import get_settings
        stripe.api_key = get_settings().stripe_secret_key
        stripe.Coupon.delete(coupon_id)
        log.info("Admin deleted Stripe coupon %s", coupon_id)
        return {"deleted": coupon_id}
    except Exception as exc:
        raise HTTPException(502, f"Erreur Stripe : {exc}") from exc
