from fastapi import APIRouter, Depends

from app.deps import current_user
from app.models import User
from app.providers.registry import _providers

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("")
def list_providers(_: User = Depends(current_user)) -> list[dict]:
    """Return status of all configured providers so the UI can show which are enabled."""
    return [
        {
            "name": p.name,
            "enabled": p.is_enabled(),
            "default_model": p.default_model,
        }
        for p in _providers().values()
    ]
