from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth ----------


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None
    organization_name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserRead"


class UserRead(ORMModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    organization_id: uuid.UUID
    is_admin: bool = False


# ---------- Brand / competitors / prompts ----------


class BrandCreate(BaseModel):
    name: str
    domain: str | None = None
    category: str | None = None
    country: str | None = None
    language: str | None = None
    description: str | None = None
    aliases: list[str] | None = None


class BrandUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    category: str | None = None
    description: str | None = None
    aliases: list[str] | None = None
    run_schedule: str | None = None   # "none" | "weekly" | "monthly"
    alert_email: str | None = None


class BrandRead(ORMModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    domain: str | None
    category: str | None
    country: str | None
    language: str | None
    description: str | None
    aliases: list[str] | None
    run_schedule: str | None
    alert_email: str | None
    created_at: datetime


class CompetitorCreate(BaseModel):
    name: str
    domain: str | None = None
    aliases: list[str] | None = None


class CompetitorRead(ORMModel):
    id: uuid.UUID
    brand_id: uuid.UUID
    name: str
    domain: str | None
    aliases: list[str] | None


class PromptCreate(BaseModel):
    text: str
    language: str | None = None
    intent: str | None = None
    importance: int = 1
    enabled: bool = True
    use_web_search: bool = False
    # Core / Strategic Framework fields
    prompt_scope: str | None = None
    benchmark_eligible: bool | None = None
    strategic_eligible: bool | None = None
    sector_key: str | None = None


class PromptUpdate(BaseModel):
    text: str | None = None
    language: str | None = None
    intent: str | None = None
    importance: int | None = None
    enabled: bool | None = None
    use_web_search: bool | None = None
    # Core / Strategic Framework fields
    prompt_scope: str | None = None
    benchmark_eligible: bool | None = None
    strategic_eligible: bool | None = None
    sector_key: str | None = None


class PromptRead(ORMModel):
    id: uuid.UUID
    brand_id: uuid.UUID
    text: str
    language: str | None
    intent: str | None
    importance: int
    enabled: bool
    use_web_search: bool = False
    # Strategy Engine fields
    prompt_category: str | None = None
    intent_label: str | None = None
    business_value_score: float | None = None
    priority_level: str | None = None
    difficulty_level: str | None = None
    explanation: str | None = None
    target_competitors: list[str] | None = None
    is_brand_mentioned: bool = False
    expected_signal: str | None = None
    # Core / Strategic Framework fields
    prompt_scope: str | None = None
    benchmark_eligible: bool = False
    strategic_eligible: bool = False
    sector_key: str | None = None
    created_at: datetime


# ---------- Runs ----------


class ProviderSelection(BaseModel):
    provider: str  # "openai" | "anthropic"
    model: str | None = None


class RunRequest(BaseModel):
    prompt_ids: list[uuid.UUID] | None = None  # if None => all enabled prompts
    providers: list[ProviderSelection] | None = None  # if None => all enabled providers


class MentionRead(ORMModel):
    entity_name: str
    is_target_brand: bool
    is_known_competitor: bool
    rank_position: int | None
    sentiment: str | None
    mention_type: str | None
    context_excerpt: str | None


class CitationRead(ORMModel):
    url: str | None
    domain: str | None
    title: str | None
    citation_type: str | None
    refers_to_target: bool


class PromptRunRead(ORMModel):
    id: uuid.UUID
    prompt_id: uuid.UUID
    brand_id: uuid.UUID
    provider: str
    model: str
    status: str
    raw_response: str | None
    analysis: dict[str, Any] | None
    latency_ms: int | None
    input_tokens: int | None
    output_tokens: int | None
    error: str | None
    executed_at: datetime | None
    created_at: datetime
    mentions: list[MentionRead] = []
    citations: list[CitationRead] = []
    prompt: PromptRead | None = None


class ScoreSnapshotRead(ORMModel):
    id: uuid.UUID
    brand_id: uuid.UUID
    period_start: datetime
    period_end: datetime
    visibility_score: float
    share_of_voice: float
    sentiment_score: float
    citation_score: float
    runs_count: int


TokenResponse.model_rebuild()


# ---------- Editorial content ----------


class ArticleListItem(ORMModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    brand_id: uuid.UUID | None
    status: str
    title: str | None
    slug: str | None
    excerpt: str | None
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ArticleRead(ORMModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    brand_id: uuid.UUID | None
    status: str
    title: str | None
    slug: str | None
    excerpt: str | None
    content_markdown: str | None
    seo_title: str | None
    seo_description: str | None
    brief: dict[str, Any] | None
    review: dict[str, Any] | None
    linkedin_variants: dict[str, Any] | None
    published_at: datetime | None
    linkedin_post_url: str | None
    error: str | None
    created_at: datetime
    updated_at: datetime


class ArticleGenerateRequest(BaseModel):
    topic_hint: str | None = None   # optional guidance for Agent 1


# ---------- AI Reputation Overview ----------


class ExecutiveStats(BaseModel):
    prompts_analyzed: int = 0
    providers_analyzed: int = 0
    sources_analyzed: int = 0


class Trend(BaseModel):
    previous_score: float | None = None
    delta: float | None = None
    direction: str | None = None  # "up", "down", "stable"


class ExecutiveScore(ORMModel):
    score: float
    grade: str
    label: str
    interpretation: str
    trend: Trend | None = None
    audit_date: str | None = None
    stats: ExecutiveStats


class PillarMetric(BaseModel):
    label: str
    value: str


class StrategicPillar(ORMModel):
    key: str  # visibility, authority, dominance, opportunity, narrative
    title: str
    question: str
    score: float
    grade: str
    status: str  # Fort, Moyen, Faible, Critique
    interpretation: str
    metrics: list[PillarMetric] = []


class BusinessPriority(ORMModel):
    rank: int
    title: str
    impact: str  # Critique, Fort, Moyen, Faible
    pillar: str
    reason: str
    action: str
    effort: str  # Faible, Moyen, Fort
    timeline: str  # Court terme, Moyen terme, Long terme


class TechnicalEvidenceSummary(ORMModel):
    audit_status: str = "unknown"
    sources_analyzed: int = 0
    pages_crawled: int = 0
    runs_analyzed: int = 0
    sources: list[dict] = []
    page_features: list[dict] = []


class AIReputationOverview(ORMModel):
    """Complete 4-level hierarchy response for AI Reputation dashboard."""
    executive_score: ExecutiveScore
    pillars: list[StrategicPillar]
    business_priorities: list[BusinessPriority] = []
    technical_evidence: TechnicalEvidenceSummary
