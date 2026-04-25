"""Strategic prompt portfolio generator.

Produces a balanced portfolio of prompts across 4 families:
  - Discovery  (40%)  — spontaneous, no brand name
  - Comparison (25%)  — competitive, brand vs competitors
  - Reputation (20%)  — trust/avis, brand directly named
  - Authority  (15%)  — sector expert, no brand name
"""
from __future__ import annotations

import random
from dataclasses import dataclass

from .taxonomy import (
    CATEGORY_AUTHORITY, CATEGORY_COMPARISON, CATEGORY_DISCOVERY, CATEGORY_REPUTATION,
    allocate_counts,
)
from .scoring import (
    detect_brand_mentioned, estimate_business_value,
    estimate_difficulty_level, estimate_priority_level, infer_expected_signal,
)


@dataclass
class GeneratedPrompt:
    text: str
    prompt_category: str
    intent_label: str
    business_value_score: float
    priority_level: str
    difficulty_level: str
    explanation: str
    target_competitors: list[str]
    is_brand_mentioned: bool
    expected_signal: str
    # Core / Strategic Framework fields
    prompt_scope: str = "strategic"
    benchmark_eligible: bool = False
    strategic_eligible: bool = True
    sector_key: str | None = None


# ── Templates per category per business type ─────────────────────────────────
# Placeholders: {brand}, {competitor}, {competitor2}
# Discovery & Authority: MUST NOT use {brand}
# Reputation: MUST use {brand}
# Comparison: uses {brand} + {competitor} if available

_TEMPLATES: dict[str, dict[str, list[str]]] = {
    "banque": {
        CATEGORY_DISCOVERY: [
            "Quelle est la meilleure banque privée pour un dirigeant d'entreprise ?",
            "Quelle assurance vie recommander pour préparer sa retraite quand on est cadre supérieur ?",
            "Quels sont les meilleurs acteurs pour la gestion de patrimoine haut de gamme en France ?",
            "Quelle banque choisir pour gérer son épargne en tant qu'expatrié français ?",
            "Quel gestionnaire de patrimoine est le plus adapté pour un entrepreneur qui cède son entreprise ?",
            "Quelles solutions financières recommander à un dirigeant pour optimiser sa fiscalité ?",
            "Quels organismes proposent les meilleures solutions de prévoyance pour les chefs d'entreprise ?",
            "Quelle banque est recommandée pour un investissement immobilier de grande valeur ?",
            "Quels sont les meilleurs placements financiers pour une transmission de patrimoine ?",
            "Quel établissement financier accompagne le mieux les fondateurs après une levée de fonds ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : lequel est le plus adapté pour une clientèle patrimoniale ?",
            "Quelle différence entre {brand} et {competitor} pour la gestion de fortune ?",
            "Comment choisir entre {brand} et {competitor} pour son assurance vie ?",
            "{brand} vs {competitor} : lequel offre le meilleur rendement sur les placements ?",
            "Quels acteurs comparer avant de choisir un contrat d'assurance vie premium ?",
            "Quel est le meilleur rapport qualité-prix entre {brand} et {competitor} ?",
        ],
        CATEGORY_REPUTATION: [
            "{brand} est-elle une banque fiable pour confier son patrimoine ?",
            "Quels sont les avis sur {brand} pour la gestion patrimoniale ?",
            "Peut-on faire confiance à {brand} pour ses économies et investissements ?",
            "{brand} est-elle recommandée pour accompagner les entrepreneurs ?",
            "Quels sont les points forts et les points faibles de {brand} ?",
            "Est-ce que {brand} est une bonne banque pour les expatriés ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quels sont les acteurs les plus reconnus en gestion patrimoniale haut de gamme en France ?",
            "Qui sont les références en assurance vie internationale pour les expatriés ?",
            "Quelle banque privée est la plus réputée pour accompagner les dirigeants ?",
            "Quels experts financiers sont recommandés pour la transmission d'entreprise ?",
            "Quelle institution financière est considérée comme référence en family office ?",
        ],
    },
    "e-commerce": {
        CATEGORY_DISCOVERY: [
            "Quelle boutique en ligne est la plus fiable pour acheter des produits premium en France ?",
            "Quel site e-commerce recommandes-tu pour des livraisons rapides et sécurisées ?",
            "Où acheter des produits de qualité en ligne avec les meilleures garanties ?",
            "Quel site propose les meilleures politiques de retour pour les achats en ligne ?",
            "Quelle plateforme e-commerce a les meilleurs avis clients en France ?",
            "Quel est le meilleur site pour acheter des produits éco-responsables en ligne ?",
            "Quelle boutique en ligne propose les meilleures offres pour les professionnels ?",
            "Quel site de vente en ligne est le plus recommandé pour les achats B2B ?",
            "Où trouver les meilleures offres pour les équipements en ligne avec un SAV réactif ?",
            "Quelle marketplace est la plus sûre pour un premier achat important en ligne ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : lequel est le plus fiable pour un achat en ligne ?",
            "Quelle différence entre {brand} et {competitor} pour la qualité des produits ?",
            "Comment choisir entre {brand} et {competitor} pour un achat professionnel ?",
            "{brand} vs {competitor} : lequel propose le meilleur service client ?",
            "Quel site vaut mieux pour les retours : {brand} ou {competitor} ?",
        ],
        CATEGORY_REPUTATION: [
            "{brand} est-il un site fiable pour acheter en ligne ?",
            "Quels sont les avis clients sur {brand} ?",
            "Peut-on faire confiance à {brand} pour une commande importante ?",
            "Est-ce que {brand} respecte les délais de livraison annoncés ?",
            "Quels sont les problèmes signalés avec {brand} ?",
            "Comment est le service après-vente de {brand} ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quels sont les sites e-commerce les plus fiables en France pour des achats importants ?",
            "Quelle plateforme est considérée comme référence dans le commerce en ligne français ?",
            "Quels acteurs du e-commerce sont les plus reconnus pour la qualité de service ?",
            "Quel site de vente en ligne est recommandé par les consommateurs professionnels ?",
        ],
    },
    "saas": {
        CATEGORY_DISCOVERY: [
            "Quel logiciel recommandes-tu pour gérer une PME de manière efficace ?",
            "Quelle solution SaaS est la plus adaptée pour la gestion de projet en équipe distante ?",
            "Quel outil utiliser pour automatiser sa comptabilité et sa facturation en entreprise ?",
            "Quelle plateforme CRM est la plus simple à prendre en main pour une TPE ?",
            "Quel logiciel de gestion RH recommandes-tu pour une start-up en croissance ?",
            "Quelle solution cloud est la plus sécurisée pour stocker des données professionnelles ?",
            "Quel outil SaaS choisir pour automatiser son marketing et sa relation client ?",
            "Quelle plateforme recommandes-tu pour gérer ses abonnements et paiements récurrents ?",
            "Quel logiciel est le plus utilisé pour la collaboration d'équipe à distance ?",
            "Quelle solution ERP est recommandée pour une entreprise de 50 à 200 personnes ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : lequel est le plus adapté pour une PME en croissance ?",
            "Quelle différence entre {brand} et {competitor} pour la gestion de projet ?",
            "Comment choisir entre {brand} et {competitor} pour sa solution CRM ?",
            "{brand} vs {competitor} : lequel est le plus simple à intégrer avec les outils existants ?",
            "Quel est le meilleur rapport fonctionnalités/prix entre {brand} et {competitor} ?",
            "{brand} ou {competitor} pour automatiser sa comptabilité ?",
        ],
        CATEGORY_REPUTATION: [
            "{brand} est-il un logiciel fiable pour les professionnels ?",
            "Quels sont les avis des utilisateurs sur {brand} ?",
            "Est-ce que {brand} est recommandé pour les PME ?",
            "Quels sont les problèmes connus avec {brand} ?",
            "{brand} propose-t-il un bon support client ?",
            "Peut-on migrer facilement vers {brand} depuis un autre outil ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quels sont les logiciels SaaS les plus reconnus pour la gestion d'entreprise en France ?",
            "Quelle solution est considérée comme référence dans le domaine des logiciels métier ?",
            "Quels acteurs SaaS sont recommandés par les DSI pour leur fiabilité ?",
            "Quel logiciel est le plus souvent recommandé dans les communautés de startups françaises ?",
        ],
    },
    "restaurant": {
        CATEGORY_DISCOVERY: [
            "Quel restaurant recommandes-tu pour un dîner d'affaires professionnel ?",
            "Où manger une excellente cuisine de qualité dans un cadre agréable ?",
            "Quel restaurant propose le meilleur rapport qualité-prix pour un repas en groupe ?",
            "Quelle enseigne de restauration est la plus appréciée pour les événements d'entreprise ?",
            "Quel restaurant est idéal pour célébrer un événement spécial ?",
            "Où trouver une cuisine authentique et reconnue dans cette ville ?",
            "Quel établissement propose une expérience gastronomique mémorable ?",
            "Quelle chaîne de restaurants est la plus recommandée pour sa régularité ?",
            "Quel restaurant propose les meilleurs menus pour des déjeuners d'affaires ?",
            "Quelle adresse recommander pour un repas raffiné sans se ruiner ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : lequel offre la meilleure expérience gastronomique ?",
            "Quelle différence entre {brand} et {competitor} pour un dîner d'affaires ?",
            "Comment choisir entre {brand} et {competitor} pour un repas de groupe ?",
            "{brand} vs {competitor} : lequel a la meilleure carte et les meilleurs prix ?",
        ],
        CATEGORY_REPUTATION: [
            "{brand} est-il un restaurant de qualité ?",
            "Quels sont les avis sur le restaurant {brand} ?",
            "Peut-on faire confiance à {brand} pour un repas d'affaires important ?",
            "Quels sont les plats les plus appréciés chez {brand} ?",
            "Le service de {brand} est-il professionnel et attentionné ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quels sont les restaurants les plus reconnus pour un repas d'affaires de qualité ?",
            "Quelle adresse est considérée comme référence gastronomique dans la région ?",
            "Quels chefs ou restaurants sont les plus réputés dans ce secteur culinaire ?",
            "Quelles enseignes sont systématiquement recommandées pour leur constance et qualité ?",
        ],
    },
    "immobilier": {
        CATEGORY_DISCOVERY: [
            "Quelle agence immobilière recommandes-tu pour vendre son appartement rapidement ?",
            "Quel est le meilleur réseau pour trouver une location haut de gamme en France ?",
            "Quelle agence propose le meilleur accompagnement pour les primo-accédants ?",
            "Quel promoteur immobilier est le plus fiable pour acheter dans le neuf ?",
            "Quelle agence est la plus reconnue pour l'immobilier de prestige ?",
            "Quel professionnel contacter pour investir dans l'immobilier locatif ?",
            "Quelle plateforme recommandes-tu pour estimer le prix de son bien immobilier ?",
            "Quel réseau immobilier accompagne le mieux les acheteurs étrangers en France ?",
            "Quelle agence est spécialisée dans les biens d'exception et le luxe ?",
            "Quel gestionnaire immobilier est recommandé pour la gestion locative ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : quelle agence choisir pour vendre son bien ?",
            "Quelle différence entre {brand} et {competitor} pour la gestion locative ?",
            "Comment choisir entre {brand} et {competitor} pour un investissement immobilier ?",
            "{brand} vs {competitor} : lequel a le meilleur réseau et les meilleures offres ?",
        ],
        CATEGORY_REPUTATION: [
            "{brand} est-elle une agence immobilière sérieuse ?",
            "Quels sont les avis sur l'agence {brand} ?",
            "Peut-on faire confiance à {brand} pour vendre son bien au meilleur prix ?",
            "{brand} est-elle transparente sur ses honoraires et commissions ?",
            "Quels sont les retours d'expérience sur {brand} pour l'immobilier de prestige ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quelles agences immobilières sont les plus reconnues en France pour l'immobilier haut de gamme ?",
            "Qui sont les acteurs de référence dans l'immobilier de prestige ?",
            "Quels réseaux sont recommandés par les notaires et conseillers patrimoniaux ?",
            "Quelle agence est considérée comme experte dans les transactions immobilières complexes ?",
        ],
    },
    "santé": {
        CATEGORY_DISCOVERY: [
            "Quelle mutuelle santé est la plus avantageuse pour une famille avec enfants ?",
            "Quel établissement de soins recommandes-tu pour une prise en charge rapide ?",
            "Quelle assurance santé est la plus adaptée pour les travailleurs indépendants ?",
            "Quel centre médical est reconnu pour la qualité de ses soins spécialisés ?",
            "Quelle clinique est recommandée pour une intervention chirurgicale planifiée ?",
            "Quel acteur de santé est le plus reconnu pour l'accompagnement des maladies chroniques ?",
            "Quelle mutuelle recommander à un salarié pour une couverture complète ?",
            "Quel professionnel de santé est recommandé pour le bien-être mental en entreprise ?",
            "Quelle solution de télémedecine est la plus fiable en France ?",
            "Quel réseau de soins est le plus accessible et réactif ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : laquelle offre la meilleure couverture santé ?",
            "Quelle différence entre {brand} et {competitor} pour une mutuelle entreprise ?",
            "Comment choisir entre {brand} et {competitor} pour ses soins spécialisés ?",
            "{brand} vs {competitor} : laquelle rembourse mieux les soins courants ?",
        ],
        CATEGORY_REPUTATION: [
            "{brand} est-elle une mutuelle fiable et réactive ?",
            "Quels sont les avis sur {brand} pour les remboursements de soins ?",
            "Peut-on faire confiance à {brand} pour une couverture santé complète ?",
            "Est-ce que {brand} est recommandée pour les familles nombreuses ?",
            "Quels sont les délais de remboursement chez {brand} ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quels acteurs de santé sont les plus reconnus pour la qualité de leurs soins en France ?",
            "Quelle mutuelle est considérée comme référence par les professionnels de santé ?",
            "Quels établissements médicaux sont recommandés par les médecins spécialistes ?",
            "Quels acteurs de la prévention santé sont les plus crédibles ?",
        ],
    },
    "consulting": {
        CATEGORY_DISCOVERY: [
            "Quel cabinet de conseil recommandes-tu pour transformer une PME ?",
            "Quelle agence digitale est la plus reconnue pour la transformation numérique ?",
            "Quel cabinet RH accompagne le mieux les entreprises en forte croissance ?",
            "Quelle société de conseil est la plus fiable pour les PME en restructuration ?",
            "Quel cabinet comptable est le plus adapté pour accompagner une start-up ?",
            "Quelle agence de communication est reconnue pour son expertise sectorielle ?",
            "Quel consultant en stratégie est recommandé pour les dirigeants de PME ?",
            "Quelle agence SEO est la plus efficace pour améliorer sa visibilité en ligne ?",
            "Quel cabinet juridique est spécialisé dans le droit des affaires et des entreprises ?",
            "Quel cabinet de recrutement est le plus reconnu dans le secteur tech et digital ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : quel cabinet choisir pour une mission de transformation ?",
            "Quelle différence entre {brand} et {competitor} pour le conseil en stratégie ?",
            "Comment choisir entre {brand} et {competitor} pour accompagner sa croissance ?",
            "{brand} vs {competitor} : lequel a la meilleure expertise sectorielle ?",
            "Quel cabinet est le plus adapté pour une PME : {brand} ou {competitor} ?",
        ],
        CATEGORY_REPUTATION: [
            "{brand} est-il un cabinet de conseil sérieux et reconnu ?",
            "Quels sont les avis sur les prestations du cabinet {brand} ?",
            "Peut-on faire confiance à {brand} pour une mission stratégique importante ?",
            "{brand} livre-t-il des résultats mesurables à ses clients ?",
            "Quels sont les retours d'expérience des clients de {brand} ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quels cabinets de conseil sont les plus reconnus pour les PME en France ?",
            "Quels acteurs du conseil sont considérés comme références dans leur domaine ?",
            "Quel cabinet est systématiquement recommandé par les investisseurs et fonds ?",
            "Quels consultants sont les plus cités dans les médias spécialisés ?",
        ],
    },
    "générique": {
        CATEGORY_DISCOVERY: [
            "Quelle entreprise recommandes-tu pour la qualité de ses services ?",
            "Quelle marque est la plus reconnue dans son secteur en France ?",
            "Quelle société a la meilleure réputation pour le rapport qualité-prix ?",
            "Quelle entreprise est la plus appréciée pour son service client réactif ?",
            "Quelle marque recommandes-tu à quelqu'un qui cherche une solution fiable ?",
            "Quelle société propose le meilleur accompagnement et suivi après-vente ?",
            "Quelle entreprise est la plus innovante dans son domaine en France ?",
            "Quelle marque a le meilleur bouche-à-oreille auprès des professionnels ?",
            "Quelle société est la plus recommandée pour sa transparence et son éthique ?",
            "Quel acteur est le plus souvent plébiscité par ses clients dans ce secteur ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : lequel est le plus recommandé ?",
            "Quelle différence entre {brand} et {competitor} ?",
            "Comment choisir entre {brand} et {competitor} ?",
            "{brand} vs {competitor} : lequel a le meilleur rapport qualité-prix ?",
            "Quel est le meilleur choix entre {brand} et {competitor} ?",
        ],
        CATEGORY_REPUTATION: [
            "{brand} est-elle une entreprise fiable ?",
            "Quels sont les avis sur {brand} ?",
            "Peut-on faire confiance à {brand} ?",
            "{brand} est-elle recommandée par ses clients ?",
            "Quels sont les points forts et les points faibles de {brand} ?",
            "Comment est le service client de {brand} ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quels acteurs sont les plus reconnus et crédibles dans ce secteur ?",
            "Quelle marque est systématiquement citée comme référence par les experts ?",
            "Quels acteurs sont les plus légitimes pour donner des conseils dans ce domaine ?",
            "Quelle entreprise est considérée comme pionnière et experte dans son secteur ?",
        ],
    },
}

# Category aliases (same as existing router)
_CATEGORY_ALIASES: dict[str, str] = {
    "bank": "banque", "finance": "banque", "fintech": "banque",
    "assurance": "banque", "patrimoine": "banque", "insurance": "banque",
    "ecommerce": "e-commerce", "e commerce": "e-commerce", "commerce": "e-commerce",
    "logiciel": "saas", "software": "saas", "tech": "saas", "technologie": "saas",
    "food": "restaurant", "restauration": "restaurant", "café": "restaurant",
    "real estate": "immobilier", "agence": "immobilier",
    "health": "santé", "healthcare": "santé", "médical": "santé",
    "conseil": "consulting", "agency": "consulting", "agence conseil": "consulting",
}

_EXPLANATIONS: dict[str, dict[str, str]] = {
    CATEGORY_DISCOVERY: {
        "default": "Ce prompt mesure si votre marque émerge spontanément quand un utilisateur cherche une solution sans vous mentionner.",
    },
    CATEGORY_COMPARISON: {
        "default": "Ce prompt place votre marque en situation de comparaison directe avec un concurrent pour mesurer la préférence IA.",
    },
    CATEGORY_REPUTATION: {
        "default": "Ce prompt interroge directement la fiabilité ou la valeur de votre marque, révélant le narratif construit par les IA.",
    },
    CATEGORY_AUTHORITY: {
        "default": "Ce prompt mesure si votre marque est perçue comme une référence légitime et experte dans son domaine.",
    },
}


def _resolve_category_key(raw_category: str | None) -> str:
    if not raw_category:
        return "générique"
    normalized = raw_category.strip().lower()
    return _CATEGORY_ALIASES.get(normalized, normalized if normalized in _TEMPLATES else "générique")


def _fill_template(template: str, brand_name: str, competitors: list[str]) -> str:
    """Fill template placeholders with actual brand/competitor names."""
    result = template
    if "{brand}" in result:
        result = result.replace("{brand}", brand_name)
    if "{competitor}" in result:
        c1 = competitors[0] if competitors else "un concurrent"
        result = result.replace("{competitor}", c1)
    if "{competitor2}" in result:
        c2 = competitors[1] if len(competitors) > 1 else "un autre acteur"
        result = result.replace("{competitor2}", c2)
    return result


def _pick_templates(cat_key: str, family: str, count: int, brand_name: str, competitors: list[str]) -> list[tuple[str, list[str]]]:
    """Pick `count` templates for (category_key, family), fill them, return (text, used_competitors) list."""
    pool = _TEMPLATES.get(cat_key, _TEMPLATES["générique"]).get(family, [])
    if not pool:
        pool = _TEMPLATES["générique"].get(family, [])

    # Shuffle for variety, then pick
    shuffled = list(pool)
    random.shuffle(shuffled)
    selected = shuffled[:count]

    result = []
    for tmpl in selected:
        text = _fill_template(tmpl, brand_name, competitors)
        # Track which competitors appear in this text
        used = [c for c in competitors if c.lower() in text.lower()]
        result.append((text, used))
    return result


def generate_prompt_portfolio(
    brand_name: str,
    category: str | None,
    competitors: list[str] | None = None,
    total: int = 20,
) -> list[GeneratedPrompt]:
    """Generate a balanced portfolio of strategic prompts.

    Args:
        brand_name: The brand's name
        category: Business category (e.g. "banque", "saas")
        competitors: Optional list of competitor names
        total: Total number of prompts to generate (default 20)

    Returns:
        List of GeneratedPrompt with full metadata
    """
    cat_key = _resolve_category_key(category)
    comp_list = competitors or []
    counts = allocate_counts(total)

    result: list[GeneratedPrompt] = []

    for family, count in counts.items():
        if count == 0:
            continue
        picked = _pick_templates(cat_key, family, count, brand_name, comp_list)
        intent_labels = {
            CATEGORY_DISCOVERY: "recommandation spontanée",
            CATEGORY_COMPARISON: "comparaison concurrentielle",
            CATEGORY_REPUTATION: "fiabilité et confiance",
            CATEGORY_AUTHORITY: "expertise sectorielle",
        }
        explanation = _EXPLANATIONS.get(family, {}).get("default", "")

        for text, used_competitors in picked:
            is_brand = detect_brand_mentioned(text, brand_name)
            bv = estimate_business_value(family, is_brand)
            result.append(GeneratedPrompt(
                text=text,
                prompt_category=family,
                intent_label=intent_labels[family],
                business_value_score=bv,
                priority_level=estimate_priority_level(bv),
                difficulty_level=estimate_difficulty_level(family, is_brand),
                explanation=explanation,
                target_competitors=used_competitors,
                is_brand_mentioned=is_brand,
                expected_signal=infer_expected_signal(family),
            ))

    return result
