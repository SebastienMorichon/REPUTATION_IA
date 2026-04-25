"""Prompt taxonomy — 4 strategic families for brand reputation monitoring in AI."""
from __future__ import annotations
from dataclasses import dataclass, field

CATEGORY_DISCOVERY   = "discovery"
CATEGORY_COMPARISON  = "comparison"
CATEGORY_REPUTATION  = "reputation"
CATEGORY_AUTHORITY   = "authority"

ALL_CATEGORIES = [CATEGORY_DISCOVERY, CATEGORY_COMPARISON, CATEGORY_REPUTATION, CATEGORY_AUTHORITY]

# Recommended portfolio ratios (must sum to 1.0)
RATIOS: dict[str, float] = {
    CATEGORY_DISCOVERY:  0.40,
    CATEGORY_COMPARISON: 0.25,
    CATEGORY_REPUTATION: 0.20,
    CATEGORY_AUTHORITY:  0.15,
}

@dataclass(frozen=True)
class CategoryInfo:
    key: str
    title: str
    description: str
    tooltip: str
    expected_signal: str
    recommended_ratio: float
    is_brand_mentioned_typical: bool
    score_mapping: list[str]
    intent_label: str

CATEGORY_INFO: dict[str, CategoryInfo] = {
    CATEGORY_DISCOVERY: CategoryInfo(
        key=CATEGORY_DISCOVERY,
        title="Discovery",
        description="Questions où l'utilisateur cherche une solution sans citer la marque. Mesure la recommandation spontanée.",
        tooltip="Mesure si votre marque apparaît spontanément quand un utilisateur cherche une solution, sans citer votre nom.",
        expected_signal="spontaneous_recommendation",
        recommended_ratio=0.40,
        is_brand_mentioned_typical=False,
        score_mapping=["visibility", "share_of_voice"],
        intent_label="recommandation spontanée",
    ),
    CATEGORY_COMPARISON: CategoryInfo(
        key=CATEGORY_COMPARISON,
        title="Comparison",
        description="Questions où l'utilisateur compare plusieurs acteurs. Mesure la dominance concurrentielle.",
        tooltip="Mesure si votre marque est préférée lorsqu'elle est comparée à d'autres acteurs.",
        expected_signal="competitive_preference",
        recommended_ratio=0.25,
        is_brand_mentioned_typical=True,
        score_mapping=["rank_dominance", "share_of_voice"],
        intent_label="comparaison concurrentielle",
    ),
    CATEGORY_REPUTATION: CategoryInfo(
        key=CATEGORY_REPUTATION,
        title="Reputation",
        description="Questions où l'utilisateur cherche des avis, de la confiance ou de la fiabilité de la marque.",
        tooltip="Mesure ce que les IA disent explicitement de votre marque : confiance, avis, risques ou perception.",
        expected_signal="trust_assessment",
        recommended_ratio=0.20,
        is_brand_mentioned_typical=True,
        score_mapping=["sentiment", "narrative_control"],
        intent_label="fiabilité et confiance",
    ),
    CATEGORY_AUTHORITY: CategoryInfo(
        key=CATEGORY_AUTHORITY,
        title="Authority",
        description="Questions où l'utilisateur cherche une référence ou un expert reconnu dans le domaine.",
        tooltip="Mesure si votre marque est reconnue comme une référence crédible dans son domaine.",
        expected_signal="authority_recognition",
        recommended_ratio=0.15,
        is_brand_mentioned_typical=False,
        score_mapping=["entity_authority", "citation_quality"],
        intent_label="expertise sectorielle",
    ),
}


def get_category_info(key: str) -> CategoryInfo:
    return CATEGORY_INFO.get(key, CATEGORY_INFO[CATEGORY_REPUTATION])


def allocate_counts(total: int) -> dict[str, int]:
    """Distribute `total` prompts according to recommended ratios, rounding fairly."""
    raw = {k: total * v for k, v in RATIOS.items()}
    floored = {k: int(v) for k, v in raw.items()}
    remainder = total - sum(floored.values())
    # Distribute remaining slots by largest fractional part
    by_fraction = sorted(raw.keys(), key=lambda k: raw[k] - floored[k], reverse=True)
    for i in range(remainder):
        floored[by_fraction[i]] += 1
    return floored
