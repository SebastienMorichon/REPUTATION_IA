"""Business scoring and metadata inference for prompt strategy."""
from __future__ import annotations

from .taxonomy import (
    CATEGORY_DISCOVERY, CATEGORY_COMPARISON, CATEGORY_REPUTATION, CATEGORY_AUTHORITY,
)

_SIGNAL_MAP = {
    CATEGORY_DISCOVERY:  "spontaneous_recommendation",
    CATEGORY_COMPARISON: "competitive_preference",
    CATEGORY_REPUTATION: "trust_assessment",
    CATEGORY_AUTHORITY:  "authority_recognition",
}

_BASE_VALUE = {
    CATEGORY_DISCOVERY:  82.0,
    CATEGORY_COMPARISON: 78.0,
    CATEGORY_REPUTATION: 65.0,
    CATEGORY_AUTHORITY:  72.0,
}


def estimate_business_value(category: str, is_brand_mentioned: bool) -> float:
    """Return a 0–100 business value score for a prompt."""
    base = _BASE_VALUE.get(category, 60.0)
    # Discovery & Authority without brand name = highest value (pure spontaneous signal)
    if category in (CATEGORY_DISCOVERY, CATEGORY_AUTHORITY) and not is_brand_mentioned:
        return min(base + 8.0, 100.0)
    # Comparison with brand = high competitive intelligence value
    if category == CATEGORY_COMPARISON and is_brand_mentioned:
        return min(base + 5.0, 100.0)
    return base


def estimate_priority_level(business_value: float) -> str:
    if business_value >= 85:
        return "critical"
    if business_value >= 72:
        return "high"
    if business_value >= 55:
        return "medium"
    return "low"


def estimate_difficulty_level(category: str, is_brand_mentioned: bool) -> str:
    """Difficulty = how hard it is for the brand to appear in this prompt type."""
    if category == CATEGORY_DISCOVERY and not is_brand_mentioned:
        return "hard"   # hardest: brand must emerge spontaneously
    if category == CATEGORY_COMPARISON:
        return "medium"
    if category == CATEGORY_REPUTATION and is_brand_mentioned:
        return "easy"   # easiest: brand is directly named
    if category == CATEGORY_AUTHORITY and not is_brand_mentioned:
        return "hard"
    return "medium"


def detect_brand_mentioned(prompt_text: str, brand_name: str) -> bool:
    """Return True if the brand name appears in the prompt text (case-insensitive)."""
    return brand_name.lower() in prompt_text.lower()


def infer_expected_signal(category: str) -> str:
    return _SIGNAL_MAP.get(category, "trust_assessment")


def migrate_category(prompt_text: str, brand_name: str) -> str:
    """Classify an existing prompt without category into discovery or reputation."""
    if detect_brand_mentioned(prompt_text, brand_name):
        return CATEGORY_REPUTATION
    return CATEGORY_DISCOVERY
