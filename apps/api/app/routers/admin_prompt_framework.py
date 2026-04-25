"""Admin router for the Prompt Framework — full CRUD + preview + audit."""
from __future__ import annotations

import uuid
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import (
    CorePromptTemplate,
    PromptCategoryConfig,
    PromptFrameworkAuditLog,
    PromptFrameworkConfig,
    PromptSectorConfig,
    StrategicPromptGenerationConfig,
    User,
)
from app.prompt_framework.config_loader import (
    get_all_core_templates,
    get_category_configs,
    get_core_templates_for_sector,
    get_framework_config,
    get_scoring_weights,
    get_sector_configs,
    get_strategic_configs,
)
from app.prompt_strategy.core_templates import CORE_TEMPLATES as _CORE_TEMPLATES_HARDCODED
from app.prompt_strategy.taxonomy import ALL_CATEGORIES, CATEGORY_INFO as _CATEGORY_INFO_HARDCODED


router = APIRouter(prefix="/admin/prompt-framework", tags=["admin-prompt-framework"])

# ── Audit helper ──────────────────────────────────────────────────────────────


def _audit(
    action: str,
    table_name: str,
    record_id: str | None,
    old: dict[str, Any] | None,
    new: dict[str, Any] | None,
    db: Session,
    admin_user: User,
) -> None:
    log = PromptFrameworkAuditLog(
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_value=old,
        new_value=new,
        changed_by_user_id=admin_user.id,
        changed_by_email=admin_user.email,
    )
    db.add(log)


# ══════════════════════════════════════════════════════════════════════════════
# FRAMEWORK CONFIG
# ══════════════════════════════════════════════════════════════════════════════


class FrameworkConfigUpdate(BaseModel):
    benchmark_weight: float = Field(ge=0.0, le=1.0)
    strategic_weight: float = Field(ge=0.0, le=1.0)
    default_core_count: int = Field(ge=1, le=100)
    default_strategic_count: int = Field(ge=1, le=100)
    enabled: bool = True
    description: str | None = None


@router.get("/config")
def get_config(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    return get_framework_config(db)


@router.put("/config")
def update_config(
    body: FrameworkConfigUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    cfg = db.query(PromptFrameworkConfig).first()
    is_new = cfg is None
    old = {"id": str(cfg.id), **get_framework_config(db)} if cfg else None
    if is_new:
        cfg = PromptFrameworkConfig(
            benchmark_weight=body.benchmark_weight,
            strategic_weight=body.strategic_weight,
            default_core_count=body.default_core_count,
            default_strategic_count=body.default_strategic_count,
            enabled=body.enabled,
            description=body.description,
        )
        db.add(cfg)
    else:
        cfg.benchmark_weight = body.benchmark_weight
        cfg.strategic_weight = body.strategic_weight
        cfg.default_core_count = body.default_core_count
        cfg.default_strategic_count = body.default_strategic_count
        cfg.enabled = body.enabled
        cfg.description = body.description
    db.commit()
    db.refresh(cfg)
    result = get_framework_config(db)
    _audit("update" if not is_new else "create", "prompt_framework_config", str(cfg.id), old, result, db, admin)
    return result


@router.post("/config/refresh")
def refresh_defaults(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Reset all prompt framework config to hardcoded defaults."""
    # Upsert framework config
    cfg = db.query(PromptFrameworkConfig).first()
    if cfg is None:
        cfg = PromptFrameworkConfig()
        db.add(cfg)
    cfg.benchmark_weight = 0.70
    cfg.strategic_weight = 0.30
    cfg.default_core_count = 16
    cfg.default_strategic_count = 8
    cfg.enabled = True
    cfg.description = None

    # Upsert category configs
    order = 0
    for key, info in _CATEGORY_INFO_HARDCODED.items():
        row = db.query(PromptCategoryConfig).filter(PromptCategoryConfig.category_key == key).first()
        if row is None:
            row = PromptCategoryConfig(category_key=key)
            db.add(row)
        row.title = info.title
        row.description = info.description
        row.tooltip = info.tooltip
        row.expected_signal = info.expected_signal
        row.intent_label = info.intent_label
        row.recommended_ratio = info.recommended_ratio
        row.display_order = order
        row.is_active = True
        order += 1

    # Upsert sector configs
    _SECTOR_LABELS = {
        "assurance": "Assurance", "banque": "Banque / Patrimoine",
        "immobilier": "Immobilier", "santé": "Santé",
        "saas": "SaaS / Logiciel", "e-commerce": "E-commerce",
        "consulting": "Conseil", "restaurant": "Restauration",
        "générique": "Générique",
    }
    for i, (skey, title) in enumerate(_SECTOR_LABELS.items()):
        row = db.query(PromptSectorConfig).filter(PromptSectorConfig.sector_key == skey).first()
        if row is None:
            row = PromptSectorConfig(sector_key=skey)
            db.add(row)
        row.title = title
        row.is_active = True
        row.display_order = i

    db.commit()
    result = get_framework_config(db)
    _audit("refresh_defaults", "prompt_framework_config", str(cfg.id), None, result, db, admin)
    return result


# ══════════════════════════════════════════════════════════════════════════════
# CATEGORY CONFIGS
# ══════════════════════════════════════════════════════════════════════════════


class CategoryCreate(BaseModel):
    category_key: str
    title: str
    description: str | None = None
    tooltip: str | None = None
    expected_signal: str | None = None
    intent_label: str | None = None
    recommended_ratio: float = 0.40
    display_order: int = 0
    is_active: bool = True


class CategoryUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    tooltip: str | None = None
    expected_signal: str | None = None
    intent_label: str | None = None
    recommended_ratio: float | None = None
    display_order: int | None = None
    is_active: bool | None = None


@router.get("/categories")
def list_categories(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    return get_category_configs(db)


@router.post("/categories", status_code=status.HTTP_201_CREATED)
def create_category(
    body: CategoryCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    existing = db.query(PromptCategoryConfig).filter(PromptCategoryConfig.category_key == body.category_key).first()
    if existing:
        raise HTTPException(409, f"Category '{body.category_key}' already exists")
    row = PromptCategoryConfig(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    result = {"id": str(row.id), **body.model_dump(), "created_at": row.created_at.isoformat(), "updated_at": row.updated_at.isoformat()}
    _audit("create", "prompt_category_configs", str(row.id), None, result, db, admin)
    return result


@router.get("/categories/{key}")
def get_category(
    key: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    row = db.query(PromptCategoryConfig).filter(PromptCategoryConfig.category_key == key).first()
    if not row:
        raise HTTPException(404, "Category not found")
    return {
        "id": str(row.id), "category_key": row.category_key, "title": row.title,
        "description": row.description, "tooltip": row.tooltip,
        "expected_signal": row.expected_signal, "intent_label": row.intent_label,
        "recommended_ratio": row.recommended_ratio, "display_order": row.display_order,
        "is_active": row.is_active,
        "created_at": row.created_at.isoformat(), "updated_at": row.updated_at.isoformat(),
    }


@router.put("/categories/{key}")
def update_category(
    key: str,
    body: CategoryUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    row = db.query(PromptCategoryConfig).filter(PromptCategoryConfig.category_key == key).first()
    if not row:
        raise HTTPException(404, "Category not found")
    old = {"id": str(row.id), "category_key": row.category_key, "title": row.title,
           "description": row.description, "tooltip": row.tooltip,
           "expected_signal": row.expected_signal, "intent_label": row.intent_label,
           "recommended_ratio": row.recommended_ratio, "display_order": row.display_order,
           "is_active": row.is_active}
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    result = {"id": str(row.id), "category_key": row.category_key, "title": row.title,
              "description": row.description, "tooltip": row.tooltip,
              "expected_signal": row.expected_signal, "intent_label": row.intent_label,
              "recommended_ratio": row.recommended_ratio, "display_order": row.display_order,
              "is_active": row.is_active,
              "created_at": row.created_at.isoformat(), "updated_at": row.updated_at.isoformat()}
    _audit("update", "prompt_category_configs", str(row.id), old, result, db, admin)
    return result


@router.delete("/categories/{key}")
def delete_category(
    key: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    row = db.query(PromptCategoryConfig).filter(PromptCategoryConfig.category_key == key).first()
    if not row:
        raise HTTPException(404, "Category not found")
    old = {"id": str(row.id), "category_key": row.category_key, "title": row.title}
    db.delete(row)
    db.commit()
    _audit("delete", "prompt_category_configs", str(old["id"]), old, None, db, admin)
    return {"deleted": True}


# ══════════════════════════════════════════════════════════════════════════════
# SECTOR CONFIGS
# ══════════════════════════════════════════════════════════════════════════════


class SectorCreate(BaseModel):
    sector_key: str
    title: str
    description: str | None = None
    display_order: int = 0
    is_active: bool = True


class SectorUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    display_order: int | None = None
    is_active: bool | None = None


@router.get("/sectors")
def list_sectors(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[dict]:
    return get_sector_configs(db)


@router.post("/sectors", status_code=status.HTTP_201_CREATED)
def create_sector(body: SectorCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    existing = db.query(PromptSectorConfig).filter(PromptSectorConfig.sector_key == body.sector_key).first()
    if existing:
        raise HTTPException(409, f"Sector '{body.sector_key}' already exists")
    row = PromptSectorConfig(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    result = {"id": str(row.id), **body.model_dump(), "created_at": row.created_at.isoformat(), "updated_at": row.updated_at.isoformat()}
    _audit("create", "prompt_sector_configs", str(row.id), None, result, db, admin)
    return result


@router.get("/sectors/{skey}")
def get_sector(skey: str, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    row = db.query(PromptSectorConfig).filter(PromptSectorConfig.sector_key == skey).first()
    if not row:
        raise HTTPException(404, "Sector not found")
    return {"id": str(row.id), "sector_key": row.sector_key, "title": row.title,
            "description": row.description, "display_order": row.display_order, "is_active": row.is_active,
            "created_at": row.created_at.isoformat(), "updated_at": row.updated_at.isoformat()}


@router.put("/sectors/{skey}")
def update_sector(skey: str, body: SectorUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    row = db.query(PromptSectorConfig).filter(PromptSectorConfig.sector_key == skey).first()
    if not row:
        raise HTTPException(404, "Sector not found")
    old = {"id": str(row.id), "sector_key": row.sector_key, "title": row.title, "is_active": row.is_active}
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    result = {"id": str(row.id), "sector_key": row.sector_key, "title": row.title,
              "description": row.description, "display_order": row.display_order, "is_active": row.is_active,
              "created_at": row.created_at.isoformat(), "updated_at": row.updated_at.isoformat()}
    _audit("update", "prompt_sector_configs", str(row.id), old, result, db, admin)
    return result


@router.delete("/sectors/{skey}")
def delete_sector(skey: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    row = db.query(PromptSectorConfig).filter(PromptSectorConfig.sector_key == skey).first()
    if not row:
        raise HTTPException(404, "Sector not found")
    old = {"id": str(row.id), "sector_key": row.sector_key}
    db.delete(row)
    db.commit()
    _audit("delete", "prompt_sector_configs", old["id"], old, None, db, admin)
    return {"deleted": True}


# ══════════════════════════════════════════════════════════════════════════════
# CORE PROMPT TEMPLATES
# ══════════════════════════════════════════════════════════════════════════════


class CoreTemplateCreate(BaseModel):
    sector_key: str
    category_key: str
    template_index: int = Field(ge=0)
    text: str = Field(min_length=5)
    is_active: bool = True


class CoreTemplateUpdate(BaseModel):
    text: str | None = None
    is_active: bool | None = None


@router.get("/core-templates")
def list_core_templates(
    sector_key: str | None = None,
    category_key: str | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    if sector_key or category_key:
        q = db.query(CorePromptTemplate)
        if sector_key:
            q = q.filter(CorePromptTemplate.sector_key == sector_key)
        if category_key:
            q = q.filter(CorePromptTemplate.category_key == category_key)
        rows = q.order_by(CorePromptTemplate.sector_key, CorePromptTemplate.category_key, CorePromptTemplate.template_index).all()
    else:
        rows = db.query(CorePromptTemplate).order_by(CorePromptTemplate.sector_key, CorePromptTemplate.category_key, CorePromptTemplate.template_index).all()
    return [
        {"id": str(r.id), "sector_key": r.sector_key, "category_key": r.category_key,
         "template_index": r.template_index, "text": r.text, "is_active": r.is_active,
         "created_at": r.created_at.isoformat(), "updated_at": r.updated_at.isoformat()}
        for r in rows
    ]


@router.post("/core-templates", status_code=status.HTTP_201_CREATED)
def create_core_template(body: CoreTemplateCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    if body.category_key not in ALL_CATEGORIES:
        raise HTTPException(400, f"Invalid category_key '{body.category_key}'. Must be one of {ALL_CATEGORIES}")
    row = CorePromptTemplate(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    result = {"id": str(row.id), **body.model_dump(), "created_at": row.created_at.isoformat(), "updated_at": row.updated_at.isoformat()}
    _audit("create", "core_prompt_templates", str(row.id), None, result, db, admin)
    return result


@router.put("/core-templates/{template_id}")
def update_core_template(template_id: UUID, body: CoreTemplateUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    row = db.query(CorePromptTemplate).filter(CorePromptTemplate.id == template_id).first()
    if not row:
        raise HTTPException(404, "Template not found")
    old = {"id": str(row.id), "text": row.text, "is_active": row.is_active}
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    result = {"id": str(row.id), "sector_key": row.sector_key, "category_key": row.category_key,
              "template_index": row.template_index, "text": row.text, "is_active": row.is_active,
              "created_at": row.created_at.isoformat(), "updated_at": row.updated_at.isoformat()}
    _audit("update", "core_prompt_templates", str(row.id), old, result, db, admin)
    return result


@router.delete("/core-templates/{template_id}")
def delete_core_template(template_id: UUID, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    row = db.query(CorePromptTemplate).filter(CorePromptTemplate.id == template_id).first()
    if not row:
        raise HTTPException(404, "Template not found")
    old = {"id": str(row.id), "text": row.text}
    db.delete(row)
    db.commit()
    _audit("delete", "core_prompt_templates", old["id"], old, None, db, admin)
    return {"deleted": True}


@router.post("/core-templates/reset/{sector}")
def reset_sector_templates(sector: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    """Reset all templates for a sector to hardcoded defaults. Deletes DB rows then re-populates."""
    db.query(CorePromptTemplate).filter(CorePromptTemplate.sector_key == sector).delete()
    db.commit()
    templates = _CORE_TEMPLATES_HARDCODED.get(sector, _CORE_TEMPLATES_HARDCODED["générique"])
    created = 0
    for cat, texts in templates.items():
        for idx, text in enumerate(texts):
            row = CorePromptTemplate(
                sector_key=sector,
                category_key=cat,
                template_index=idx,
                text=text,
                is_active=True,
            )
            db.add(row)
            created += 1
    db.commit()
    _audit("reset", "core_prompt_templates", sector, None, {"sector": sector, "created": created}, db, admin)
    return {"sector": sector, "created": created}


# ══════════════════════════════════════════════════════════════════════════════
# STRATEGIC GENERATION CONFIGS
# ══════════════════════════════════════════════════════════════════════════════


class StrategicConfigCreate(BaseModel):
    sector_key: str
    category_key: str
    target_count: int | None = None
    is_active: bool = True
    extra_templates: list[str] | None = None
    description: str | None = None


class StrategicConfigUpdate(BaseModel):
    target_count: int | None = None
    is_active: bool | None = None
    extra_templates: list[str] | None = None
    description: str | None = None


@router.get("/strategic-configs")
def list_strategic_configs(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[dict]:
    return get_strategic_configs(db)


@router.post("/strategic-configs", status_code=status.HTTP_201_CREATED)
def create_strategic_config(body: StrategicConfigCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    if body.category_key not in ALL_CATEGORIES:
        raise HTTPException(400, f"Invalid category_key")
    existing = db.query(StrategicPromptGenerationConfig).filter(
        StrategicPromptGenerationConfig.sector_key == body.sector_key,
        StrategicPromptGenerationConfig.category_key == body.category_key,
    ).first()
    if existing:
        raise HTTPException(409, "Config for this sector/category already exists")
    row = StrategicPromptGenerationConfig(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    result = {"id": str(row.id), **body.model_dump(), "created_at": row.created_at.isoformat(), "updated_at": row.updated_at.isoformat()}
    _audit("create", "strategic_prompt_gen_config", str(row.id), None, result, db, admin)
    return result


@router.get("/strategic-configs/{sector_key}")
def get_strategic_config(sector_key: str, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    rows = db.query(StrategicPromptGenerationConfig).filter(StrategicPromptGenerationConfig.sector_key == sector_key).all()
    return [
        {"id": str(r.id), "sector_key": r.sector_key, "category_key": r.category_key,
         "target_count": r.target_count, "is_active": r.is_active,
         "extra_templates": r.extra_templates, "description": r.description,
         "created_at": r.created_at.isoformat(), "updated_at": r.updated_at.isoformat()}
        for r in rows
    ]


@router.put("/strategic-configs/{sector_key}")
def update_strategic_config(sector_key: str, body: StrategicConfigUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    row = db.query(StrategicPromptGenerationConfig).filter(StrategicPromptGenerationConfig.sector_key == sector_key).first()
    if not row:
        raise HTTPException(404, "Strategic config not found")
    old = {"id": str(row.id), "target_count": row.target_count, "is_active": row.is_active}
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    result = {"id": str(row.id), "sector_key": row.sector_key, "category_key": row.category_key,
              "target_count": row.target_count, "is_active": row.is_active,
              "extra_templates": row.extra_templates, "description": row.description,
              "created_at": row.created_at.isoformat(), "updated_at": row.updated_at.isoformat()}
    _audit("update", "strategic_prompt_gen_config", str(row.id), old, result, db, admin)
    return result


@router.delete("/strategic-configs/{sector_key}")
def delete_strategic_config(sector_key: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    rows = db.query(StrategicPromptGenerationConfig).filter(StrategicPromptGenerationConfig.sector_key == sector_key).all()
    if not rows:
        raise HTTPException(404, "Strategic config not found")
    for row in rows:
        db.delete(row)
    db.commit()
    _audit("delete", "strategic_prompt_gen_config", sector_key, {"sector_key": sector_key}, None, db, admin)
    return {"deleted": True}


# ══════════════════════════════════════════════════════════════════════════════
# AUDIT LOG
# ══════════════════════════════════════════════════════════════════════════════


@router.get("/audit-log")
def get_audit_log(
    limit: int = 50,
    offset: int = 0,
    table_name: str | None = None,
    action: str | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    q = db.query(PromptFrameworkAuditLog).order_by(PromptFrameworkAuditLog.created_at.desc())
    if table_name:
        q = q.filter(PromptFrameworkAuditLog.table_name == table_name)
    if action:
        q = q.filter(PromptFrameworkAuditLog.action == action)
    total = q.count()
    rows = q.offset(offset).limit(limit).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "entries": [
            {"id": str(r.id), "action": r.action, "table_name": r.table_name,
             "record_id": r.record_id, "old_value": r.old_value, "new_value": r.new_value,
             "changed_by_user_id": str(r.changed_by_user_id) if r.changed_by_user_id else None,
             "changed_by_email": r.changed_by_email,
             "created_at": r.created_at.isoformat()}
            for r in rows
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
# PREVIEW
# ══════════════════════════════════════════════════════════════════════════════


class PreviewRequest(BaseModel):
    brand_name: str
    sector_key: str
    competitors: list[str] = []
    core_count: int | None = None
    strategic_count: int | None = None


@router.post("/preview")
def preview_portfolio(
    body: PreviewRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    from app.prompt_strategy.portfolio import build_prompt_portfolio

    fw = get_framework_config(db)
    core_count = body.core_count if body.core_count else fw["default_core_count"]
    strategic_count = body.strategic_count if body.strategic_count else fw["default_strategic_count"]
    benchmark_w, strategic_w = get_scoring_weights(db)

    portfolio = build_prompt_portfolio(
        brand_name=body.brand_name,
        sector_key=body.sector_key,
        competitors=body.competitors,
        total_core=core_count,
        total_strategic=strategic_count,
    )

    return {
        "core": {
            "count": core_count,
            "by_category": portfolio["core"]["by_category"],
        },
        "strategic": {
            "count": strategic_count,
            "by_category": portfolio["strategic"]["by_category"],
        },
        "scoring": {
            "benchmark_weight": benchmark_w,
            "strategic_weight": strategic_w,
            "global_formula": f"{benchmark_w:.0%} Benchmark + {strategic_w:.0%} Opportunity",
        },
    }
