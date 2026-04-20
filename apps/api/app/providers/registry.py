from __future__ import annotations

import logging

from app.providers.anthropic_provider import AnthropicProvider
from app.providers.base import LLMProvider
from app.providers.openai_provider import OpenAIProvider
from app.providers.perplexity_provider import PerplexityProvider

log = logging.getLogger(__name__)

# Built-in provider names — config lives in .env / platform_config
_BUILTIN_NAMES = frozenset({"anthropic", "openai", "perplexity"})


def _providers() -> dict[str, LLMProvider]:
    """Build the full provider map: built-ins + dynamic DB providers.

    No lru_cache — always creates fresh instances so that admin UI changes
    to API keys and enabled flags take effect on the very next request.
    """
    providers: dict[str, LLMProvider] = {
        "anthropic":  AnthropicProvider(),
        "openai":     OpenAIProvider(),
        "perplexity": PerplexityProvider(),
    }

    # Load custom providers from DB (added via admin UI)
    try:
        from app.database import SessionLocal
        from app.models import LLMProviderConfig
        from app.providers.dynamic_provider import build_dynamic_provider

        with SessionLocal() as db:
            customs = db.query(LLMProviderConfig).all()
            for cfg in customs:
                providers[cfg.name] = build_dynamic_provider(cfg)
    except Exception as exc:  # noqa: BLE001
        # DB not ready at startup or table doesn't exist yet
        log.debug("registry: could not load custom providers from DB: %s", exc)

    return providers


def get_provider(name: str) -> LLMProvider:
    providers = _providers()
    if name not in providers:
        raise KeyError(f"Unknown provider: {name!r}")
    provider = providers[name]
    if not provider.is_enabled():
        raise RuntimeError(
            f"Provider '{name}' is not enabled. Check its API key and enabled flag."
        )
    return provider


def list_enabled_providers() -> list[LLMProvider]:
    return [p for p in _providers().values() if p.is_enabled()]


def is_builtin(name: str) -> bool:
    return name in _BUILTIN_NAMES
