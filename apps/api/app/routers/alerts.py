"""
Alertes générées automatiquement à partir des runs récents.
Logique : on scanne les PromptRuns des N derniers jours et on
produit des alertes de 4 catégories :
  - absent      : marque absente sur un prompt jugé important
  - negative    : sentiment négatif détecté
  - failed      : run en erreur
  - new_citation: domaine jamais vu cité pour la première fois
"""
from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import brand_for_user, current_user
from app.models import Brand, Prompt, PromptRun, User
from app.scoring import now_utc

router = APIRouter(prefix="/brands/{brand_id}/alerts", tags=["alerts"])


def _severity(kind: str) -> str:
    return {"negative": "high", "absent": "medium", "failed": "medium", "new_citation": "low"}.get(kind, "low")


@router.get("")
def list_alerts(
    brand_id: UUID,
    days: int = 7,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    brand: Brand = brand_for_user(brand_id, user, db)
    since = now_utc() - timedelta(days=days)

    runs: list[PromptRun] = (
        db.query(PromptRun)
        .filter(PromptRun.brand_id == brand_id, PromptRun.created_at >= since)
        .order_by(PromptRun.created_at.desc())
        .all()
    )

    prompts_by_id: dict[UUID, Prompt] = {p.id: p for p in brand.prompts}
    alerts: list[dict] = []

    # Collect all citation domains seen before this window (for new_citation detection)
    old_domains: set[str] = set()
    old_runs: list[PromptRun] = (
        db.query(PromptRun)
        .filter(
            PromptRun.brand_id == brand_id,
            PromptRun.created_at < since,
            PromptRun.status == "done",
        )
        .all()
    )
    for r in old_runs:
        for c in (r.citations or []):
            if c.domain:
                old_domains.add(c.domain)

    seen_new_domains: set[str] = set()

    for run in runs:
        prompt = prompts_by_id.get(run.prompt_id)
        prompt_text = prompt.text if prompt else "(prompt supprimé)"

        # 1. Run failed
        if run.status == "failed":
            alerts.append({
                "id": f"failed-{run.id}",
                "kind": "failed",
                "severity": _severity("failed"),
                "title": f"Run en erreur sur [{run.provider}]",
                "description": f"Prompt : « {prompt_text[:80]} »\nErreur : {run.error or 'inconnue'}",
                "brand_id": str(brand_id),
                "prompt_id": str(run.prompt_id),
                "run_id": str(run.id),
                "provider": run.provider,
                "created_at": run.created_at.isoformat(),
            })
            continue

        if run.status != "done":
            continue

        # 2. Brand absent on important prompt
        has_target = any(m.is_target_brand for m in (run.mentions or []))
        importance = prompt.importance if prompt else 1
        if not has_target and importance >= 1:
            alerts.append({
                "id": f"absent-{run.id}",
                "kind": "absent",
                "severity": _severity("absent"),
                "title": f"Marque absente sur [{run.provider}]",
                "description": f"Prompt : « {prompt_text[:100]} »\nAucune mention de {brand.name}.",
                "brand_id": str(brand_id),
                "prompt_id": str(run.prompt_id),
                "run_id": str(run.id),
                "provider": run.provider,
                "created_at": run.created_at.isoformat(),
            })

        # 3. Negative / cautious sentiment on target brand
        for mention in (run.mentions or []):
            if mention.is_target_brand and mention.sentiment in ("negative", "cautious"):
                alerts.append({
                    "id": f"neg-{run.id}-{mention.entity_name}",
                    "kind": "negative",
                    "severity": _severity("negative"),
                    "title": f"Sentiment {mention.sentiment} détecté sur [{run.provider}]",
                    "description": (
                        f"Prompt : « {prompt_text[:80]} »\n"
                        f"Extrait : « {(mention.context_excerpt or '')[:120]} »"
                    ),
                    "brand_id": str(brand_id),
                    "prompt_id": str(run.prompt_id),
                    "run_id": str(run.id),
                    "provider": run.provider,
                    "created_at": run.created_at.isoformat(),
                })
                break

        # 4. New citation domain (never seen before)
        for citation in (run.citations or []):
            domain = citation.domain
            if domain and domain not in old_domains and domain not in seen_new_domains:
                seen_new_domains.add(domain)
                alerts.append({
                    "id": f"newcite-{run.id}-{domain}",
                    "kind": "new_citation",
                    "severity": _severity("new_citation"),
                    "title": f"Nouvelle source citée : {domain}",
                    "description": (
                        f"[{run.provider}] cite {domain} "
                        f"{'(pour votre marque)' if citation.refers_to_target else ''} "
                        f"sur le prompt : « {prompt_text[:70]} »"
                    ),
                    "brand_id": str(brand_id),
                    "prompt_id": str(run.prompt_id),
                    "run_id": str(run.id),
                    "provider": run.provider,
                    "created_at": run.created_at.isoformat(),
                })

    # Sort: high first, then chronological desc
    order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: (order.get(a["severity"], 9), a["created_at"]), reverse=False)
    alerts.sort(key=lambda a: order.get(a["severity"], 9))
    return alerts
