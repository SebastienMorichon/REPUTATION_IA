"""Generic LLM providers loaded from the `llm_providers` DB table.

Supports two wire protocols:
  - openai_compat: Any provider with an OpenAI-compatible REST API
    (Mistral, Groq, DeepSeek, Together AI, OpenRouter, Fireworks, Ollama…)
  - anthropic: Anthropic SDK (for custom Claude endpoints / proxies)

generate_structured() tries the provider's native JSON-schema mode first,
then falls back to prompt-based extraction for providers that don't support it.
"""
from __future__ import annotations

import json
import logging
import time
from typing import TYPE_CHECKING, Any

from app.providers.base import LLMProvider, LLMResponse

if TYPE_CHECKING:
    from app.models import LLMProviderConfig

log = logging.getLogger(__name__)


class DynamicOpenAICompatProvider(LLMProvider):
    """OpenAI-SDK-compatible provider (custom base_url)."""

    def __init__(self, cfg: "LLMProviderConfig") -> None:
        from openai import OpenAI

        self.name = cfg.name
        self._label = cfg.label
        self.default_model = cfg.default_model
        self._enabled = cfg.enabled
        self._api_key = cfg.api_key or ""
        self._client = (
            OpenAI(
                api_key=self._api_key or "no-key",  # some local providers ignore the key
                base_url=cfg.base_url or None,
            )
            if (self._api_key or cfg.base_url)  # at least one must be set
            else None
        )

    def is_enabled(self) -> bool:
        return bool(self._enabled and self._client)

    def _require_client(self):
        if not self._client:
            raise RuntimeError(f"Provider '{self.name}' is not configured (missing API key or base URL).")
        from openai import OpenAI
        return self._client  # type: ignore[return-value]

    def generate(
        self,
        prompt: str,
        *,
        model: str | None = None,
        system: str | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.2,
    ) -> LLMResponse:
        client = self._require_client()
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
            raw={"finish_reason": choice.finish_reason},
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
        """Try JSON schema mode first; fall back to prompt-based extraction."""
        client = self._require_client()
        model_id = model or self.default_model

        # --- Attempt 1: native JSON schema mode (OpenAI / Mistral / Groq…) ---
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        try:
            resp = client.chat.completions.create(
                model=model_id,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                response_format={
                    "type": "json_schema",
                    "json_schema": {"name": schema_name, "schema": json_schema, "strict": True},
                },
            )
            content = resp.choices[0].message.content or "{}"
            return json.loads(content)
        except Exception as exc:
            log.debug("Provider %s: JSON schema mode failed (%s), falling back to prompt-based.", self.name, exc)

        # --- Attempt 2: prompt-based JSON extraction ---
        json_instruction = (
            "You MUST respond with a single valid JSON object only. "
            "No markdown, no code fences, no explanation — raw JSON only."
        )
        sys2 = f"{system}\n\n{json_instruction}" if system else json_instruction
        messages2 = [{"role": "system", "content": sys2}, {"role": "user", "content": prompt}]

        resp2 = client.chat.completions.create(
            model=model_id, messages=messages2, max_tokens=max_tokens, temperature=temperature,
        )
        content2 = (resp2.choices[0].message.content or "{}").strip()
        if content2.startswith("```"):
            lines = content2.splitlines()
            start_idx = 1
            end_idx = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
            content2 = "\n".join(lines[start_idx:end_idx]).strip()
        return json.loads(content2)


class DynamicAnthropicProvider(LLMProvider):
    """Anthropic-SDK-compatible provider (custom endpoint / proxy)."""

    def __init__(self, cfg: "LLMProviderConfig") -> None:
        from anthropic import Anthropic

        self.name = cfg.name
        self._label = cfg.label
        self.default_model = cfg.default_model
        self._enabled = cfg.enabled
        self._api_key = cfg.api_key or ""
        self._client = (
            Anthropic(
                api_key=self._api_key,
                base_url=cfg.base_url or None,
            )
            if self._api_key
            else None
        )

    def is_enabled(self) -> bool:
        return bool(self._enabled and self._api_key and self._client)

    def _require_client(self):
        if not self._client:
            raise RuntimeError(f"Provider '{self.name}' is not configured (missing API key).")
        return self._client

    def generate(
        self,
        prompt: str,
        *,
        model: str | None = None,
        system: str | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.2,
    ) -> LLMResponse:
        client = self._require_client()
        model_id = model or self.default_model
        start = time.perf_counter()
        resp = client.messages.create(
            model=model_id,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system or "",
            messages=[{"role": "user", "content": prompt}],
        )
        latency_ms = int((time.perf_counter() - start) * 1000)
        text_parts = [b.text for b in resp.content if getattr(b, "type", None) == "text"]
        return LLMResponse(
            text="\n".join(text_parts).strip(),
            model=model_id,
            provider=self.name,
            latency_ms=latency_ms,
            input_tokens=getattr(resp.usage, "input_tokens", None),
            output_tokens=getattr(resp.usage, "output_tokens", None),
            raw={"stop_reason": resp.stop_reason},
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
        client = self._require_client()
        model_id = model or self.default_model
        tool = {
            "name": schema_name,
            "description": f"Return a {schema_name} object strictly matching the schema.",
            "input_schema": json_schema,
        }
        resp = client.messages.create(
            model=model_id, max_tokens=max_tokens, temperature=temperature,
            system=system or "", tools=[tool],
            tool_choice={"type": "tool", "name": schema_name},
            messages=[{"role": "user", "content": prompt}],
        )
        for block in resp.content:
            if getattr(block, "type", None) == "tool_use" and block.name == schema_name:
                return dict(block.input)
        raise RuntimeError(f"Provider '{self.name}' did not return structured output.")


def build_dynamic_provider(cfg: "LLMProviderConfig") -> LLMProvider:
    """Factory: return the right provider class based on api_type."""
    if cfg.api_type == "anthropic":
        return DynamicAnthropicProvider(cfg)
    return DynamicOpenAICompatProvider(cfg)  # default: openai_compat
