"""Central access point for prompt framework config — DB is primary, hardcoded is fallback."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import (
    CorePromptTemplate,
    PromptCategoryConfig,
    PromptFrameworkConfig,
    PromptSectorConfig,
    StrategicPromptGenerationConfig,
)
from app.prompt_strategy.core_templates import CORE_TEMPLATES as _CORE_TEMPLATES_HARDCODED
from app.prompt_strategy.taxonomy import CATEGORY_INFO as _CATEGORY_INFO_HARDCODED


# ── Hardcoded defaults (mirrors values in taxonomy.py, scoring.py, core_templates.py) ──

_DEFAULT_BENCHMARK_WEIGHT = 0.70
_DEFAULT_STRATEGIC_WEIGHT = 0.30
_DEFAULT_CORE_COUNT = 16
_DEFAULT_STRATEGIC_COUNT = 8

_SECTOR_LABELS: dict[str, str] = {
    "assurance":  "Assurance",
    "banque":     "Banque / Patrimoine",
    "immobilier": "Immobilier",
    "santé":      "Santé",
    "saas":       "SaaS / Logiciel",
    "e-commerce": "E-commerce",
    "consulting": "Conseil",
    "restaurant": "Restauration",
    "générique":  "Générique",
}


# ── Framework Config ──────────────────────────────────────────────────────────

def get_framework_config(db: Session) -> dict:
    """Return global framework config, falling back to hardcoded defaults."""
    cfg = db.query(PromptFrameworkConfig).first()
    if cfg is None:
        return {
            "benchmark_weight": _DEFAULT_BENCHMARK_WEIGHT,
            "strategic_weight": _DEFAULT_STRATEGIC_WEIGHT,
            "default_core_count": _DEFAULT_CORE_COUNT,
            "default_strategic_count": _DEFAULT_STRATEGIC_COUNT,
            "enabled": True,
            "description": None,
        }
    return {
        "id": str(cfg.id),
        "benchmark_weight": cfg.benchmark_weight,
        "strategic_weight": cfg.strategic_weight,
        "default_core_count": cfg.default_core_count,
        "default_strategic_count": cfg.default_strategic_count,
        "enabled": cfg.enabled,
        "description": cfg.description,
        "created_at": cfg.created_at.isoformat(),
        "updated_at": cfg.updated_at.isoformat(),
    }


def get_scoring_weights(db: Session) -> tuple[float, float]:
    """Return (benchmark_weight, strategic_weight) from DB or defaults."""
    cfg = db.query(PromptFrameworkConfig).first()
    if cfg is None:
        return _DEFAULT_BENCHMARK_WEIGHT, _DEFAULT_STRATEGIC_WEIGHT
    return cfg.benchmark_weight, cfg.strategic_weight


# ── Category Configs ───────────────────────────────────────────────────────────

def get_category_configs(db: Session) -> list[dict]:
    """Return all active category configs, falling back to taxonomy defaults."""
    rows = db.query(PromptCategoryConfig).filter(PromptCategoryConfig.is_active == True).order_by(PromptCategoryConfig.display_order).all()
    if not rows:
        # Fall back to CATEGORY_INFO hardcoded values
        return [
            {
                "category_key": key,
                "title": info.title,
                "description": info.description,
                "tooltip": info.tooltip,
                "expected_signal": info.expected_signal,
                "intent_label": info.intent_label,
                "recommended_ratio": info.recommended_ratio,
                "display_order": i,
                "is_active": True,
            }
            for i, (key, info) in enumerate(_CATEGORY_INFO_HARDCODED.items())
        ]
    return [
        {
            "id": str(r.id),
            "category_key": r.category_key,
            "title": r.title,
            "description": r.description,
            "tooltip": r.tooltip,
            "expected_signal": r.expected_signal,
            "intent_label": r.intent_label,
            "recommended_ratio": r.recommended_ratio,
            "display_order": r.display_order,
            "is_active": r.is_active,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat(),
        }
        for r in rows
    ]


# ── Sector Configs ──────────────────────────────────────────────────────────

def get_sector_configs(db: Session) -> list[dict]:
    """Return all active sector configs, falling back to hardcoded sector list."""
    rows = db.query(PromptSectorConfig).filter(PromptSectorConfig.is_active == True).order_by(PromptSectorConfig.display_order).all()
    if not rows:
        return [
            {"sector_key": key, "title": _SECTOR_LABELS.get(key, key.title()), "is_active": True}
            for key in _CORE_TEMPLATES_HARDCODED
        ]
    return [
        {
            "id": str(r.id),
            "sector_key": r.sector_key,
            "title": r.title,
            "description": r.description,
            "display_order": r.display_order,
            "is_active": r.is_active,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat(),
        }
        for r in rows
    ]


# ── Core Templates ────────────────────────────────────────────────────────────

def get_core_templates_for_sector(db: Session, sector_key: str) -> dict[str, list[str]]:
    """Return core templates for a sector. DB rows first; fallback to hardcoded."""
    rows = (
        db.query(CorePromptTemplate)
        .filter(
            CorePromptTemplate.sector_key == sector_key,
            CorePromptTemplate.is_active == True,
        )
        .order_by(CorePromptTemplate.template_index)
        .all()
    )
    if rows:
        # Group by category
        from app.prompt_strategy.taxonomy import ALL_CATEGORIES
        result: dict[str, list[str]] = {cat: [] for cat in ALL_CATEGORIES}
        for r in rows:
            if r.category_key in result:
                result[r.category_key].append(r.text)
        return result
    # Fallback to hardcoded
    return _CORE_TEMPLATES_HARDCODED.get(sector_key, _CORE_TEMPLATES_HARDCODED["générique"])


def get_all_core_templates(db: Session) -> list[dict]:
    """Return all core template rows with their metadata."""
    rows = db.query(CorePromptTemplate).order_by(CorePromptTemplate.sector_key, CorePromptTemplate.category_key, CorePromptTemplate.template_index).all()
    return [
        {
            "id": str(r.id),
            "sector_key": r.sector_key,
            "category_key": r.category_key,
            "template_index": r.template_index,
            "text": r.text,
            "is_active": r.is_active,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat(),
        }
        for r in rows
    ]


# ── Strategic Gen Config ──────────────────────────────────────────────────────

def get_strategic_configs(db: Session) -> list[dict]:
    """Return all active strategic generation configs."""
    rows = (
        db.query(StrategicPromptGenerationConfig)
        .filter(StrategicPromptGenerationConfig.is_active == True)
        .all()
    )
    return [
        {
            "id": str(r.id),
            "sector_key": r.sector_key,
            "category_key": r.category_key,
            "target_count": r.target_count,
            "is_active": r.is_active,
            "extra_templates": r.extra_templates,
            "description": r.description,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat(),
        }
        for r in rows
    ]
