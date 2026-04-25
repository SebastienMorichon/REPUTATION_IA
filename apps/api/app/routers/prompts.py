import logging
from html.parser import HTMLParser
from typing import Any
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import brand_for_user, current_user
from app.models import Brand, Prompt, User
from app.schemas import PromptCreate, PromptRead, PromptUpdate
from app.prompt_strategy.generator import generate_prompt_portfolio
from app.prompt_strategy.portfolio import build_prompt_portfolio
from app.prompt_strategy.scoring import (
    detect_brand_mentioned,
    estimate_business_value,
    estimate_priority_level,
    estimate_difficulty_level,
    infer_expected_signal,
    migrate_category,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/brands/{brand_id}/prompts", tags=["prompts"])


# ── Website scraper ───────────────────────────────────────────────────────────

class _WebExtractor(HTMLParser):
    """Lightweight HTML → structured text extractor (stdlib only)."""
    _SKIP = {"script", "style", "noscript", "svg", "iframe"}
    _HEADINGS = {"h1", "h2", "h3"}
    _BLOCK = {"p", "li", "td", "dd", "blockquote", "article", "section"}

    def __init__(self) -> None:
        super().__init__()
        self._skip_depth = 0
        self._in_heading = False
        self._in_title = False
        self.title: str = ""
        self.meta_desc: str = ""
        self.headings: list[str] = []
        self.body: list[str] = []

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag in self._SKIP:
            self._skip_depth += 1
        elif tag in self._HEADINGS:
            self._in_heading = True
        elif tag == "title":
            self._in_title = True
        elif tag == "meta":
            d = dict(attrs)
            if d.get("name", "").lower() == "description":
                self.meta_desc = d.get("content", "")

    def handle_endtag(self, tag: str) -> None:
        if tag in self._SKIP and self._skip_depth > 0:
            self._skip_depth -= 1
        elif tag in self._HEADINGS:
            self._in_heading = False
        elif tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._skip_depth > 0:
            return
        text = " ".join(data.split())
        if not text:
            return
        if self._in_title:
            self.title = text
        elif self._in_heading and len(text) > 3:
            self.headings.append(text)
        elif len(text) > 40:  # skip nav labels, button text, etc.
            self.body.append(text)

    def summary(self) -> str:
        parts: list[str] = []
        if self.title:
            parts.append(f"Titre : {self.title}")
        if self.meta_desc:
            parts.append(f"Description : {self.meta_desc}")
        if self.headings:
            parts.append("Rubriques : " + " | ".join(self.headings[:12]))
        if self.body:
            parts.append("Contenu : " + " ".join(self.body[:30]))
        return "\n".join(parts)


def _fetch_website(domain: str) -> str:
    """Return a text summary of the website (max ~3 000 chars). Empty string on failure."""
    url = domain if domain.startswith("http") else f"https://{domain}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; AI-ReputationShield/1.0; "
            "+https://reputation-ai.app)"
        )
    }
    for target in [url, url.replace("https://", "http://", 1)]:
        try:
            r = httpx.get(target, timeout=8, follow_redirects=True, headers=headers)
            r.raise_for_status()
            parser = _WebExtractor()
            parser.feed(r.text[:80_000])   # cap HTML size before parsing
            return parser.summary()[:3_500]
        except Exception as exc:
            logger.debug("Website fetch failed for %s: %s", target, exc)
    return ""


# ── LLM question generator ────────────────────────────────────────────────────

_QUESTIONS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["questions"],
    "properties": {
        "questions": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Liste de questions en français posées par des utilisateurs à une IA",
        }
    },
}

_QUESTIONS_SYSTEM = (
    "Tu es un expert en référencement IA (AEO / GEO — Answer Engine Optimization / Generative Engine Optimization). "
    "Tu génères des questions réalistes que des clients potentiels posent à ChatGPT, Claude ou Perplexity "
    "pour DÉCOUVRIR une entreprise locale ou régionale, ou obtenir une RECOMMANDATION précise. "
    "Tes questions sont géolocalisées, spécifiques aux services proposés, et conçues pour faire émerger "
    "une entreprise particulière dans les réponses IA — pas les leaders nationaux génériques."
)


def _localize_questions(questions: list[str], location: str) -> list[str]:
    """Post-processing safety net: replace generic geo-phrases with the actual location.

    Runs after LLM generation. Handles cases where the model ignored the location
    constraint and used vague phrases instead of the city/region name.
    """
    loc_lower = location.lower()
    # Ordered by specificity — longer phrases first to avoid partial replacements
    replacements = [
        ("dans la région de ma ville", f"dans la région de {location}"),
        ("dans la région autour de moi", f"dans la région de {location}"),
        ("dans ma région", f"en région {location}"),
        ("dans votre région", f"en région {location}"),
        ("dans mon secteur géographique", f"à {location}"),
        ("dans mon secteur", f"à {location}"),
        ("dans ma ville", f"à {location}"),
        ("dans votre ville", f"à {location}"),
        ("près de chez moi", f"à {location}"),
        ("près de chez vous", f"à {location}"),
        ("en France", f"à {location}"),
        ("localement", f"à {location}"),
        ("dans ma zone", f"à {location}"),
    ]
    result = []
    for q in questions:
        if loc_lower in q.lower():
            result.append(q)  # already mentions the location — keep as-is
            continue
        q_new = q
        for old, new in replacements:
            if old in q_new:
                q_new = q_new.replace(old, new)
                break  # one replacement per question is enough
        result.append(q_new)
    return result


def _llm_generate_questions(brand: Brand, website_summary: str, location: str = "") -> list[str]:
    """Call the LLM to generate specific reputation/discovery questions from website content.

    Questions are designed to surface THIS specific business in AI answers,
    not national market leaders. If a location is given, questions are geographically
    anchored so a regional business has a real chance of appearing.
    """
    from app.config import get_settings
    from app.providers import get_provider, list_enabled_providers

    enabled = list_enabled_providers()
    if not enabled:
        return []

    settings = get_settings()
    # Use analyzer provider if available, otherwise first enabled
    try:
        provider = get_provider(settings.analyzer_provider)
    except Exception:
        provider = get_provider(enabled[0].name)

    competitors_hint = ""
    if hasattr(brand, "competitors") and brand.competitors:
        names = [c.name for c in list(brand.competitors)[:5]]
        competitors_hint = f"\nConcurrents connus : {', '.join(names)}"

    # Build the geographic block — made very prominent when a location is provided
    if location:
        geo_block = (
            f"\n"
            f"========================================\n"
            f"CONTRAINTE GÉOGRAPHIQUE — PRIORITÉ MAXIMALE\n"
            f"========================================\n"
            f"La localisation fournie est : « {location} »\n"
            f"\n"
            f"RÈGLE ABSOLUE : au moins 7 questions sur 10 DOIVENT contenir le mot « {location} »\n"
            f"écrit en toutes lettres dans le corps de la question.\n"
            f"\n"
            f"Formes acceptées : « à {location} », « en {location} »,\n"
            f"« dans la région de {location} », « près de {location} »,\n"
            f"« autour de {location} », « {location} et ses environs ».\n"
            f"\n"
            f"INTERDIT : « dans ma région », « dans ma ville », « en France »,\n"
            f"« localement », « près de chez moi » — ces formulations sont REFUSÉES.\n"
            f"Écris toujours « {location} » en toutes lettres.\n"
            f"\n"
            f"Exemples de bonnes questions pour ce type d'entreprise :\n"
            f"  ✓ « Quelle épicerie fine à {location} livre des colis cadeaux pour entreprises ? »\n"
            f"  ✓ « Où commander des paniers gourmands à {location} pour offrir à mes clients ? »\n"
            f"  ✓ « Qui propose des coffrets gastronomiques personnalisés dans la région de {location} ? »\n"
            f"========================================\n"
            f"\n"
        )
        loc_vary = f"à {location}"
    else:
        geo_block = (
            "\nLocalisation : non précisée — si le site suggère une implantation locale, "
            "ancre les questions géographiquement plutôt que nationalement.\n\n"
        )
        loc_vary = "dans la ville ou région de l'entreprise"

    prompt = (
        f"Voici une entreprise à surveiller dans les IA :\n"
        f"Nom : {brand.name}\n"
        f"Secteur/catégorie : {brand.category or 'non précisé'}\n"
        f"Domaine web : {brand.domain or 'non précisé'}"
        f"{competitors_hint}\n"
        f"{geo_block}"
        f"Contenu extrait du site web :\n{website_summary}\n\n"
        f"---\n"
        f"MISSION : Génère exactement 10 questions que des clients potentiels poseraient à ChatGPT, Claude "
        f"ou Perplexity pour DÉCOUVRIR ou obtenir une RECOMMANDATION vers une entreprise comme « {brand.name} ».\n\n"
        f"RÈGLES :\n"
        f"1. Ne mentionne JAMAIS le nom « {brand.name} » dans les questions\n"
        f"2. Sois SPÉCIFIQUE aux produits/services réels identifiés sur le site\n"
        f"3. Les questions doivent être assez précises pour que cette entreprise soit une BONNE réponse\n"
        f"4. Varie les angles (découverte, recommandation, occasion, réputation, comparaison, cadeau)\n"
        f"5. Écris EN FRANÇAIS naturel, comme un vrai utilisateur qui parle à une IA\n"
    )

    try:
        result = provider.generate_structured(
            prompt=prompt,
            json_schema=_QUESTIONS_SCHEMA,
            schema_name="PromptQuestions",
            system=_QUESTIONS_SYSTEM,
            max_tokens=900,
            temperature=0.5,
        )
        questions = result.get("questions", [])
        questions = [q for q in questions if isinstance(q, str) and len(q) > 10][:12]
        if location:
            questions = _localize_questions(questions, location)
        return questions
    except Exception as exc:
        logger.warning("LLM question generation failed: %s", exc)
        return []

# ---------------------------------------------------------------------------
# Generic prompt templates per business category (plain French)
# ---------------------------------------------------------------------------
_TEMPLATES: dict[str, list[str]] = {
    "banque": [
        "Quelle est la meilleure banque pour un crédit immobilier en France ?",
        "Quelle banque recommandes-tu pour un entrepreneur qui crée son entreprise ?",
        "Quelles sont les banques les plus sûres pour placer son épargne ?",
        "Quelle banque propose les meilleures conditions pour un prêt professionnel ?",
        "Quelles sont les banques en ligne les plus fiables en 2024 ?",
        "Quelle banque choisir pour gérer mon patrimoine ?",
        "Quelle est la meilleure banque pour les jeunes actifs ?",
        "Quelle banque offre les frais les plus bas pour les transactions internationales ?",
        "Quel est le meilleur établissement pour ouvrir un compte professionnel ?",
        "Quelle banque a le meilleur service client en France ?",
    ],
    "e-commerce": [
        "Quelle boutique en ligne est la plus fiable pour acheter de l'électronique ?",
        "Quel site e-commerce recommandes-tu pour des livraisons rapides en France ?",
        "Où acheter des vêtements de qualité en ligne à prix raisonnable ?",
        "Quel site propose les meilleures garanties pour les retours produits ?",
        "Quelle plateforme e-commerce a les meilleurs avis clients ?",
        "Quel est le meilleur site pour acheter des produits bio en ligne ?",
        "Quelle boutique en ligne propose les meilleures offres promotionnelles ?",
        "Quel site e-commerce est le plus recommandé pour les achats B2B ?",
        "Où trouver les meilleurs prix pour les équipements informatiques en ligne ?",
        "Quel site de vente en ligne est le plus engagé pour l'environnement ?",
    ],
    "saas": [
        "Quel logiciel recommandes-tu pour gérer une PME ?",
        "Quelle solution SaaS est la plus adaptée pour la gestion de projet en équipe ?",
        "Quel outil utiliser pour automatiser sa comptabilité en entreprise ?",
        "Quelle plateforme CRM est la plus simple pour une TPE ?",
        "Quel logiciel de facturation est le plus populaire en France ?",
        "Quelle solution RH recommandes-tu pour une start-up de 20 personnes ?",
        "Quel outil SaaS choisir pour le marketing par email ?",
        "Quelle plateforme utiliser pour créer un site web professionnel sans coder ?",
        "Quel logiciel de visioconférence est le plus fiable pour les entreprises ?",
        "Quelle solution de stockage cloud est la plus sécurisée pour les professionnels ?",
    ],
    "restaurant": [
        "Quel restaurant recommandes-tu pour un dîner d'affaires à Paris ?",
        "Où manger une bonne cuisine traditionnelle française en région ?",
        "Quel restaurant propose le meilleur rapport qualité-prix dans ma ville ?",
        "Quelle chaîne de restauration rapide est la plus saine ?",
        "Quel restaurant est idéal pour un repas de famille avec des enfants ?",
        "Où trouver les meilleures pizzas artisanales en France ?",
        "Quel restaurant végétalien est le plus apprécié en France ?",
        "Quelle enseigne de restauration propose les meilleurs plats à emporter ?",
        "Quel restaurant a la meilleure ambiance pour un repas romantique ?",
        "Quelle chaîne de boulangeries est la plus recommandée en France ?",
    ],
    "immobilier": [
        "Quelle agence immobilière recommandes-tu pour vendre son appartement ?",
        "Quel est le meilleur site pour trouver une location à Paris ?",
        "Quelle agence immobilière propose le meilleur accompagnement pour les primo-accédants ?",
        "Quel promoteur immobilier est le plus fiable pour acheter dans le neuf ?",
        "Quelle plateforme utiliser pour estimer le prix de son bien immobilier ?",
        "Quelle agence immobilière est la plus reconnue pour l'immobilier de prestige ?",
        "Quel site recommandes-tu pour investir dans l'immobilier locatif ?",
        "Quelle agence propose les meilleures garanties lors d'une transaction immobilière ?",
        "Quelle franchise immobilière a le réseau le plus étendu en France ?",
        "Quel professionnel contacter pour gérer la location de mon bien immobilier ?",
    ],
    "santé": [
        "Quelle mutuelle santé est la plus avantageuse pour une famille ?",
        "Quel établissement de soins recommandes-tu pour une opération en France ?",
        "Quelle application de santé est la plus utilisée en France ?",
        "Quel laboratoire d'analyses médicales est le plus fiable ?",
        "Quelle clinique est reconnue pour la chirurgie esthétique en France ?",
        "Quelle assurance santé choisir pour les indépendants et freelances ?",
        "Quel professionnel de santé est recommandé pour le bien-être mental ?",
        "Quelle pharmacie en ligne est la plus sûre pour commander des médicaments ?",
        "Quel centre médical est spécialisé dans la médecine du sport ?",
        "Quelle marque de compléments alimentaires est la plus recommandée ?",
    ],
    "consulting": [
        "Quel cabinet de conseil recommandes-tu pour transformer une PME ?",
        "Quelle agence de communication est la plus reconnue en France ?",
        "Quel cabinet RH accompagne le mieux les entreprises en croissance ?",
        "Quelle société de conseil en informatique est la plus fiable pour les PME ?",
        "Quel cabinet comptable est le plus adapté pour une start-up ?",
        "Quelle agence digitale recommandes-tu pour refaire son site web ?",
        "Quel consultant en stratégie est le plus reconnu pour les PME françaises ?",
        "Quelle agence SEO est la plus efficace pour améliorer son référencement ?",
        "Quel cabinet juridique est spécialisé dans le droit des entreprises ?",
        "Quelle agence de recrutement est la plus reconnue dans le secteur tech ?",
    ],
    "générique": [
        "Quelle marque est la plus reconnue dans son secteur en France ?",
        "Quelle entreprise recommandes-tu pour la qualité de son service client ?",
        "Quelle société a la meilleure réputation pour le rapport qualité-prix ?",
        "Quelle marque est la plus citée dans les recommandations en ligne ?",
        "Quelle entreprise est la plus appréciée pour ses valeurs éthiques ?",
        "Quelle marque recommandes-tu à quelqu'un qui cherche une solution fiable ?",
        "Quelle société propose le meilleur accompagnement après-vente ?",
        "Quelle entreprise est la plus innovante dans son domaine en France ?",
        "Quelle marque a le meilleur bouche-à-oreille auprès des professionnels ?",
        "Quelle société est la plus recommandée par les experts du secteur ?",
    ],
}

# Alias mapping for common category names the user might set on a brand
_CATEGORY_ALIASES: dict[str, str] = {
    "bank": "banque", "finance": "banque", "fintech": "banque",
    "ecommerce": "e-commerce", "e commerce": "e-commerce", "commerce": "e-commerce",
    "logiciel": "saas", "software": "saas", "tech": "saas", "technologie": "saas",
    "food": "restaurant", "restauration": "restaurant", "café": "restaurant",
    "real estate": "immobilier", "agence": "immobilier",
    "health": "santé", "healthcare": "santé", "médical": "santé",
    "conseil": "consulting", "agency": "consulting", "agence conseil": "consulting",
    "assurance": "assurance", "insurance": "assurance",
}

# All supported sector keys (matches core_templates.py)
_ALL_SECTOR_KEYS = (
    "assurance", "banque", "immobilier", "santé",
    "saas", "e-commerce", "consulting", "restaurant", "générique",
)


def _resolve_sector_key(category: str | None) -> str:
    """Map a brand category to a sector key for core template selection."""
    if not category:
        return "générique"
    normalized = category.strip().lower()
    if normalized in _CATEGORY_ALIASES:
        return _CATEGORY_ALIASES[normalized]
    if normalized in _ALL_SECTOR_KEYS:
        return normalized
    # Fallback: try normalized version of the raw category
    return "générique"


# ── Framework explanation endpoint ───────────────────────────────────────────

_FRANCESCORE_PROMPT_FRAMEWORK = {
    "scopes": [
        {
            "key": "core",
            "title": "Core (Benchmark)",
            "description": "Questions standardisées, identiques pour toutes les entreprises d'un même secteur. Elles servent au benchmark et au score comparable.",
            "tooltip": "Les Core Prompts sont identiques pour toutes les marques d'un même secteur. Ils permettent de construire un benchmark fiable.",
            "default_count": 16,
            "benchmark_eligible_default": True,
            "strategic_eligible_default": False,
        },
        {
            "key": "strategic",
            "title": "Strategic (Opportunités)",
            "description": "Questions personnalisées selon la marque, ses offres et ses enjeux business. Elles servent à identifier les opportunités actionnables.",
            "tooltip": "Les Strategic Prompts sont personnalisés pour votre marque. Ils servent à identifier les opportunités business, mais ne doivent pas être utilisés pour comparer deux entreprises.",
            "default_count": 8,
            "benchmark_eligible_default": False,
            "strategic_eligible_default": True,
        },
    ],
    "categories": [
        {
            "key": "discovery",
            "title": "Discovery",
            "description": "Recommandation spontanée",
            "tooltip": "Mesure si votre marque apparaît spontanément quand un utilisateur cherche une solution, sans citer votre nom.",
            "expected_signal": "spontaneous_recommendation",
        },
        {
            "key": "comparison",
            "title": "Comparison",
            "description": "Comparaison concurrentielle",
            "tooltip": "Mesure si votre marque est préférée lorsqu'elle est comparée à d'autres acteurs.",
            "expected_signal": "competitive_preference",
        },
        {
            "key": "reputation",
            "title": "Reputation",
            "description": "Fiabilité et confiance",
            "tooltip": "Mesure ce que les IA disent explicitement de votre marque : confiance, avis, perception ou risques.",
            "expected_signal": "trust_assessment",
        },
        {
            "key": "authority",
            "title": "Authority",
            "description": "Expertise sectorielle",
            "tooltip": "Mesure si votre marque est reconnue comme une référence crédible dans son domaine.",
            "expected_signal": "authority_recognition",
        },
    ],
    "sectors": list(_ALL_SECTOR_KEYS),
    "scoring": {
        "benchmark": "Score calculé sur les prompts Core uniquement. Mesure la position de référence de votre marque.",
        "opportunity": "Score calculé sur les prompts Strategic uniquement. Mesure le potentiel d'amélioration.",
        "global": "Combinaison 70% Benchmark + 30% Opportunity. Score global du portfolio.",
    },
    "ratios": {
        "core": {"discovery": 6, "comparison": 4, "reputation": 3, "authority": 3},
        "strategic": {"discovery": 3, "comparison": 2, "reputation": 2, "authority": 1},
        "total": {"discovery": 9, "comparison": 6, "reputation": 5, "authority": 4},
    },
}


@router.get("/prompt-framework", response_model=dict)
def get_prompt_framework() -> dict:
    """Return the full prompt framework explanation for UI display."""
    return _FRANCESCORE_PROMPT_FRAMEWORK


@router.get("", response_model=list[PromptRead])
def list_prompts(
    brand_id: UUID,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[Prompt]:
    brand = brand_for_user(brand_id, user, db)
    return list(brand.prompts)


@router.post("", response_model=PromptRead, status_code=status.HTTP_201_CREATED)
def create_prompt(
    brand_id: UUID,
    body: PromptCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Prompt:
    brand = brand_for_user(brand_id, user, db)
    prompt = Prompt(brand_id=brand.id, **body.model_dump())
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    return prompt


@router.post("/generate", response_model=list[PromptRead], status_code=status.HTTP_201_CREATED)
def generate_prompts(
    brand_id: UUID,
    location: str = "",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[Prompt]:
    """Generate monitoring prompts.

    Optional query param:
    - ``location`` — city or region to embed in generated questions (e.g. "Lyon", "Bretagne").
      Makes questions geographically specific so a regional business can appear in AI answers.

    Strategy (in order of preference):
    1. If the brand has a domain → scrape the website and use the LLM to generate
       questions that are specific to the company's actual offering.
    2. Fallback → pick from the hardcoded generic templates for the brand's category.

    In both cases, prompts that already exist (exact text match) are skipped.

    NOTE: This endpoint is disabled for free plan users.
    """
    from app.plan_limits import get_limits, effective_plan

    brand = brand_for_user(brand_id, user, db)
    org = brand.organization

    # Check if auto-generate is allowed for this plan
    limits = get_limits(org.plan, org.trial_ends_at)
    if not limits.auto_generate_prompts:
        raise HTTPException(
            status_code=403,
            detail="La génération automatique de questions n'est pas disponible sur votre plan. Veuillez passer à un abonnement payant."
        )
    existing_texts = {p.text for p in brand.prompts}
    location = location.strip()

    candidate_texts: list[str] = []

    # ── Strategy 1 : website-based LLM generation ────────────────────────────
    if brand.domain:
        logger.info("Fetching website for brand %s (%s)", brand.name, brand.domain)
        website_summary = _fetch_website(brand.domain)

        if website_summary:
            logger.info(
                "Generating questions from website content (%d chars), location=%r",
                len(website_summary), location,
            )
            candidate_texts = _llm_generate_questions(brand, website_summary, location)
            if candidate_texts:
                logger.info("LLM generated %d questions", len(candidate_texts))

    # ── Strategy 2 : Strategic portfolio generation ──────────────────────────
    if not candidate_texts:
        logger.info("Using strategic portfolio for brand %s", brand.name)
        competitor_names = [c.name for c in (brand.competitors or [])]
        sector_key = _resolve_sector_key(brand.category)
        portfolio = build_prompt_portfolio(
            brand_name=brand.name,
            sector_key=sector_key,
            competitors=competitor_names,
            total_core=16,
            total_strategic=8,
        )
        created: list[Prompt] = []
        all_generated = portfolio["core"]["prompts"] + portfolio["strategic"]["prompts"]
        for gp in all_generated:
            if gp["text"] in existing_texts:
                continue
            prompt = Prompt(
                brand_id=brand.id,
                text=gp["text"],
                importance=1,
                enabled=True,
                prompt_category=gp["prompt_category"],
                intent_label=gp["intent_label"],
                business_value_score=gp["business_value_score"],
                priority_level=gp["priority_level"],
                difficulty_level=gp["difficulty_level"],
                explanation=gp["explanation"],
                target_competitors=gp["target_competitors"],
                is_brand_mentioned=gp["is_brand_mentioned"],
                expected_signal=gp["expected_signal"],
                # New framework fields
                prompt_scope=gp["prompt_scope"],
                benchmark_eligible=gp["benchmark_eligible"],
                strategic_eligible=gp["strategic_eligible"],
                sector_key=gp["sector_key"],
            )
            db.add(prompt)
            created.append(prompt)
        db.commit()
        for p in created:
            db.refresh(p)
        return created

    # ── Persist new prompts (LLM path) ───────────────────────────────────────
    created = []
    for text in candidate_texts:
        if text in existing_texts:
            continue
        # Classify and score each LLM-generated prompt
        is_brand = detect_brand_mentioned(text, brand.name)
        cat = migrate_category(text, brand.name)  # discovery or reputation fallback
        bv = estimate_business_value(cat, is_brand)
        prompt = Prompt(
            brand_id=brand.id,
            text=text,
            importance=1,
            enabled=True,
            prompt_category=cat,
            intent_label="recommandation spontanée" if cat == "discovery" else "fiabilité et confiance",
            business_value_score=bv,
            priority_level=estimate_priority_level(bv),
            difficulty_level=estimate_difficulty_level(cat, is_brand),
            is_brand_mentioned=is_brand,
            expected_signal=infer_expected_signal(cat),
        )
        db.add(prompt)
        created.append(prompt)

    db.commit()
    for p in created:
        db.refresh(p)

    return created


@router.get("/grouped")
def get_prompts_grouped(
    brand_id: UUID,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Return prompts grouped by scope (core/strategic) AND by strategic category."""
    from app.prompt_strategy.taxonomy import CATEGORY_INFO, ALL_CATEGORIES

    brand = brand_for_user(brand_id, user, db)
    prompts = list(brand.prompts)

    def _prompt_dict(p: Prompt, cat_key: str) -> dict:
        scope = p.prompt_scope or "strategic"
        return {
            "id": str(p.id),
            "text": p.text,
            "enabled": p.enabled,
            "use_web_search": p.use_web_search,
            "importance": p.importance,
            "prompt_scope": scope,
            "benchmark_eligible": p.benchmark_eligible,
            "strategic_eligible": p.strategic_eligible,
            "sector_key": p.sector_key,
            "prompt_category": p.prompt_category or cat_key,
            "intent_label": p.intent_label,
            "business_value_score": p.business_value_score,
            "priority_level": p.priority_level,
            "difficulty_level": p.difficulty_level,
            "explanation": p.explanation,
            "target_competitors": p.target_competitors,
            "is_brand_mentioned": p.is_brand_mentioned,
            "expected_signal": p.expected_signal,
            "created_at": p.created_at.isoformat(),
        }

    # Two-level grouping: scope → category
    grouped: dict[str, dict[str, dict]] = {
        "core":     {cat: {"info": CATEGORY_INFO[cat], "prompts": []} for cat in ALL_CATEGORIES},
        "strategic": {cat: {"info": CATEGORY_INFO[cat], "prompts": []} for cat in ALL_CATEGORIES},
    }

    for p in prompts:
        scope = p.prompt_scope or "strategic"
        cat = p.prompt_category
        if not cat or cat not in ALL_CATEGORIES:
            cat = migrate_category(p.text, brand.name)
        if scope not in grouped:
            scope = "strategic"
        if cat in grouped[scope]:
            grouped[scope][cat]["prompts"].append(_prompt_dict(p, cat))

    # Counts
    core_count = sum(len(grouped["core"][c]["prompts"]) for c in ALL_CATEGORIES)
    strategic_count = sum(len(grouped["strategic"][c]["prompts"]) for c in ALL_CATEGORIES)

    return {
        "core": {
            "description": "Questions standardisées utilisées pour le benchmark.",
            "counts": {"total": core_count, "by_category": {c: len(grouped["core"][c]["prompts"]) for c in ALL_CATEGORIES}},
            "by_category": {
                c: {
                    "info": {
                        "key": CATEGORY_INFO[c].key,
                        "title": CATEGORY_INFO[c].title,
                        "description": CATEGORY_INFO[c].description,
                        "tooltip": CATEGORY_INFO[c].tooltip,
                        "expected_signal": CATEGORY_INFO[c].expected_signal,
                        "recommended_ratio": CATEGORY_INFO[c].recommended_ratio,
                    },
                    "prompts": [_prompt_dict(p, c) for p in grouped["core"][c]["prompts"]],
                }
                for c in ALL_CATEGORIES
            },
        },
        "strategic": {
            "description": "Questions personnalisées utilisées pour détecter les opportunités.",
            "counts": {"total": strategic_count, "by_category": {c: len(grouped["strategic"][c]["prompts"]) for c in ALL_CATEGORIES}},
            "by_category": {
                c: {
                    "info": {
                        "key": CATEGORY_INFO[c].key,
                        "title": CATEGORY_INFO[c].title,
                        "description": CATEGORY_INFO[c].description,
                        "tooltip": CATEGORY_INFO[c].tooltip,
                        "expected_signal": CATEGORY_INFO[c].expected_signal,
                        "recommended_ratio": CATEGORY_INFO[c].recommended_ratio,
                    },
                    "prompts": [_prompt_dict(p, c) for p in grouped["strategic"][c]["prompts"]],
                }
                for c in ALL_CATEGORIES
            },
        },
        "counts": {"core": core_count, "strategic": strategic_count, "total": core_count + strategic_count},
    }


@router.patch("/{prompt_id}", response_model=PromptRead)
def update_prompt(
    brand_id: UUID,
    prompt_id: UUID,
    body: PromptUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Prompt:
    """Update prompt settings (e.g., use_web_search)."""
    from app.plan_limits import effective_plan

    brand = brand_for_user(brand_id, user, db)
    prompt = db.get(Prompt, prompt_id)
    if not prompt or prompt.brand_id != brand.id:
        raise HTTPException(status_code=404, detail="Prompt not found")

    # Check plan eligibility for web_search toggle
    if body.use_web_search is not None:
        org_plan = effective_plan(brand.organization.plan, brand.organization.trial_ends_at)
        if org_plan not in ("pro", "agency", "trial"):
            raise HTTPException(
                status_code=403,
                detail="La recherche web est réservée aux plans Pro et Agence."
            )
        prompt.use_web_search = body.use_web_search

    db.commit()
    db.refresh(prompt)
    return prompt


@router.delete("/{prompt_id}", status_code=204)
def delete_prompt(
    brand_id: UUID,
    prompt_id: UUID,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> None:
    brand = brand_for_user(brand_id, user, db)
    prompt = db.get(Prompt, prompt_id)
    if not prompt or prompt.brand_id != brand.id:
        raise HTTPException(status_code=404, detail="Prompt not found")
    db.delete(prompt)
    db.commit()
