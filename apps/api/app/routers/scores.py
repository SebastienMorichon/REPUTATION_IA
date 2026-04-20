from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import brand_for_user, current_user
from app.models import PromptRun, ScoreSnapshot, User
from app.scoring import compute_scores, now_utc

router = APIRouter(prefix="/brands/{brand_id}/scores", tags=["scores"])


@router.get("")
def current_scores(
    brand_id: UUID,
    days: int = 30,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    brand_for_user(brand_id, user, db)
    since = now_utc() - timedelta(days=days)
    runs = (
        db.query(PromptRun)
        .filter(PromptRun.brand_id == brand_id, PromptRun.status == "done", PromptRun.executed_at >= since)
        .all()
    )
    scores = compute_scores(runs)
    return {
        "period_days": days,
        "runs_count": scores.runs_count,
        "visibility_score": scores.visibility_score,
        "share_of_voice": scores.share_of_voice,
        "sentiment_score": scores.sentiment_score,
        "citation_score": scores.citation_score,
        "top_competitors": [{"name": n, "mentions": c} for n, c in scores.top_competitors],
    }


@router.get("/snapshots")
def list_snapshots(
    brand_id: UUID,
    limit: int = 90,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list:
    """Historical score snapshots — one entry per saved period (used for trend charts)."""
    brand_for_user(brand_id, user, db)
    snaps = (
        db.query(ScoreSnapshot)
        .filter(ScoreSnapshot.brand_id == brand_id)
        .order_by(ScoreSnapshot.period_end.asc())
        .limit(limit)
        .all()
    )
    return [
        {
            "period_start": s.period_start.isoformat(),
            "period_end": s.period_end.isoformat(),
            "visibility_score": s.visibility_score,
            "share_of_voice": s.share_of_voice,
            "sentiment_score": s.sentiment_score,
            "citation_score": s.citation_score,
            "runs_count": s.runs_count,
        }
        for s in snaps
    ]


@router.get("/radar")
def competitor_radar(
    brand_id: UUID,
    days: int = 30,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Visibility + share-of-mentions for the brand AND each registered competitor.

    Used to render the competitive radar / bar comparison chart in the dashboard.
    """
    brand = brand_for_user(brand_id, user, db)
    since = now_utc() - timedelta(days=days)

    runs = (
        db.query(PromptRun)
        .filter(
            PromptRun.brand_id == brand_id,
            PromptRun.status == "done",
            PromptRun.executed_at >= since,
        )
        .options(joinedload(PromptRun.mentions))
        .all()
    )

    total_runs = len(runs) or 1
    all_mentions = [m for r in runs for m in (r.mentions or [])]
    total_mentions = len(all_mentions) or 1

    # ── Brand ─────────────────────────────────────────────────────────────────
    brand_run_count = sum(
        1 for r in runs if any(m.is_target_brand for m in (r.mentions or []))
    )
    brand_mention_count = sum(1 for m in all_mentions if m.is_target_brand)

    entries = [
        {
            "name": brand.name,
            "is_target": True,
            "visibility": round(100 * brand_run_count / total_runs, 1),
            "share_of_mentions": round(100 * brand_mention_count / total_mentions, 1),
        }
    ]

    # ── Competitors ────────────────────────────────────────────────────────────
    for comp in brand.competitors:
        all_names = {comp.name.lower()} | {a.lower() for a in (comp.aliases or [])}
        comp_run_count = sum(
            1 for r in runs
            if any(m.entity_name.lower() in all_names for m in (r.mentions or []))
        )
        comp_mention_count = sum(
            1 for m in all_mentions if m.entity_name.lower() in all_names
        )
        entries.append(
            {
                "name": comp.name,
                "is_target": False,
                "visibility": round(100 * comp_run_count / total_runs, 1),
                "share_of_mentions": round(100 * comp_mention_count / total_mentions, 1),
            }
        )

    return {
        "entries": sorted(entries, key=lambda e: (not e["is_target"], -e["visibility"])),
        "period_days": days,
        "runs_count": len(runs),
    }
