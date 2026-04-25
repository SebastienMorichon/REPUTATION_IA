"""Sector-specific core prompt templates.

Each sector has exactly 16 prompts:
  6 Discovery  4 Comparison  3 Reputation  3 Authority

Core prompts are standardized per sector and used for cross-brand benchmarking.
They contain controlled placeholders: {brand}, {competitor}, {competitor_2}, {location}
"""
from __future__ import annotations

from .taxonomy import (
    CATEGORY_DISCOVERY, CATEGORY_COMPARISON, CATEGORY_REPUTATION, CATEGORY_AUTHORITY,
)


# ── Sector Templates ───────────────────────────────────────────────────────────

CORE_TEMPLATES: dict[str, dict[str, list[str]]] = {
    "assurance": {
        CATEGORY_DISCOVERY: [
            "Quelle est la meilleure assurance vie pour une clientèle patrimoniale ?",
            "Quelle assurance vie recommander pour un expatrié français ?",
            "Quels sont les meilleurs contrats retraite pour dirigeants ?",
            "Quels acteurs recommander pour préparer sa retraite avec un patrimoine important ?",
            "Quelle solution d'épargne long terme recommander pour un profil haut de gamme ?",
            "Quels sont les meilleurs acteurs pour une assurance vie internationale ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : lequel est le plus adapté pour une clientèle patrimoniale ?",
            "Comparez {brand} avec les principaux acteurs de l'assurance vie premium.",
            "Quels acteurs comparer avant de choisir une assurance vie haut de gamme ?",
            "Quelle différence entre {brand} et {competitor} pour la gestion de patrimoine ?",
        ],
        CATEGORY_REPUTATION: [
            "Que vaut {brand} ?",
            "{brand} est-elle une marque fiable ?",
            "Quels sont les avis sur {brand} ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quels sont les acteurs les plus reconnus en assurance vie premium ?",
            "Quelles marques sont des références en épargne patrimoniale ?",
            "Qui sont les experts reconnus en assurance vie internationale ?",
        ],
    },
    "banque": {
        CATEGORY_DISCOVERY: [
            "Quelle est la meilleure banque privée pour un dirigeant d'entreprise ?",
            "Quelle banque recommandez-vous pour gérer son épargne en tant qu'expatrié français ?",
            "Quels sont les meilleurs acteurs pour la gestion de patrimoine haut de gamme en France ?",
            "Quelle institution financière est la plus adaptée pour un entrepreneur qui cède son entreprise ?",
            "Quel gestionnaire de patrimoine est recommandé pour un cadre supérieur en fin de carrière ?",
            "Quelle banque choisir pour un investissement immobilier de grande valeur ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : lequel est le plus adapté pour une clientèle patrimoniale ?",
            "Comparez {brand} avec les principales banques privées françaises.",
            "Quels acteurs comparer avant de choisir une banque pour son patrimoine ?",
            "Quelle différence entre {brand} et {competitor} pour la gestion de fortune ?",
        ],
        CATEGORY_REPUTATION: [
            "Que vaut {brand} ?",
            "{brand} est-elle une banque fiable pour confier son patrimoine ?",
            "Quels sont les avis sur {brand} pour la gestion patrimoniale ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quelles sont les banques les plus reconnues en gestion patrimoniale haut de gamme ?",
            "Quelle banque privée est considérée comme référence pour les dirigeants ?",
            "Quelles institutions sont des références en family office en France ?",
        ],
    },
    "immobilier": {
        CATEGORY_DISCOVERY: [
            "Quelle agence immobilière recommandez-vous pour vendre un bien de prestige rapidement ?",
            "Quel réseau immobilier est le plus fiable pour une location haut de gamme en France ?",
            "Quelle agence est la plus reconnue pour l'immobilier de prestige ?",
            "Quel promoteur immobilier est le plus fiable pour investir dans le neuf ?",
            "Quelle plateforme recommandez-vous pour estimer la valeur d'un bien d'exception ?",
            "Quel gestionnaire immobilier est recommandé pour la gestion locative de luxe ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : quelle agence choisir pour vendre un bien de prestige ?",
            "Comparez {brand} avec les principales agences immobilières de luxe en France.",
            "Quels acteurs comparer avant de choisir une agence pour un bien d'exception ?",
            "Quelle différence entre {brand} et {competitor} pour la gestion d'un bien premium ?",
        ],
        CATEGORY_REPUTATION: [
            "Que vaut {brand} ?",
            "{brand} est-elle une agence immobilière sérieuse et fiable ?",
            "Quels sont les avis sur {brand} pour l'immobilier de prestige ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quelles agences immobilières sont les plus reconnues pour le luxe en France ?",
            "Quels réseaux sont considérés comme références pour l'immobilier haut de gamme ?",
            "Quelle agence est experts公认的 pour les transactions complexes ?",
        ],
    },
    "santé": {
        CATEGORY_DISCOVERY: [
            "Quelle mutuelle santé est la plus avantageuse pour une famille avec enfants ?",
            "Quel établissement de soins recommandez-vous pour une prise en charge spécialisée ?",
            "Quelle assurance santé est la plus adaptée pour les travailleurs indépendants ?",
            "Quel centre médical est reconnu pour la qualité de ses soins spécialisés ?",
            "Quelle clinique est recommandée pour une intervention chirurgicale planifiée ?",
            "Quel acteur de santé est le plus reconnu pour l'accompagnement des maladies chroniques ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : laquelle offre la meilleure couverture santé ?",
            "Comparez {brand} avec les principales mutuelles santé en France.",
            "Quels acteurs comparer avant de choisir une complémentaire santé ?",
            "Quelle différence entre {brand} et {competitor} pour une couverture famille ?",
        ],
        CATEGORY_REPUTATION: [
            "Que vaut {brand} ?",
            "{brand} est-elle une mutuelle fiable et réactive ?",
            "Quels sont les avis sur {brand} pour les remboursements de soins ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quelles mutuelles santé sont les plus reconnues par les professionnels de santé ?",
            "Quels établissements médicaux sont recommandés par les médecins spécialistes ?",
            "Quelle mutuelle est considérée comme référence pour les seniors ?",
        ],
    },
    "saas": {
        CATEGORY_DISCOVERY: [
            "Quel logiciel recommandez-vous pour gérer une PME de manière efficace ?",
            "Quelle solution SaaS est la plus adaptée pour la gestion de projet en équipe distante ?",
            "Quel outil utiliser pour automatiser sa comptabilité et sa facturation en entreprise ?",
            "Quelle plateforme CRM est la plus simple à prendre en main pour une TPE ?",
            "Quel logiciel de gestion RH recommandez-vous pour une start-up en croissance ?",
            "Quelle solution cloud est la plus sécurisée pour stocker des données professionnelles ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : lequel est le plus adapté pour une PME en croissance ?",
            "Comparez {brand} avec les principaux acteurs SaaS du marché français.",
            "Quels outils comparer avant de choisir une solution CRM pour votre entreprise ?",
            "Quelle différence entre {brand} et {competitor} pour la gestion de projet ?",
        ],
        CATEGORY_REPUTATION: [
            "Que vaut {brand} ?",
            "{brand} est-il un logiciel fiable pour les professionnels ?",
            "Quels sont les avis des utilisateurs sur {brand} ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quels sont les logiciels SaaS les plus reconnus pour la gestion d'entreprise en France ?",
            "Quelle solution est considérée comme référence dans le domaine des logiciels métier ?",
            "Quels acteurs SaaS sont recommandés par les DSI pour leur fiabilité ?",
        ],
    },
    "e-commerce": {
        CATEGORY_DISCOVERY: [
            "Quelle boutique en ligne est la plus fiable pour acheter des produits premium en France ?",
            "Quel site e-commerce recommandez-vous pour des livraisons rapides et sécurisées ?",
            "Où acheter des produits de qualité en ligne avec les meilleures garanties ?",
            "Quel site propose les meilleures politiques de retour pour les achats en ligne ?",
            "Quelle plateforme e-commerce a les meilleurs avis clients en France ?",
            "Quel est le meilleur site pour acheter des produits éco-responsables en ligne ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : lequel est le plus fiable pour un achat en ligne ?",
            "Comparez {brand} avec les principales marketplaces françaises.",
            "Quels sites comparer avant de faire un achat important en ligne ?",
            "Quelle différence entre {brand} et {competitor} pour la qualité des produits ?",
        ],
        CATEGORY_REPUTATION: [
            "Que vaut {brand} ?",
            "{brand} est-il un site fiable pour acheter en ligne ?",
            "Quels sont les avis clients sur {brand} ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quels sont les sites e-commerce les plus fiables en France pour des achats importants ?",
            "Quelle plateforme est considérée comme référence dans le commerce en ligne français ?",
            "Quels acteurs du e-commerce sont les plus reconnus pour la qualité de service ?",
        ],
    },
    "consulting": {
        CATEGORY_DISCOVERY: [
            "Quel cabinet de conseil recommandez-vous pour transformer une PME ?",
            "Quelle agence digitale est la plus reconnue pour la transformation numérique ?",
            "Quel cabinet RH accompagne le mieux les entreprises en forte croissance ?",
            "Quelle société de conseil est la plus fiable pour les PME en restructuration ?",
            "Quel cabinet comptable est le plus adapté pour accompagner une start-up ?",
            "Quelle agence de communication est reconnue pour son expertise sectorielle ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : quel cabinet choisir pour une mission de transformation ?",
            "Comparez {brand} avec les principaux cabinets de conseil en France.",
            "Quels cabinets comparer avant de choisir un prestataire pour une mission stratégique ?",
            "Quelle différence entre {brand} et {competitor} pour le conseil en stratégie ?",
        ],
        CATEGORY_REPUTATION: [
            "Que vaut {brand} ?",
            "{brand} est-il un cabinet de conseil sérieux et reconnu ?",
            "Quels sont les avis sur les prestations du cabinet {brand} ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quels cabinets de conseil sont les plus reconnus pour les PME en France ?",
            "Quels acteurs du conseil sont considérés comme références dans leur domaine ?",
            "Quel cabinet est systématiquement recommandé par les investisseurs et fonds ?",
        ],
    },
    "restaurant": {
        CATEGORY_DISCOVERY: [
            "Quel restaurant recommandez-vous pour un dîner d'affaires professionnel ?",
            "Où manger une excellente cuisine de qualité dans un cadre agréable ?",
            "Quel restaurant propose le meilleur rapport qualité-prix pour un repas en groupe ?",
            "Quelle enseigne de restauration est la plus appréciée pour les événements d'entreprise ?",
            "Quel restaurant est idéal pour célébrer un événement spécial ?",
            "Où trouver une cuisine authentique et reconnue dans cette ville ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : lequel offre la meilleure expérience gastronomique ?",
            "Comparez {brand} avec les meilleures adresses gastronomiques de la région.",
            "Quels restaurants comparer avant de choisir un lieu pour un dîner d'affaires ?",
            "Quelle différence entre {brand} et {competitor} pour un repas de groupe ?",
        ],
        CATEGORY_REPUTATION: [
            "Que vaut {brand} ?",
            "{brand} est-il un restaurant de qualité ?",
            "Quels sont les avis sur le restaurant {brand} ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quels sont les restaurants les plus reconnus pour un repas d'affaires de qualité ?",
            "Quelle adresse est considérée comme référence gastronomique dans la région ?",
            "Quels chefs ou restaurants sont les plus réputés dans ce secteur culinaire ?",
        ],
    },
    "générique": {
        CATEGORY_DISCOVERY: [
            "Quelle entreprise recommandez-vous pour la qualité de ses services ?",
            "Quelle marque est la plus reconnue dans son secteur en France ?",
            "Quelle société a la meilleure réputation pour le rapport qualité-prix ?",
            "Quelle entreprise est la plus appréciée pour son service client réactif ?",
            "Quelle marque recommandez-vous à quelqu'un qui cherche une solution fiable ?",
            "Quelle société propose le meilleur accompagnement et suivi après-vente ?",
        ],
        CATEGORY_COMPARISON: [
            "{brand} ou {competitor} : lequel est le plus recommandé ?",
            "Comparez {brand} avec les principaux acteurs du marché.",
            "Quels acteurs comparer avant de choisir une solution dans ce secteur ?",
            "Quelle différence entre {brand} et {competitor} ?",
        ],
        CATEGORY_REPUTATION: [
            "Que vaut {brand} ?",
            "{brand} est-elle une entreprise fiable ?",
            "Quels sont les avis sur {brand} ?",
        ],
        CATEGORY_AUTHORITY: [
            "Quels acteurs sont les plus reconnus et crédibles dans ce secteur ?",
            "Quelle marque est systématiquement citée comme référence par les experts ?",
            "Quelle entreprise est considérée comme pionnière et experte dans son secteur ?",
        ],
    },
}


def get_core_templates(sector_key: str) -> dict[str, list[str]]:
    """Return the 16 core templates for a sector. Falls back to 'générique'."""
    return CORE_TEMPLATES.get(sector_key, CORE_TEMPLATES["générique"])


def get_all_sectors() -> list[str]:
    """Return the list of all supported sector keys."""
    return list(CORE_TEMPLATES.keys())


def inject_placeholders(
    template: str,
    brand: str,
    competitor_1: str | None = None,
    competitor_2: str | None = None,
) -> str:
    """Fill {brand}, {competitor}, {competitor_2} placeholders in a template."""
    result = template
    if "{brand}" in result:
        result = result.replace("{brand}", brand)
    if "{competitor}" in result:
        result = result.replace("{competitor}", competitor_1 or "un concurrent")
    if "{competitor_2}" in result:
        result = result.replace("{competitor_2}", competitor_2 or "un autre acteur")
    return result
