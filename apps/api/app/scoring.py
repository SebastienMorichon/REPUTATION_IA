"""Aggregate scoring computed over a set of PromptRun results for a brand."""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable

from app.models import Mention, PromptRun


_SENTIMENT_WEIGHT = {
    "positive": 1.0,
    "neutral": 0.5,
    "cautious": 0.25,
    "negative": 0.0,
}


@dataclass
class AggregateScores:
    visibility_score: float        # 0..100 — % of runs where brand appears
    share_of_voice: float          # 0..100 — brand mentions / all brand+competitor mentions
    sentiment_score: float         # 0..100 — weighted sentiment of target-brand mentions
    citation_score: float          # 0..100 — % of runs citing target-brand sources
    runs_count: int
    top_competitors: list[tuple[str, int]]


def compute_scores(runs: Iterable[PromptRun]) -> AggregateScores:
    runs = list(runs)
    total = len(runs)
    if total == 0:
        return AggregateScores(0.0, 0.0, 0.0, 0.0, 0, [])

    runs_with_brand = 0
    brand_sentiments: list[float] = []
    competitor_counter: Counter[str] = Counter()
    target_mentions_total = 0
    any_mentions_total = 0
    runs_with_target_citation = 0

    for run in runs:
        mentions: list[Mention] = list(run.mentions or [])
        has_target = any(m.is_target_brand for m in mentions)
        if has_target:
            runs_with_brand += 1

        for m in mentions:
            any_mentions_total += 1
            if m.is_target_brand:
                target_mentions_total += 1
                weight = _SENTIMENT_WEIGHT.get((m.sentiment or "neutral").lower(), 0.5)
                brand_sentiments.append(weight)
            elif m.is_known_competitor:
                competitor_counter[m.entity_name] += 1

        if any((c.refers_to_target for c in (run.citations or []))):
            runs_with_target_citation += 1

    visibility = 100.0 * runs_with_brand / total
    sov = 100.0 * target_mentions_total / any_mentions_total if any_mentions_total else 0.0
    sentiment = 100.0 * (sum(brand_sentiments) / len(brand_sentiments)) if brand_sentiments else 0.0
    citation = 100.0 * runs_with_target_citation / total

    return AggregateScores(
        visibility_score=round(visibility, 2),
        share_of_voice=round(sov, 2),
        sentiment_score=round(sentiment, 2),
        citation_score=round(citation, 2),
        runs_count=total,
        top_competitors=competitor_counter.most_common(10),
    )


def now_utc() -> datetime:
    return datetime.now(timezone.utc)
