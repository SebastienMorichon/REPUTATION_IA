from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import brand_for_user, check_brand_limit, current_user, require_feature
from app.models import Brand, Competitor, User
from app.schemas import (
    BrandCreate,
    BrandRead,
    BrandUpdate,
    CompetitorCreate,
    CompetitorRead,
)

router = APIRouter(prefix="/brands", tags=["brands"])


@router.get("", response_model=list[BrandRead])
def list_brands(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[Brand]:
    return db.query(Brand).filter(Brand.organization_id == user.organization_id).order_by(Brand.created_at.desc()).all()


@router.post("", response_model=BrandRead, status_code=status.HTTP_201_CREATED)
def create_brand(
    body: BrandCreate,
    user: User = Depends(check_brand_limit),
    db: Session = Depends(get_db),
) -> Brand:
    brand = Brand(organization_id=user.organization_id, **body.model_dump())
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand


@router.get("/{brand_id}", response_model=BrandRead)
def get_brand(
    brand_id: UUID,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Brand:
    return brand_for_user(brand_id, user, db)


@router.patch("/{brand_id}", response_model=BrandRead)
def update_brand(
    brand_id: UUID,
    body: BrandUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Brand:
    """Partial update — only provided fields are changed."""
    brand = brand_for_user(brand_id, user, db)

    updates = body.model_dump(exclude_none=True)

    # Gate: scheduled runs require Starter+ plan
    if updates.get("run_schedule") and updates["run_schedule"] != "none":
        from app.deps import _org_limits
        _, limits = _org_limits(user, db)
        if not limits.scheduled_runs:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "plan_limit",
                    "feature": "scheduled_runs",
                    "message": "Les analyses planifiées nécessitent un plan Starter ou supérieur.",
                },
            )

    for field, value in updates.items():
        setattr(brand, field, value)
    db.commit()
    db.refresh(brand)
    return brand


@router.delete("/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_brand(
    brand_id: UUID,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> None:
    brand = brand_for_user(brand_id, user, db)
    db.delete(brand)
    db.commit()


# ---- Competitors nested under brand ----


@router.get("/{brand_id}/competitors", response_model=list[CompetitorRead])
def list_competitors(
    brand_id: UUID,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[Competitor]:
    brand = brand_for_user(brand_id, user, db)
    return list(brand.competitors)


@router.post("/{brand_id}/competitors", response_model=CompetitorRead, status_code=201)
def add_competitor(
    brand_id: UUID,
    body: CompetitorCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Competitor:
    brand = brand_for_user(brand_id, user, db)
    competitor = Competitor(brand_id=brand.id, **body.model_dump())
    db.add(competitor)
    db.commit()
    db.refresh(competitor)
    return competitor


@router.delete("/{brand_id}/competitors/{competitor_id}", status_code=204)
def delete_competitor(
    brand_id: UUID,
    competitor_id: UUID,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> None:
    brand = brand_for_user(brand_id, user, db)
    competitor = db.get(Competitor, competitor_id)
    if not competitor or competitor.brand_id != brand.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Competitor not found")
    db.delete(competitor)
    db.commit()
