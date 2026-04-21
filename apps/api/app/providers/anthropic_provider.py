from __future__ import annotations

import json
import time
from typing import Any

from anthropic import Anthropic, BadRequestError

from app.config import get_settings
from app.providers.base import LLMProvider, LLMResponse


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self) -> None:
        from app.config_store import get_config, get_config_bool

        s = get_settings()
        # DB config overrides .env; .env is the fallback
        api_key = get_config("provider.anthropic.api_key") or s.anthropic_api_key or ""
        self._enabled = get_config_bool("provider.anthropic.enabled", bool(s.anthropic_enabled))
        self.default_model = get_config("provider.anthropic.model") or s.anthropic_default_model
        self._api_key = api_key
        self._client = Anthropic(api_key=api_key) if api_key else None

    def is_enabled(self) -> bool:
        return bool(self._enabled and self._api_key and self._client)

    def _require_client(self) -> Anthropic:
        if not self._client:
            raise RuntimeError("Anthropic provider is not configured (missing API key or disabled).")
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
        start = time.perf_counter()

        # Build tools list with web_search if enabled
        # allowed_callers=["direct"] is required for models that don't support
        # programmatic tool calling (e.g. claude-sonnet-4-20250514)
        tools = []
        if use_web_search:
            tools.append({
                "type": "web_search_20260209",
                "name": "web_search",
                "max_uses": 5,
                "allowed_callers": ["direct"],
            })

        kwargs: dict = dict(
            model=model_id,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system or "",
            messages=[{"role": "user", "content": prompt}],
        )
        if tools:  # omit entirely when empty — some models reject tools=None/[]
            kwargs["tools"] = tools
        try:
            resp = client.messages.create(**kwargs)
        except BadRequestError as e:
            # Newer Claude 4 models (e.g. claude-opus-4-7) deprecate temperature
            if "temperature" in str(e) and "deprecated" in str(e):
                kwargs.pop("temperature", None)
                resp = client.messages.create(**kwargs)
            else:
                raise
        latency_ms = int((time.perf_counter() - start) * 1000)

        text_parts = [block.text for block in resp.content if getattr(block, "type", None) == "text"]
        text = "\n".join(text_parts).strip()

        # Extract web search citations if available
        citations_from_search = []
        for block in resp.content:
            if getattr(block, "type", None) == "text" and getattr(block, "citations", None):
                for cit in block.citations:
                    if getattr(cit, "type", None) == "web_search_result_location":
                        citations_from_search.append({
                            "url": getattr(cit, "url", None),
                            "title": getattr(cit, "title", None),
                            "cited_text": getattr(cit, "cited_text", None),
                        })

        return LLMResponse(
            text=text,
            model=model_id,
            provider=self.name,
            latency_ms=latency_ms,
            input_tokens=getattr(resp.usage, "input_tokens", None),
            output_tokens=getattr(resp.usage, "output_tokens", None),
            raw={
                "id": resp.id,
                "stop_reason": resp.stop_reason,
                "web_search_requests": getattr(getattr(resp.usage, "server_tool_use", None), "web_search_requests", 0),
                "web_citations": citations_from_search,
            },
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
        """Use Anthropic tool_use to force structured JSON output conforming to the schema."""
        client = self._require_client()
        model_id = model or self.default_model

        tool = {
            "name": schema_name,
            "description": f"Return a {schema_name} object strictly matching the schema.",
            "input_schema": json_schema,
        }

        kwargs_s: dict = dict(
            model=model_id,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system or "",
            tools=[tool],
            tool_choice={"type": "tool", "name": schema_name},
            messages=[{"role": "user", "content": prompt}],
        )
        try:
            resp = client.messages.create(**kwargs_s)
        except BadRequestError as e:
            if "temperature" in str(e) and "deprecated" in str(e):
                kwargs_s.pop("temperature", None)
                resp = client.messages.create(**kwargs_s)
            else:
                raise

        for block in resp.content:
            if getattr(block, "type", None) == "tool_use" and block.name == schema_name:
                return dict(block.input)

        # Fallback: try to parse any text block as JSON.
        for block in resp.content:
            if getattr(block, "type", None) == "text":
                try:
                    return json.loads(block.text)
                except json.JSONDecodeError:
                    continue

        raise RuntimeError("Anthropic did not return a tool_use block matching the requested schema.")
