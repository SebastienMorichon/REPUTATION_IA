from __future__ import annotations

import json
from typing import Any

from app.config import get_settings
from app.providers import get_provider

# JSON schema for the structured analysis output.
# Kept strict-compatible: every object has additionalProperties: false and required lists all keys.
ANALYSIS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["target_brand_present", "mentions", "citations", "sentiment", "factual_claims", "summary"],
    "properties": {
        "target_brand_present": {
            "type": "boolean",
            "description": "Whether the target brand is explicitly mentioned in the response.",
        },
        "target_brand_rank": {
            "type": ["integer", "null"],
            "description": "1-indexed rank position if the brand appears in an ordered list; null otherwise.",
        },
        "mentions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "entity_name",
                    "is_target_brand",
                    "is_known_competitor",
                    "rank_position",
                    "sentiment",
                    "mention_type",
                    "context_excerpt",
                ],
                "properties": {
                    "entity_name": {"type": "string"},
                    "is_target_brand": {"type": "boolean"},
                    "is_known_competitor": {"type": "boolean"},
                    "rank_position": {"type": ["integer", "null"]},
                    "sentiment": {
                        "type": ["string", "null"],
                        "enum": ["positive", "neutral", "cautious", "negative", None],
                    },
                    "mention_type": {
                        "type": ["string", "null"],
                        "enum": ["recommendation", "comparison", "neutral_reference", "warning", "other", None],
                    },
                    "context_excerpt": {"type": ["string", "null"]},
                },
            },
        },
        "citations": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["url", "domain", "title", "citation_type", "refers_to_target"],
                "properties": {
                    "url": {"type": ["string", "null"]},
                    "domain": {"type": ["string", "null"]},
                    "title": {"type": ["string", "null"]},
                    "citation_type": {
                        "type": ["string", "null"],
                        "enum": ["official", "third_party", "review", "news", "other", None],
                    },
                    "refers_to_target": {"type": "boolean"},
                },
            },
        },
        "sentiment": {
            "type": "object",
            "additionalProperties": False,
            "required": ["overall", "target_brand"],
            "properties": {
                "overall": {"type": "string", "enum": ["positive", "neutral", "cautious", "negative", "mixed"]},
                "target_brand": {
                    "type": ["string", "null"],
                    "enum": ["positive", "neutral", "cautious", "negative", "absent", None],
                },
            },
        },
        "factual_claims": {
            "type": "array",
            "description": "Verifiable factual claims about the target brand extracted from the response.",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["subject", "predicate", "object", "confidence"],
                "properties": {
                    "subject": {"type": "string"},
                    "predicate": {"type": "string"},
                    "object": {"type": "string"},
                    "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
                },
            },
        },
        "summary": {"type": "string", "description": "One-sentence gist of how the LLM framed the topic."},
    },
}

_SYSTEM = (
    "You are a reputation analyst. Extract structured metadata from an LLM's free-form answer. "
    "Apply these STRICT rules with no exceptions:\n"
    "1. is_target_brand=true ONLY when the exact brand name or one of its aliases appears VERBATIM "
    "in the text (case-insensitive substring match). "
    "Generic category nouns ('épiceries fines', 'restaurants', 'banques', etc.) are NEVER the target brand, "
    "even if the brand belongs to that category. If the brand is not named, it is absent.\n"
    "2. rank_position is set ONLY when the response presents an explicitly numbered or ordered list. "
    "Do not infer rank from prose.\n"
    "3. is_known_competitor=true ONLY for names present in the provided competitor list.\n"
    "4. Never invent or infer information not present verbatim in the text."
)


def _build_prompt(
    *,
    response_text: str,
    user_prompt: str,
    brand_name: str,
    brand_aliases: list[str],
    competitor_list: list[dict[str, Any]],
) -> str:
    competitors_json = json.dumps(competitor_list, ensure_ascii=False)
    aliases_json = json.dumps(brand_aliases, ensure_ascii=False)
    return (
        "Analyze the following LLM response.\n\n"
        f"ORIGINAL USER PROMPT:\n{user_prompt}\n\n"
        f"TARGET BRAND: {brand_name}\n"
        f"TARGET BRAND ALIASES (treat as same entity): {aliases_json}\n"
        f"KNOWN COMPETITORS (name + optional aliases): {competitors_json}\n\n"
        "LLM RESPONSE TO ANALYZE:\n"
        "```\n"
        f"{response_text}\n"
        "```\n\n"
        "Extract the structured analysis. Rules:\n"
        "- is_target_brand=true REQUIRES the exact brand name or an alias to appear VERBATIM in the text. "
        "Generic category mentions ('les épiceries fines', 'les restaurants du centre') are NOT the target brand. "
        "If the brand name is absent from the text, it must NOT appear in mentions at all, "
        "and target_brand_present must be false.\n"
        "- is_known_competitor=true only for names explicitly present in the competitor list.\n"
        "- rank_position: 1-indexed ONLY when the response has a numbered/ordered list; null otherwise.\n"
        "- context_excerpt: verbatim quote (≤200 chars) of the sentence containing the mention.\n"
    )


def analyze_response(
    *,
    response_text: str,
    user_prompt: str,
    brand_name: str,
    brand_aliases: list[str] | None,
    competitors: list[dict[str, Any]],
) -> dict[str, Any]:
    """Run the analyzer LLM and return structured JSON conforming to ANALYSIS_SCHEMA."""
    settings = get_settings()
    provider = get_provider(settings.analyzer_provider)
    model = settings.analyzer_model or provider.default_model

    prompt = _build_prompt(
        response_text=response_text,
        user_prompt=user_prompt,
        brand_name=brand_name,
        brand_aliases=brand_aliases or [],
        competitor_list=competitors,
    )

    return provider.generate_structured(
        prompt=prompt,
        json_schema=ANALYSIS_SCHEMA,
        schema_name="ReputationAnalysis",
        model=model,
        system=_SYSTEM,
        max_tokens=2048,
        temperature=0.0,
    )
