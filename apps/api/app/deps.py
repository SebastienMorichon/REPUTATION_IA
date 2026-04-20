from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.auth import decode_access_token
from app.database import get_db
from app.models import Brand, Organization, User
from app.plan_limits import get_limits

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    try:
        payload = decode_access_token(token)
        user_id = UUID(payload["sub"])
    except (ValueError, KeyError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def brand_for_user(brand_id: UUID, user: User, db: Session) -> Brand:
    brand = db.get(Brand, brand_id)
    if not brand or brand.organization_id != user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")
    return brand


# ── Plan enforcement helpers ──────────────────────────────────────────────────

def _plan_limit_error(feature: str, message: str, limit: int | None = None) -> HTTPException:
    detail: dict = {"code": "plan_limit", "feature": feature, "message": message}
    if limit is not None:
        detail["limit"] = limit
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def _org_limits(user: User, db: Session):
    org: Organization = db.get(Organization, user.organization_id)
    return org, get_limits(org.plan, org.trial_ends_at)


def require_feature(feature: str):
    """Dependency factory — raises 403 if the boolean feature is not in user's plan."""
    def _dep(user: User = Depends(current_user), db: Session = Depends(get_db)) -> User:
        _, limits = _org_limits(user, db)
        if not getattr(limits, feature, False):
            labels = {
                "pdf_export":      "l'export PDF",
                "recommendations": "les recommandations",
                "scheduled_runs":  "les analyses planifiées",
            }
            label = labels.get(feature, feature)
            raise _plan_limit_error(
                feature,
                f"Cette fonctionnalité ({label}) nécessite un plan supérieur. "
                "Passez à Starter ou Pro pour y accéder.",
            )
        return user
    return _dep


def require_admin(user: User = Depends(current_user)) -> User:
    """Dependency — raises 403 if the user is not a platform admin."""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs de la plateforme.",
        )
    return user


def check_brand_limit(user: User = Depends(current_user), db: Session = Depends(get_db)) -> User:
    """Dependency — raises 403 if the org has reached its brand quota."""
    org, limits = _org_limits(user, db)
    if limits.max_brands == -1:
        return user
    count = db.query(Brand).filter(Brand.organization_id == user.organization_id).count()
    if count >= limits.max_brands:
        raise _plan_limit_error(
            "max_brands",
            f"Vous avez atteint la limite de {limits.max_brands} marque(s) pour votre plan. "
            "Passez au plan Pro pour suivre jusqu'à 5 marques.",
            limit=limits.max_brands,
        )
    return user
