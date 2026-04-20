"""Runtime platform configuration store.

Reads settings from the `platform_config` DB table first, then falls back
to environment variables / pydantic Settings.  This lets admins update API keys,
prices, and provider flags through the admin UI without touching .env or restarting.

Usage:
    from app.config_store import get_config, get_config_bool, set_config

    api_key = get_config("provider.anthropic.api_key", fallback_from_env)
    enabled  = get_config_bool("provider.anthropic.enabled", default=False)
    set_config("price.starter", "59", description="Starter plan monthly price (EUR)")
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)

# Keys that store boolean values
_BOOL_TRUTHY = frozenset({"true", "1", "yes", "on"})


def get_config(key: str, default: str | None = None) -> str | None:
    """Fetch a config value: DB first, then `default`."""
    try:
        from app.database import SessionLocal
        from app.models import PlatformConfig

        with SessionLocal() as db:
            row = db.get(PlatformConfig, key)
            if row is not None:
                return row.value
    except Exception as exc:  # noqa: BLE001
        # DB not yet ready (e.g. first startup before create_all) — fall through silently
        log.debug("config_store.get_config(%s) DB error: %s", key, exc)
    return default


def get_config_bool(key: str, default: bool = False) -> bool:
    """Fetch a boolean config value (stored as 'true'/'false' string)."""
    val = get_config(key)
    if val is None:
        return default
    return val.strip().lower() in _BOOL_TRUTHY


def get_config_int(key: str, default: int = 0) -> int:
    """Fetch an integer config value."""
    val = get_config(key)
    if val is None:
        return default
    try:
        return int(val)
    except ValueError:
        return default


def set_config(key: str, value: str, description: str | None = None) -> None:
    """Upsert a config value into the platform_config table."""
    from app.database import SessionLocal
    from app.models import PlatformConfig

    with SessionLocal() as db:
        row = db.get(PlatformConfig, key)
        if row is None:
            row = PlatformConfig(key=key, value=value)
            db.add(row)
        else:
            row.value = value
        if description is not None:
            row.description = description
        db.commit()
    log.info("platform_config: SET %s", key)


def delete_config(key: str) -> bool:
    """Delete a config entry. Returns True if it existed."""
    from app.database import SessionLocal
    from app.models import PlatformConfig

    with SessionLocal() as db:
        row = db.get(PlatformConfig, key)
        if row is None:
            return False
        db.delete(row)
        db.commit()
    log.info("platform_config: DELETE %s", key)
    return True


def list_config() -> list[dict]:
    """Return all config entries (values for API keys are masked)."""
    try:
        from app.database import SessionLocal
        from app.models import PlatformConfig

        with SessionLocal() as db:
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
    except Exception:  # noqa: BLE001
        return []
