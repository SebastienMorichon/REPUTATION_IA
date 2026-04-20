"""Rules-based recommendation engine.

Generates actionable recommendations from brand scores and run data.
Each recommendation has a priority (high/medium), a category, a description,
and a list of concrete actions with an action type tag.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from app.models import PromptRun
from app.scoring import AggregateScores


# ── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class RecommendationAction:
    text: str
    type: str  # "content" | "seo" | "pr" | "technical"


@dataclass
class Recommendation:
    priority: str          # "high" | "medium" | "low"
    category: str          # "visibility" | "position" | "sentiment" | "citation"
    icon: str
    title: str
    description: str
    actions: list[RecommendationAction] = field(default_factory=list)
    metric_value: Optional[float] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _avg_rank(runs: list[PromptRun]) -> Optional[float]:
    ranks = [
        m.rank_position
        for r in runs if r.status == "done"
        for m in (r.mentions or [])
        if m.is_target_brand and m.rank_position is not None
    ]
    return round(sum(ranks) / len(ranks), 1) if ranks else None


# ── Main function ─────────────────────────────────────────────────────────────

def generate_recommendations(
    scores: AggregateScores,
    runs: list[PromptRun],
    brand_name: str,
) -> list[Recommendation]:
    """Return an ordered list of recommendations (highest priority first)."""
    recs: list[Recommendation] = []

    vis  = scores.visibility_score
    sent = scores.sentiment_score
    cit  = scores.citation_score

    # ── 1. Visibility ─────────────────────────────────────────────────────────
    if vis < 30:
        recs.append(Recommendation(
            priority="high",
            category="visibility",
            icon="👁️",
            title=f"{brand_name} est quasi invisible dans les IA",
            description=(
                f"Les IA ne citent votre marque que dans {round(vis)} % des réponses liées à votre "
                f"secteur. En dessous de 30 %, votre marque est pratiquement absente de la mémoire "
                f"des intelligences artificielles."
            ),
            metric_value=vis,
            actions=[
                RecommendationAction(
                    "Créer des pages SEO ciblées sur les questions que vos clients posent aux IA",
                    "seo",
                ),
                RecommendationAction(
                    "Publier du contenu comparatif qui inclut explicitement votre marque",
                    "content",
                ),
                RecommendationAction(
                    "Vérifier et compléter votre fiche Google Business Profile",
                    "technical",
                ),
                RecommendationAction(
                    "Créer ou enrichir votre fiche Wikidata / Wikipedia",
                    "pr",
                ),
            ],
        ))
    elif vis < 60:
        recs.append(Recommendation(
            priority="medium",
            category="visibility",
            icon="👁️",
            title="Visibilité à renforcer",
            description=(
                f"Vous êtes cité dans {round(vis)} % des réponses. Bon début, mais vos concurrents "
                f"pourraient vous distancer si vous n'alimentez pas régulièrement votre présence en ligne."
            ),
            metric_value=vis,
            actions=[
                RecommendationAction(
                    "Identifier les questions où vous êtes absent et créer du contenu ciblé",
                    "content",
                ),
                RecommendationAction(
                    "Obtenir des mentions sur des sites à forte autorité dans votre secteur",
                    "pr",
                ),
            ],
        ))

    # ── 2. Position / Rank ────────────────────────────────────────────────────
    avg_rank = _avg_rank(runs)
    if avg_rank is not None and avg_rank > 3:
        recs.append(Recommendation(
            priority="high" if avg_rank > 5 else "medium",
            category="position",
            icon="📊",
            title=f"Position trop basse (rang moyen #{avg_rank})",
            description=(
                f"Quand vous êtes cité, vous apparaissez en moyenne à la {avg_rank}ᵉ position. "
                f"Les LLM favorisent massivement les marques citées en position #1 ou #2."
            ),
            metric_value=avg_rank,
            actions=[
                RecommendationAction(
                    "Structurer vos pages en format FAQ : questions/réponses explicites lisibles par les IA",
                    "content",
                ),
                RecommendationAction(
                    "Ajouter des données structurées schema.org (Organization, Product) sur vos pages",
                    "technical",
                ),
                RecommendationAction(
                    "Mentionner explicitement votre catégorie produit dans votre contenu web",
                    "seo",
                ),
                RecommendationAction(
                    "Obtenir des classements 'Top X solutions' qui vous placent en tête",
                    "pr",
                ),
            ],
        ))

    # ── 3. Sentiment ──────────────────────────────────────────────────────────
    if sent < 30:
        recs.append(Recommendation(
            priority="high",
            category="sentiment",
            icon="💬",
            title="Image perçue négative — action urgente",
            description=(
                f"Les IA formulent des réserves sur votre marque dans {round(100 - sent)} % des mentions. "
                f"Cela peut décourager directement des clients potentiels avant même qu'ils vous contactent."
            ),
            metric_value=sent,
            actions=[
                RecommendationAction(
                    "Identifier et corriger les informations inexactes circulant sur votre marque",
                    "content",
                ),
                RecommendationAction(
                    "Publier des études de cas et témoignages clients sur des sites tiers fiables",
                    "pr",
                ),
                RecommendationAction(
                    "Créer une page 'À propos' factuelle et bien référencée",
                    "content",
                ),
                RecommendationAction(
                    "Obtenir des avis vérifiés sur des plateformes à forte autorité (G2, Trustpilot…)",
                    "pr",
                ),
            ],
        ))
    elif sent < 60:
        recs.append(Recommendation(
            priority="medium",
            category="sentiment",
            icon="💬",
            title="Image perçue neutre — à transformer en atout",
            description=(
                f"Les IA présentent votre marque de façon neutre ({round(sent)} %). "
                f"Les leaders sectoriels affichent généralement des scores supérieurs à 70 %."
            ),
            metric_value=sent,
            actions=[
                RecommendationAction(
                    "Enrichir votre présence avec des preuves sociales (cas clients, récompenses, certifications)",
                    "pr",
                ),
                RecommendationAction(
                    "Créer du contenu mettant en avant vos points de différenciation uniques",
                    "content",
                ),
            ],
        ))

    # ── 4. Citation ───────────────────────────────────────────────────────────
    if cit < 20:
        recs.append(Recommendation(
            priority="high",
            category="citation",
            icon="🔗",
            title="Très peu de sources tierces vous mentionnent",
            description=(
                f"Seulement {round(cit)} % des réponses IA incluent une source qui vous cite. "
                f"Les LLM font davantage confiance aux marques soutenues par des sources tierces fiables."
            ),
            metric_value=cit,
            actions=[
                RecommendationAction(
                    "Publier des articles invités dans des médias spécialisés de votre secteur",
                    "pr",
                ),
                RecommendationAction(
                    "Être listé dans des annuaires professionnels reconnus",
                    "seo",
                ),
                RecommendationAction(
                    "Faire citer votre marque dans des comparatifs et guides de référence",
                    "pr",
                ),
                RecommendationAction(
                    "Viser des mentions sur Crunchbase, LinkedIn News et médias sectoriels",
                    "pr",
                ),
            ],
        ))
    elif cit < 50:
        recs.append(Recommendation(
            priority="medium",
            category="citation",
            icon="🔗",
            title="Couverture par les sources à développer",
            description=(
                f"Vous êtes cité dans {round(cit)} % des réponses avec source. "
                f"Augmenter ce score renforce votre crédibilité perçue par les IA."
            ),
            metric_value=cit,
            actions=[
                RecommendationAction(
                    "Identifier les domaines que les IA citent pour votre secteur et y obtenir des mentions",
                    "pr",
                ),
                RecommendationAction(
                    "Créer du contenu de référence (études, données, rapports) que d'autres voudront citer",
                    "content",
                ),
            ],
        ))

    # Sort: high first, then medium
    _order = {"high": 0, "medium": 1, "low": 2}
    recs.sort(key=lambda r: _order.get(r.priority, 3))

    return recs
