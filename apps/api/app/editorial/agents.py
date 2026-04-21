"""Editorial AI agents — each uses generate_structured() for deterministic JSON output.

All schemas use additionalProperties: false (same strict pattern as ANALYSIS_SCHEMA).
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from app.config import get_settings
from app.providers import get_provider

if TYPE_CHECKING:
    from app.models import Brand, Organization

log = logging.getLogger(__name__)

# ── JSON schemas ──────────────────────────────────────────────────────────────

BRIEF_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "topic",
        "angle",
        "audience",
        "target_keyword",
        "outline",
        "cta",
        "sources",
        "product_data_points",
    ],
    "properties": {
        "topic": {
            "type": "string",
            "description": "Short title / topic of the article (≤120 chars).",
        },
        "angle": {
            "type": "string",
            "description": "Unique editorial angle or hook that differentiates this article.",
        },
        "audience": {
            "type": "string",
            "description": "Target reader persona (role, pain point, context).",
        },
        "target_keyword": {
            "type": "string",
            "description": "Primary SEO keyword to rank for.",
        },
        "outline": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Ordered list of H2/H3 section headings.",
        },
        "cta": {
            "type": "string",
            "description": "Call-to-action at the end of the article.",
        },
        "sources": {
            "type": "array",
            "items": {"type": "string"},
            "description": "URLs or named sources to reference in the article.",
        },
        "product_data_points": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Specific product facts, stats, or differentiators to weave in.",
        },
    },
}

DRAFT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "title",
        "slug",
        "excerpt",
        "content_markdown",
        "seo_title",
        "seo_description",
        "summary",
    ],
    "properties": {
        "title": {"type": "string", "description": "H1 article title (≤80 chars)."},
        "slug": {
            "type": "string",
            "description": "URL-safe slug (lowercase, hyphens, no accents, ≤80 chars).",
        },
        "excerpt": {
            "type": "string",
            "description": "One-paragraph article preview (≤250 chars).",
        },
        "content_markdown": {
            "type": "string",
            "description": "Full article body in GitHub-flavored Markdown (800-1500 words).",
        },
        "seo_title": {
            "type": "string",
            "description": "SEO <title> tag (50-60 chars, includes target keyword).",
        },
        "seo_description": {
            "type": "string",
            "description": "SEO meta description (150-160 chars, includes target keyword).",
        },
        "summary": {
            "type": "string",
            "description": "One-sentence gist of the article for internal logs.",
        },
    },
}

REVIEW_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "quality_score",
        "seo_score",
        "factual_risk",
        "duplicate_risk",
        "needs_human_review",
        "review_notes",
        "suggested_edits",
    ],
    "properties": {
        "quality_score": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "description": "Overall editorial quality 0-100.",
        },
        "seo_score": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "description": "SEO optimisation quality 0-100.",
        },
        "factual_risk": {
            "type": "string",
            "enum": ["low", "medium", "high"],
            "description": "Risk that the draft contains hallucinated facts.",
        },
        "duplicate_risk": {
            "type": "string",
            "enum": ["low", "medium", "high"],
            "description": "Risk that the content is too generic / duplicates existing articles.",
        },
        "needs_human_review": {
            "type": "boolean",
            "description": "True if a human editor should review before publishing.",
        },
        "review_notes": {
            "type": "string",
            "description": "Free-form editor notes explaining scores and flags.",
        },
        "suggested_edits": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Actionable edit suggestions (max 5).",
        },
    },
}

LINKEDIN_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["post", "short_variant", "hook", "hashtags", "cta"],
    "properties": {
        "post": {
            "type": "string",
            "description": "Full LinkedIn post (≤1300 chars) promoting the article.",
        },
        "short_variant": {
            "type": "string",
            "description": "Short version (≤280 chars) for Twitter/X cross-post.",
        },
        "hook": {
            "type": "string",
            "description": "Opening line / hook sentence to maximise engagement.",
        },
        "hashtags": {
            "type": "array",
            "items": {"type": "string"},
            "description": "3-6 relevant LinkedIn hashtags (without #).",
        },
        "cta": {
            "type": "string",
            "description": "Call-to-action sentence ending the post.",
        },
    },
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_provider():
    settings = get_settings()
    provider = get_provider(settings.analyzer_provider)
    model = settings.analyzer_model or provider.default_model
    return provider, model


# ── Agent 1 — Brief ───────────────────────────────────────────────────────────

def run_brief_agent(
    *,
    brand: "Brand | None",
    organization: "Organization | None" = None,
    topic_hint: str | None = None,
) -> dict[str, Any]:
    """Generate an editorial brief for a new article.

    Uses brand context (name, category, description, competitors) to produce
    a focused topic, angle, keyword, and outline.
    """
    provider, model = _get_provider()

    brand_context = ""
    if brand:
        brand_context = (
            f"\nBrand: {brand.name}"
            f"\nCategory: {brand.category or 'unknown'}"
            f"\nDescription: {brand.description or 'N/A'}"
            f"\nDomain: {brand.domain or 'N/A'}"
        )
        if brand.competitors:
            comp_names = ", ".join(c.name for c in brand.competitors[:5])
            brand_context += f"\nMain competitors: {comp_names}"

    topic_context = f"\nTopic hint from editor: {topic_hint}" if topic_hint else ""

    system = (
        "You are an expert content strategist for a SaaS company called AI Reputation Shield "
        "that helps brands monitor and improve how AI systems (ChatGPT, Claude, Perplexity) "
        "present them. You specialise in thought-leadership articles that rank on Google and "
        "drive inbound leads. Write in a professional yet accessible style, in French."
    )

    prompt = (
        "Create a detailed editorial brief for a new blog article."
        f"{brand_context}"
        f"{topic_context}"
        "\n\n"
        "The article must:\n"
        "- Provide genuine value to marketing/brand managers curious about AI reputation\n"
        "- Target a high-intent SEO keyword with ≥500 monthly searches\n"
        "- Be 800-1500 words when written\n"
        "- Be written in French\n\n"
        "Return the brief as structured JSON."
    )

    result = provider.generate_structured(
        prompt=prompt,
        json_schema=BRIEF_SCHEMA,
        schema_name="EditorialBrief",
        model=model,
        system=system,
        max_tokens=1024,
        temperature=0.7,
    )
    log.info("Brief generated: topic=%s", result.get("topic", "?"))
    return result


# ── Agent 2 — Draft ───────────────────────────────────────────────────────────

def run_draft_agent(
    *,
    brief: dict[str, Any],
    brand: "Brand | None" = None,
) -> dict[str, Any]:
    """Write the full article draft from the editorial brief."""
    provider, model = _get_provider()

    import json

    brand_note = f" for the brand '{brand.name}'" if brand else ""

    system = (
        "You are a senior content writer specialising in B2B SaaS and AI technology. "
        "You write clear, insightful articles in French that combine data-driven insight "
        "with practical advice. Your writing is engaging and flows naturally."
    )

    prompt = (
        f"Write a complete blog article{brand_note} based on this editorial brief:\n\n"
        f"{json.dumps(brief, ensure_ascii=False, indent=2)}\n\n"
        "Requirements:\n"
        "- Full article in GitHub-flavored Markdown (use ## for H2, ### for H3)\n"
        "- 800-1500 words in the content_markdown field\n"
        "- Weave in all product_data_points naturally — don't just list them\n"
        "- Include a brief introduction, all outline sections, and the CTA at the end\n"
        "- The slug must be URL-safe: lowercase, hyphens only, no accents, max 80 chars\n"
        "- SEO title: 50-60 chars including the target_keyword\n"
        "- SEO description: 150-160 chars, compelling, includes target_keyword\n"
        "- Write entirely in French\n"
    )

    result = provider.generate_structured(
        prompt=prompt,
        json_schema=DRAFT_SCHEMA,
        schema_name="ArticleDraft",
        model=model,
        system=system,
        max_tokens=4096,
        temperature=0.5,
    )
    log.info("Draft written: title=%s slug=%s", result.get("title", "?"), result.get("slug", "?"))
    return result


# ── Agent 3 — Review ──────────────────────────────────────────────────────────

def run_review_agent(
    *,
    draft: dict[str, Any],
    brief: dict[str, Any],
) -> dict[str, Any]:
    """Editorial review: quality, SEO, factual risk, duplicate risk."""
    provider, model = _get_provider()

    import json

    system = (
        "You are a rigorous editorial director reviewing AI-generated content before publication. "
        "Your job is to catch hallucinations, SEO issues, and content quality problems. "
        "Be critical but fair. Flag anything that could embarrass the brand or mislead readers."
    )

    prompt = (
        "Review the following AI-generated article draft against its editorial brief.\n\n"
        f"BRIEF:\n{json.dumps(brief, ensure_ascii=False, indent=2)}\n\n"
        f"DRAFT:\n{json.dumps(draft, ensure_ascii=False, indent=2)}\n\n"
        "Evaluate:\n"
        "1. quality_score (0-100): Does it follow the brief? Is it engaging and well-structured?\n"
        "2. seo_score (0-100): Is the target keyword well-placed? Title and meta within limits?\n"
        "3. factual_risk: Are there any claims that could be hallucinated or hard to verify?\n"
        "4. duplicate_risk: Does the content feel generic or too similar to common articles?\n"
        "5. needs_human_review: Should a human editor review before publishing?\n"
        "6. review_notes: Explain your scores and flags in detail.\n"
        "7. suggested_edits: Up to 5 specific actionable improvements.\n"
    )

    result = provider.generate_structured(
        prompt=prompt,
        json_schema=REVIEW_SCHEMA,
        schema_name="EditorialReview",
        model=model,
        system=system,
        max_tokens=1024,
        temperature=0.0,
    )
    log.info(
        "Review done: quality=%s seo=%s needs_human=%s",
        result.get("quality_score"),
        result.get("seo_score"),
        result.get("needs_human_review"),
    )
    return result


# ── Agent 4 — LinkedIn ────────────────────────────────────────────────────────

def run_linkedin_agent(
    *,
    draft: dict[str, Any],
    brief: dict[str, Any],
    blog_url: str | None = None,
) -> dict[str, Any]:
    """Generate LinkedIn post variants to promote the published article."""
    provider, model = _get_provider()

    import json

    article_url = blog_url or "[lien vers l'article]"

    system = (
        "You are a LinkedIn content expert who writes high-engagement posts for B2B SaaS brands. "
        "Your posts start with a strong hook, use short paragraphs for readability, "
        "and end with a clear call-to-action. Write in French."
    )

    prompt = (
        "Create LinkedIn post variants to promote this article.\n\n"
        f"ARTICLE TITLE: {draft.get('title', '')}\n"
        f"EXCERPT: {draft.get('excerpt', '')}\n"
        f"TARGET KEYWORD: {brief.get('target_keyword', '')}\n"
        f"AUDIENCE: {brief.get('audience', '')}\n"
        f"ARTICLE URL: {article_url}\n\n"
        "Requirements:\n"
        "- Full post: ≤1300 chars, uses line breaks for readability, mentions the URL\n"
        "- Short variant: ≤280 chars for Twitter/X\n"
        "- Hook: opening sentence/question that stops the scroll\n"
        "- Hashtags: 3-6 relevant tags (return without the # symbol)\n"
        "- CTA: compelling last sentence encouraging clicks\n"
    )

    result = provider.generate_structured(
        prompt=prompt,
        json_schema=LINKEDIN_SCHEMA,
        schema_name="LinkedInVariants",
        model=model,
        system=system,
        max_tokens=1024,
        temperature=0.7,
    )
    log.info("LinkedIn variants generated, hook=%s…", result.get("hook", "")[:60])
    return result
