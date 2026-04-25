"""Prompt portfolio builder — assembles Core + Strategic prompt portfolios."""
from __future__ import annotations

import random
from dataclasses import asdict

from .core_templates import CORE_TEMPLATES, get_core_templates, inject_placeholders
from .generator import GeneratedPrompt, generate_prompt_portfolio
from .taxonomy import (
    CATEGORY_AUTHORITY, CATEGORY_COMPARISON, CATEGORY_DISCOVERY, CATEGORY_REPUTATION,
    allocate_counts,
)
from .scoring import (
    detect_brand_mentioned, estimate_business_value,
    estimate_difficulty_level, estimate_priority_level, infer_expected_signal,
)


def _make_core_prompt(
    text: str,
    category: str,
    brand_name: str,
    competitors: list[str],
    sector_key: str,
) -> GeneratedPrompt:
    """Build a GeneratedPrompt from a core template."""
    is_brand = detect_brand_mentioned(text, brand_name)
    bv = estimate_business_value(category, is_brand)
    intent_labels = {
        CATEGORY_DISCOVERY: "recommandation spontanée",
        CATEGORY_COMPARISON: "comparaison concurrentielle",
        CATEGORY_REPUTATION: "fiabilité et confiance",
        CATEGORY_AUTHORITY: "expertise sectorielle",
    }
    explanations = {
        CATEGORY_DISCOVERY: "Ce prompt mesure si votre marque émerge spontanément quand un utilisateur cherche une solution sans vous mentionner.",
        CATEGORY_COMPARISON: "Ce prompt place votre marque en situation de comparaison directe avec un concurrent pour mesurer la préférence IA.",
        CATEGORY_REPUTATION: "Ce prompt interroge directement la fiabilité ou la valeur de votre marque, révélant le narratif construit par les IA.",
        CATEGORY_AUTHORITY: "Ce prompt mesure si votre marque est perçue comme une référence légitime et experte dans son domaine.",
    }
    used = [c for c in competitors if c.lower() in text.lower()]
    return GeneratedPrompt(
        text=text,
        prompt_category=category,
        intent_label=intent_labels.get(category, ""),
        business_value_score=bv,
        priority_level=estimate_priority_level(bv),
        difficulty_level=estimate_difficulty_level(category, is_brand),
        explanation=explanations.get(category, ""),
        target_competitors=used,
        is_brand_mentioned=is_brand,
        expected_signal=infer_expected_signal(category),
        prompt_scope="core",
        benchmark_eligible=True,
        strategic_eligible=False,
        sector_key=sector_key,
    )


def _build_core_prompts(
    brand_name: str,
    sector_key: str,
    competitors: list[str],
    total: int = 16,
) -> list[GeneratedPrompt]:
    """Build `total` core prompts from sector templates.

    Uses a fixed 6/4/3/3 distribution regardless of total,
    filling from the fixed pool of 16 sector templates.
    """
    templates = get_core_templates(sector_key)
    # Fixed distribution: 6 Discovery, 4 Comparison, 3 Reputation, 3 Authority
    counts: dict[str, int] = {
        CATEGORY_DISCOVERY:  6,
        CATEGORY_COMPARISON: 4,
        CATEGORY_REPUTATION: 3,
        CATEGORY_AUTHORITY:  3,
    }

    result: list[GeneratedPrompt] = []
    comp_list = competitors or []

    for category, count in counts.items():
        pool = list(templates.get(category, []))
        random.shuffle(pool)
        selected = pool[:count]
        c1 = comp_list[0] if comp_list else None
        c2 = comp_list[1] if len(comp_list) > 1 else None
        for template in selected:
            text = inject_placeholders(template, brand_name, c1, c2)
            result.append(_make_core_prompt(text, category, brand_name, comp_list, sector_key))

    return result


def build_prompt_portfolio(
    brand_name: str,
    sector_key: str,
    competitors: list[str] | None = None,
    total_core: int = 16,
    total_strategic: int = 8,
) -> dict:
    """Build the full 24-prompt portfolio (16 core + 8 strategic).

    Args:
        brand_name: The brand's display name
        sector_key: Sector key e.g. "banque", "saas", "assurance"
        competitors: Optional list of competitor names
        total_core: Number of core prompts (default 16)
        total_strategic: Number of strategic prompts (default 8)

    Returns:
        dict with keys: core, strategic, grouped_by_scope_and_category
    """
    comp_list = competitors or []

    # Core prompts — from sector templates
    core_prompts = _build_core_prompts(brand_name, sector_key, comp_list, total_core)

    # Strategic prompts — from existing generator
    strategic_prompts_raw = generate_prompt_portfolio(
        brand_name=brand_name,
        category=sector_key,
        competitors=comp_list,
        total=total_strategic,
    )
    # Tag as strategic (the generator already sets defaults)
    strategic_prompts: list[GeneratedPrompt] = []
    for p in strategic_prompts_raw:
        p.prompt_scope = "strategic"
        p.benchmark_eligible = False
        p.strategic_eligible = True
        strategic_prompts.append(p)

    def by_category(prompts: list[GeneratedPrompt]) -> dict[str, list[dict]]:
        g: dict[str, list[dict]] = {
            CATEGORY_DISCOVERY: [], CATEGORY_COMPARISON: [],
            CATEGORY_REPUTATION: [], CATEGORY_AUTHORITY: [],
        }
        for p in prompts:
            cat = p.prompt_category or CATEGORY_DISCOVERY
            if cat not in g:
                g[cat] = []
            g[cat].append(asdict(p))
        return g

    core_dicts = [asdict(p) for p in core_prompts]
    strategic_dicts = [asdict(p) for p in strategic_prompts]

    return {
        "core": {
            "prompts": core_dicts,
            "by_category": by_category(core_prompts),
        },
        "strategic": {
            "prompts": strategic_dicts,
            "by_category": by_category(strategic_prompts),
        },
        "grouped_by_scope_and_category": {
            "core": by_category(core_prompts),
            "strategic": by_category(strategic_prompts),
        },
    }
