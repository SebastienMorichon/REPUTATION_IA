from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class LLMResponse:
    text: str
    model: str
    provider: str
    latency_ms: int
    input_tokens: int | None = None
    output_tokens: int | None = None
    raw: dict[str, Any] | None = field(default=None)


class LLMProvider(ABC):
    name: str
    default_model: str

    @abstractmethod
    def is_enabled(self) -> bool:
        ...

    @abstractmethod
    def generate(
        self,
        prompt: str,
        *,
        model: str | None = None,
        system: str | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.2,
    ) -> LLMResponse:
        """Run a free-form completion used for observation (what the LLM says about the brand)."""

    @abstractmethod
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
        """Run an extraction that MUST return JSON conforming to json_schema."""
