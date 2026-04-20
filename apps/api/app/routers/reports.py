"""PDF report and recommendations endpoints.

GET /brands/{brand_id}/report.pdf          → downloads a PDF report
GET /brands/{brand_id}/recommendations     → returns JSON recommendations
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import brand_for_user, current_user, require_feature
from app.models import PromptRun, User
from app.providers import list_enabled_providers
from app.recommendations import generate_recommendations
from app.scoring import AggregateScores, compute_scores

router = APIRouter(prefix="/brands/{brand_id}", tags=["reports"])

_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
_jinja = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _grade(value: float) -> dict:
    if value >= 75:
        return {"letter": "A", "color": "#2D9E5F", "label": "Excellent"}
    if value >= 55:
        return {"letter": "B", "color": "#2D9E5F", "label": "Bien"}
    if value >= 35:
        return {"letter": "C", "color": "#C97B18", "label": "Moyen"}
    if value >= 15:
        return {"letter": "D", "color": "#C97B18", "label": "Faible"}
    return {"letter": "E", "color": "#D94040", "label": "Insuffisant"}


def _fetch_runs(brand_id: UUID, days: int, db: Session) -> list[PromptRun]:
    """Fetch recent runs with mentions and citations eager-loaded."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return (
        db.query(PromptRun)
        .filter(PromptRun.brand_id == brand_id, PromptRun.created_at >= cutoff)
        .options(joinedload(PromptRun.mentions), joinedload(PromptRun.citations))
        .order_by(PromptRun.created_at.desc())
        .limit(300)
        .all()
    )


def _build_heatmap(brand_prompts: list, runs: list[PromptRun]) -> list[dict]:
    rows = []
    for p in brand_prompts:
        cells: dict[str, dict] = {}
        prompt_runs = sorted(
            [r for r in runs if r.prompt_id == p.id],
            key=lambda r: r.created_at,
            reverse=True,
        )
        for r in prompt_runs:
            if r.provider in cells:
                continue
            if r.status == "done":
                target = next((m for m in (r.mentions or []) if m.is_target_brand), None)
                cells[r.provider] = {
                    "status": "cited" if target else "absent",
                    "rank": target.rank_position if target else None,
                }
            elif r.status == "failed":
                cells[r.provider] = {"status": "failed", "rank": None}
            else:
                cells[r.provider] = {"status": "pending", "rank": None}
        rows.append({"prompt_text": p.text, "cells": cells})
    return rows


def _build_sov(runs: list[PromptRun], brand_name: str) -> list[dict]:
    all_mentions = [m for r in runs if r.status == "done" for m in (r.mentions or [])]
    total = len(all_mentions) or 1
    target_n = sum(1 for m in all_mentions if m.is_target_brand)
    comp_counts: dict[str, int] = {}
    for m in all_mentions:
        if m.is_known_competitor:
            comp_counts[m.entity_name] = comp_counts.get(m.entity_name, 0) + 1
    entries = [{"name": brand_name, "pct": round((target_n / total) * 100, 1), "is_target": True}]
    for name, count in sorted(comp_counts.items(), key=lambda x: -x[1])[:6]:
        entries.append({"name": name, "pct": round((count / total) * 100, 1), "is_target": False})
    return entries


def _summary(scores: AggregateScores, brand_name: str, days: int) -> str:
    vis = round(scores.visibility_score)
    g = _grade(scores.visibility_score)
    parts = [
        f"Sur les {days} derniers jours, {brand_name} a été cité dans {vis} % des réponses analysées "
        f"(note {g['letter']} — {g['label']})."
    ]
    if scores.visibility_score >= 60:
        parts.append("Votre marque est bien présente dans la mémoire des IA.")
    elif scores.visibility_score >= 30:
        parts.append(
            "Votre visibilité est en cours de construction — des opportunités de progression existent."
        )
    else:
        parts.append(
            "Votre visibilité reste faible : des actions concrètes sont nécessaires pour que les IA "
            "apprennent à vous recommander."
        )
    if scores.sentiment_score >= 60:
        parts.append("L'image véhiculée est positive.")
    elif scores.sentiment_score < 30:
        parts.append(
            "Attention : l'image perçue est négative ou mitigée — cela peut freiner la recommandation "
            "par les IA."
        )
    if scores.top_competitors:
        top_name = scores.top_competitors[0][0]
        parts.append(f"Principal concurrent identifié dans les réponses : {top_name}.")
    return " ".join(parts)


def _html_to_pdf(html: str) -> bytes:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail=(
                "Playwright n'est pas installé. "
                "Lancez : pip install playwright && playwright install chromium"
            ),
        )
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html, wait_until="domcontentloaded")
        pdf = page.pdf(
            format="A4",
            margin={"top": "0mm", "right": "0mm", "bottom": "0mm", "left": "0mm"},
            print_background=True,
        )
        browser.close()
    return pdf


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/report.pdf")
def download_pdf_report(
    brand_id: UUID,
    days: int = 30,
    user: User = Depends(require_feature("pdf_export")),
    db: Session = Depends(get_db),
) -> Response:
    """Generate and download a PDF report for a brand."""
    brand = brand_for_user(brand_id, user, db)
    runs = _fetch_runs(brand_id, days, db)
    scores = compute_scores(runs)

    prompts = list(brand.prompts)
    providers = [p.name for p in list_enabled_providers()]
    overall = (
        scores.visibility_score + scores.share_of_voice
        + scores.sentiment_score + scores.citation_score
    ) / 4

    heatmap = _build_heatmap(prompts, runs)
    sov_entries = _build_sov(runs, brand.name)
    recs = generate_recommendations(scores, runs, brand.name)
    summary_text = _summary(scores, brand.name, days)

    legend = [
        {"bg": "#B8E08A", "fg": "#1A1A1A", "sym": "#4+", "label": "Rang 4+"},
        {"bg": "#7DBF52", "fg": "#FFFFFF",  "sym": "#3",  "label": "Rang 3"},
        {"bg": "#3D7A29", "fg": "#FFFFFF",  "sym": "#2",  "label": "Rang 2"},
        {"bg": "#1C1C1A", "fg": "#FFFFFF",  "sym": "#1",  "label": "Rang 1 🏆"},
        {"bg": "#EEECE7", "fg": "#8B8880",  "sym": "○",   "label": "Non citée"},
        {"bg": "#FECACA", "fg": "#D94040",  "sym": "✗",   "label": "Erreur"},
    ]

    # Serialize recommendations for template
    recs_data = [
        {
            "priority": r.priority,
            "category": r.category,
            "icon": r.icon,
            "title": r.title,
            "description": r.description,
            "actions": [{"text": a.text, "type": a.type} for a in r.actions],
        }
        for r in recs
    ]

    html = _jinja.get_template("report.html").render(
        brand_name=brand.name,
        brand_initials=brand.name[:2].upper(),
        brand_domain=brand.domain or "",
        brand_category=brand.category or "",
        overall_grade=_grade(overall),
        kpis=[
            {"label": "Visibilité dans les IA",      "icon": "👁️",  "value": round(scores.visibility_score), "grade": _grade(scores.visibility_score)},
            {"label": "Présence concurrentielle",     "icon": "📊",  "value": round(scores.share_of_voice),   "grade": _grade(scores.share_of_voice)},
            {"label": "Image perçue",                 "icon": "💬",  "value": round(scores.sentiment_score),  "grade": _grade(scores.sentiment_score)},
            {"label": "Sources citantes",             "icon": "🔗",  "value": round(scores.citation_score),   "grade": _grade(scores.citation_score)},
        ],
        heatmap=heatmap[:15],
        providers=providers,
        sov_entries=sov_entries,
        recommendations=recs_data,
        legend=legend,
        summary_text=summary_text,
        period_days=days,
        runs_count=scores.runs_count,
        generated_at=datetime.now().strftime("%d/%m/%Y à %H:%M"),
    )

    pdf_bytes = _html_to_pdf(html)

    safe_name = brand.name.lower().replace(" ", "-")
    filename = f"rapport-{safe_name}-{datetime.now().strftime('%Y-%m-%d')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/recommendations")
def get_recommendations(
    brand_id: UUID,
    days: int = 30,
    user: User = Depends(require_feature("recommendations")),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return actionable recommendations for a brand (JSON)."""
    brand = brand_for_user(brand_id, user, db)
    runs = _fetch_runs(brand_id, days, db)
    scores = compute_scores(runs)
    recs = generate_recommendations(scores, runs, brand.name)
    return [
        {
            "priority": r.priority,
            "category": r.category,
            "icon": r.icon,
            "title": r.title,
            "description": r.description,
            "metric_value": r.metric_value,
            "actions": [{"text": a.text, "type": a.type} for a in r.actions],
        }
        for r in recs
    ]
