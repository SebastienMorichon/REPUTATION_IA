from __future__ import annotations

import json
import time
from typing import Any

from openai import OpenAI

from app.config import get_settings
from app.providers.base import LLMProvider, LLMResponse


class PerplexityProvider(LLMProvider):
    """Perplexity AI — uses the OpenAI-compatible API at api.perplexity.ai.

    Perplexity's sonar models are online (web-augmented), making them especially
    relevant for brand discovery monitoring — they reflect what real users would
    find when asking an AI with live search access.

    Note: Perplexity does not support strict JSON schema response_format.
    generate_structured() falls back to prompt-based JSON extraction.
    """

    name = "perplexity"

    def __init__(self) -> None:
        from app.config_store import get_config, get_config_bool

        s = get_settings()
        api_key = get_config("provider.perplexity.api_key") or s.perplexity_api_key or ""
        self._enabled = get_config_bool("provider.perplexity.enabled", bool(s.perplexity_enabled))
        self.default_model = get_config("provider.perplexity.model") or s.perplexity_default_model
        self._api_key = api_key
        self._client: OpenAI | None = (
            OpenAI(
                api_key=api_key,
                base_url="https://api.perplexity.ai",
            )
            if api_key
            else None
        )

    def is_enabled(self) -> bool:
        return bool(
            self._enabled
            and self._api_key
            and self._client
        )

    def _require_client(self) -> OpenAI:
        if not self._client:
            raise RuntimeError(
                "Perplexity provider is not configured (missing API key or disabled)."
            )
        return self._client

    def generate(
        self,
        prompt: str,
        *,
        model: str | None = None,
        system: str | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.2,
        use_web_search: bool = False,
    ) -> LLMResponse:
        client = self._require_client()
        model_id = model or self.default_model
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        start = time.perf_counter()
        resp = client.chat.completions.create(
            model=model_id,
            messages=messages,  # type: ignore[arg-type]
            max_tokens=max_tokens,
            temperature=temperature,
        )
        latency_ms = int((time.perf_counter() - start) * 1000)

        choice = resp.choices[0]
        text = (choice.message.content or "").strip()
        usage = resp.usage

        return LLMResponse(
            text=text,
            model=model_id,
            provider=self.name,
            latency_ms=latency_ms,
            input_tokens=getattr(usage, "prompt_tokens", None),
            output_tokens=getattr(usage, "completion_tokens", None),
            raw={"id": resp.id, "finish_reason": choice.finish_reason},
        )

    def generate_structured(
        self,
        prompt: str,
        *,
        json_schema: dict[str, Any],
        schema_name: str,
        model: str | None = None,
        system: str | None = None,
        max_tokens: int = 2048,
        temperature: float = 0.0,
    ) -> dict[str, Any]:
        """Prompt-based JSON extraction (Perplexity doesn't support strict schema mode)."""
        client = self._require_client()
        model_id = model or self.default_model

        json_instruction = (
            "You MUST respond with a single valid JSON object only. "
            "No markdown, no code fences, no explanation — raw JSON only."
        )
        sys_content = f"{system}\n\n{json_instruction}" if system else json_instruction
        messages: list[dict[str, str]] = [
            {"role": "system", "content": sys_content},
            {"role": "user", "content": prompt},
        ]

        resp = client.chat.completions.create(
            model=model_id,
            messages=messages,  # type: ignore[arg-type]
            max_tokens=max_tokens,
            temperature=temperature,
        )
        content = (resp.choices[0].message.content or "{}").strip()

        # Strip markdown code fences if the model added them anyway
        if content.startswith("```"):
            lines = content.splitlines()
            start_idx = 1  # skip ```json or ```
            end_idx = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
            content = "\n".join(lines[start_idx:end_idx]).strip()

        return json.loads(content)
