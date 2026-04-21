from __future__ import annotations

import json
import time
from typing import Any

from openai import OpenAI

from app.config import get_settings
from app.providers.base import LLMProvider, LLMResponse


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self) -> None:
        from app.config_store import get_config, get_config_bool

        s = get_settings()
        api_key = get_config("provider.openai.api_key") or s.openai_api_key or ""
        self._enabled = get_config_bool("provider.openai.enabled", bool(s.openai_enabled))
        self.default_model = get_config("provider.openai.model") or s.openai_default_model
        self.search_model = get_config("provider.openai.search_model") or s.openai_search_model
        self._api_key = api_key
        self._client = OpenAI(api_key=api_key) if api_key else None

    def is_enabled(self) -> bool:
        return bool(self._enabled and self._api_key and self._client)

    def _require_client(self) -> OpenAI:
        if not self._client:
            raise RuntimeError("OpenAI provider is not configured (missing API key or disabled).")
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

        # Use Responses API for web search (only API that supports it)
        if use_web_search:
            # gpt-5 (exact) is a reasoning model that returns reasoning items, not text.
            # gpt-5.1+ and other variants work fine — only the bare "gpt-5" needs a fallback.
            model_id = self.search_model
            if model_id.strip().lower() == "gpt-5":
                model_id = "gpt-4o-mini"

            start = time.perf_counter()

            resp = client.responses.create(
                model=model_id,
                input=prompt,
                tools=[{"type": "web_search_preview"}],  # correct tool type for Responses API
                max_output_tokens=max_tokens,
                # temperature is not supported by the Responses API
            )
            latency_ms = int((time.perf_counter() - start) * 1000)

            # Primary: use the SDK's output_text convenience property
            text = getattr(resp, "output_text", None) or ""

            # Fallback: iterate output items
            if not text and hasattr(resp, "output") and resp.output:
                for item in resp.output:
                    if hasattr(item, "content") and item.content:
                        for content_item in item.content:
                            t = getattr(content_item, "text", None)
                            if t:
                                text += t

            usage = getattr(resp, "usage", None)

            return LLMResponse(
                text=text.strip(),
                model=model_id,
                provider=self.name,
                latency_ms=latency_ms,
                input_tokens=getattr(usage, "input_tokens", None) if usage else None,
                output_tokens=getattr(usage, "output_tokens", None) if usage else None,
                raw={"id": getattr(resp, "id", None)},
            )

        # Standard Chat Completions API (no web search)
        model_id = model or self.default_model
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        start = time.perf_counter()
        resp = client.chat.completions.create(
            model=model_id,
            messages=messages,
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
        """Use OpenAI Structured Outputs to force a JSON response conforming to the schema."""
        client = self._require_client()
        model_id = model or self.default_model

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        resp = client.chat.completions.create(
            model=model_id,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "schema": json_schema,
                    "strict": True,
                },
            },
        )
        content = resp.choices[0].message.content or "{}"
        return json.loads(content)
