from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _now() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    organization: Mapped[Organization] = relationship(back_populates="users")


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Stripe billing
    plan: Mapped[str | None] = mapped_column(String(32), default="free", nullable=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # 14-day free trial — set at signup, null after expiry
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    users: Mapped[list[User]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    brands: Mapped[list[Brand]] = relationship(back_populates="organization", cascade="all, delete-orphan")


class Brand(Base, TimestampMixin):
    __tablename__ = "brands"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country: Mapped[str | None] = mapped_column(String(8), nullable=True)
    language: Mapped[str | None] = mapped_column(String(8), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    aliases: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    # Monitoring schedule: "none" | "weekly" | "monthly"
    run_schedule: Mapped[str | None] = mapped_column(String(16), default="none", nullable=True)
    # Optional override email for alerts (falls back to org owner email)
    alert_email: Mapped[str | None] = mapped_column(String(320), nullable=True)

    organization: Mapped[Organization] = relationship(back_populates="brands")
    competitors: Mapped[list[Competitor]] = relationship(back_populates="brand", cascade="all, delete-orphan")
    prompts: Mapped[list[Prompt]] = relationship(back_populates="brand", cascade="all, delete-orphan")


class Competitor(Base, TimestampMixin):
    __tablename__ = "competitors"
    __table_args__ = (UniqueConstraint("brand_id", "name", name="uq_competitor_brand_name"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    aliases: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    brand: Mapped[Brand] = relationship(back_populates="competitors")


class Prompt(Base, TimestampMixin):
    __tablename__ = "prompts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str | None] = mapped_column(String(8), nullable=True)
    intent: Mapped[str | None] = mapped_column(String(64), nullable=True)
    importance: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    use_web_search: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ── Prompt Strategy Engine ────────────────────────────────────────────────
    prompt_category: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    # "discovery" | "comparison" | "reputation" | "authority"
    intent_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    business_value_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    priority_level: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # "low" | "medium" | "high" | "critical"
    difficulty_level: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # "easy" | "medium" | "hard"
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_competitors: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    is_brand_mentioned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expected_signal: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # "spontaneous_recommendation" | "competitive_preference" | "trust_assessment" | "authority_recognition"

    # ── Core / Strategic Framework ────────────────────────────────────────────
    prompt_scope: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # "core" | "strategic" — null defaults to "strategic" for backward compat
    benchmark_eligible: Mapped[bool] = mapped_column(Boolean, default=False)
    strategic_eligible: Mapped[bool] = mapped_column(Boolean, default=False)
    sector_key: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # e.g. "banque", "saas", "assurance", "immobilier", "santé", "e-commerce", "consulting", "restaurant", "générique"

    brand: Mapped[Brand] = relationship(back_populates="prompts")
    runs: Mapped[list[PromptRun]] = relationship(back_populates="prompt", cascade="all, delete-orphan")


class PromptRun(Base, TimestampMixin):
    __tablename__ = "prompt_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    prompt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    raw_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    analysis: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    prompt: Mapped[Prompt] = relationship(back_populates="runs")
    mentions: Mapped[list[Mention]] = relationship(back_populates="run", cascade="all, delete-orphan")
    citations: Mapped[list[Citation]] = relationship(back_populates="run", cascade="all, delete-orphan")


class Mention(Base, TimestampMixin):
    __tablename__ = "mentions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    prompt_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prompt_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entity_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_target_brand: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_known_competitor: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rank_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sentiment: Mapped[str | None] = mapped_column(String(32), nullable=True)
    mention_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    context_excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)

    run: Mapped[PromptRun] = relationship(back_populates="mentions")


class Citation(Base, TimestampMixin):
    __tablename__ = "citations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    prompt_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prompt_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    citation_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    refers_to_target: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    run: Mapped[PromptRun] = relationship(back_populates="citations")


class LLMProviderConfig(Base, TimestampMixin):
    """Dynamic LLM provider — created via admin UI, stored in DB.

    Built-in providers (anthropic, openai, perplexity) are NOT stored here;
    they continue to read from .env / platform_config.  This table holds every
    provider that the admin adds at runtime.

    api_type values:
      - "openai_compat"  → OpenAI SDK, custom base_url (Mistral, Groq, DeepSeek…)
      - "anthropic"      → Anthropic SDK (custom endpoint / proxy)
    """
    __tablename__ = "llm_providers"

    name: Mapped[str] = mapped_column(String(64), primary_key=True)   # e.g. "mistral"
    label: Mapped[str] = mapped_column(String(128), nullable=False)    # "Mistral AI"
    api_type: Mapped[str] = mapped_column(String(32), nullable=False, default="openai_compat")
    base_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_model: Mapped[str] = mapped_column(String(128), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PlatformConfig(Base):
    """Key-value store for runtime platform configuration (API keys, prices, feature flags).

    Overrides `.env` values at runtime — changes take effect on the next request/task
    without restarting the server.
    """
    __tablename__ = "platform_config"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )


class ScoreSnapshot(Base, TimestampMixin):
    __tablename__ = "score_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    visibility_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    share_of_voice: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    sentiment_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    citation_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    runs_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    details: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)


class Article(Base, TimestampMixin):
    """Automated editorial article produced by the 4-agent pipeline.

    Status lifecycle: idea → drafting → draft → review → approved → published | failed
    """
    __tablename__ = "articles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Optional brand association — article can be generic or brand-specific
    brand_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Pipeline status
    status: Mapped[str] = mapped_column(String(32), default="idea", nullable=False, index=True)

    # Agent 1 — Brief (topic, angle, audience, keyword, outline, sources, …)
    brief: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # Agent 2 — Draft content
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    slug: Mapped[str | None] = mapped_column(String(512), nullable=True, unique=True)
    excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    seo_title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    seo_description: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Agent 3 — Editorial review scores / notes
    review: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # Agent 4 — LinkedIn post variants
    linkedin_variants: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # Publication metadata
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    linkedin_post_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    # Error tracking
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    organization: Mapped[Organization] = relationship()
    brand: Mapped[Brand | None] = relationship()


# ─────────────────────────────────────────────────────────────────────────────
# Alert
# ─────────────────────────────────────────────────────────────────────────────

class Alert(Base, TimestampMixin):
    """Alert generated from monitoring runs — can be archived by users."""
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prompt_runs.id", ondelete="CASCADE"), nullable=True, index=True
    )
    prompt_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prompts.id", ondelete="CASCADE"), nullable=True
    )
    kind: Mapped[str] = mapped_column(String(32), nullable=False)       # absent / negative / failed / new_citation
    severity: Mapped[str] = mapped_column(String(16), nullable=False)   # high / medium / low
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    brand: Mapped[Brand] = relationship()


# ─────────────────────────────────────────────────────────────────────────────
# PlanConfig — per-plan feature flags and limits (DB-backed)
# ─────────────────────────────────────────────────────────────────────────────

class PlanConfig(Base, TimestampMixin):
    __tablename__ = "plan_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    plan_key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_trial: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    trial_duration_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_brands: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    max_runs_per_week: Mapped[int] = mapped_column(Integer, default=1, nullable=False)  # -1 = unlimited
    max_providers: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    pdf_export: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recommendations: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    scheduled_runs: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    auto_generate_prompts: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    multi_users: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    white_label_reports: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    api_access: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    priority_support: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


# ─────────────────────────────────────────────────────────────────────────────
# GEO Quality — content audit models
# ─────────────────────────────────────────────────────────────────────────────

class GeoAudit(Base):
    __tablename__ = "geo_audits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    sources: Mapped[list["GeoSource"]] = relationship(back_populates="audit", cascade="all, delete-orphan")
    snapshot: Mapped["GeoQualitySnapshot | None"] = relationship(back_populates="audit", uselist=False)


class GeoSource(Base):
    __tablename__ = "geo_sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    geo_audit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geo_audits.id", ondelete="CASCADE"), nullable=False, index=True
    )
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_type: Mapped[str] = mapped_column(String(32), default="unknown", nullable=False)  # owned/earned/ugc/unknown
    discovered_from: Mapped[str] = mapped_column(String(64), default="citation", nullable=False)
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True)

    audit: Mapped[GeoAudit] = relationship(back_populates="sources")
    page_analysis: Mapped["GeoPageAnalysis | None"] = relationship(back_populates="source", uselist=False, cascade="all, delete-orphan")


class GeoPageAnalysis(Base):
    __tablename__ = "geo_page_analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    geo_source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geo_sources.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    html_status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    word_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    h1_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    h2_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    h3_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    has_faq: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_table: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_schema_org: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    detected_dates: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    facts_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    stats_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    outbound_sources_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    semantic_topics: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    source: Mapped[GeoSource] = relationship(back_populates="page_analysis")


class GeoQualitySnapshot(Base):
    __tablename__ = "geo_quality_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    geo_audit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geo_audits.id", ondelete="CASCADE"), nullable=False
    )
    authority_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    freshness_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    semantic_structure_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    evidence_density_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    topic_coverage_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    global_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    details: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    audit: Mapped[GeoAudit] = relationship(back_populates="snapshot")


# ─────────────────────────────────────────────────────────────────────────────
# GEO Intelligence — LLM Reputation Intelligence models
# ─────────────────────────────────────────────────────────────────────────────

class GeoIntelligenceRun(Base):
    __tablename__ = "geo_intelligence_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    runs_analyzed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    snapshot: Mapped["GeoIntelligenceSnapshot | None"] = relationship(back_populates="run", uselist=False)


class GeoIntelligenceSnapshot(Base):
    __tablename__ = "geo_intelligence_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    intelligence_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geo_intelligence_runs.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    citation_network_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    entity_authority_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    rank_dominance_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    opportunity_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    narrative_control_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    intelligence_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    details: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    run: Mapped[GeoIntelligenceRun] = relationship(back_populates="snapshot")


class GeoPromptOpportunity(Base):
    __tablename__ = "geo_prompt_opportunities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    intelligence_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geo_intelligence_runs.id", ondelete="SET NULL"), nullable=True
    )
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    business_value_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    competitor_presence_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    brand_presence_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    conquest_difficulty_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    geo_opportunity_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    dominant_competitors: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    recommended_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class GeoRankDominance(Base):
    __tablename__ = "geo_rank_dominance"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    intelligence_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geo_intelligence_runs.id", ondelete="SET NULL"), nullable=True
    )
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    average_rank: Mapped[float] = mapped_column(Float, default=99.0, nullable=False)
    first_mention_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_mentions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    provider_preference_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    dominant_competitor: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_dominance_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class GeoEntityAuthority(Base):
    __tablename__ = "geo_entity_authority"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    intelligence_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geo_intelligence_runs.id", ondelete="SET NULL"), nullable=True
    )
    entity_name: Mapped[str] = mapped_column(String(255), nullable=False)
    named_mentions_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    trusted_sources_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    co_occurrence_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    strong_entity_associations: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    knowledge_graph_presence: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    entity_authority_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class GeoNarrativeControl(Base):
    __tablename__ = "geo_narrative_control"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    intelligence_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geo_intelligence_runs.id", ondelete="SET NULL"), nullable=True
    )
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    framing_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    contradiction_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    misinformation_risk_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    negative_competitor_advantage_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    narrative_summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class GeoCitationGraph(Base):
    __tablename__ = "geo_citation_graph"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    intelligence_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geo_intelligence_runs.id", ondelete="SET NULL"), nullable=True
    )
    citation_network_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tier1_citations: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tier2_citations: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tier3_citations: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    earned_citations: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    top_domains: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class BrandReport(Base):
    __tablename__ = "brand_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    brand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    report_type: Mapped[str] = mapped_column(String(64), default="ai_reputation", nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    brand: Mapped[Brand] = relationship()


# ══════════════════════════════════════════════════════════════════════════════
# PROMPT FRAMEWORK ADMIN MODELS
# ══════════════════════════════════════════════════════════════════════════════


class PromptFrameworkConfig(Base, TimestampMixin):
    """Global framework settings — single active row."""

    __tablename__ = "prompt_framework_config"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    benchmark_weight: Mapped[float] = mapped_column(Float, default=0.70, nullable=False)
    strategic_weight: Mapped[float] = mapped_column(Float, default=0.30, nullable=False)
    default_core_count: Mapped[int] = mapped_column(Integer, default=16, nullable=False)
    default_strategic_count: Mapped[int] = mapped_column(Integer, default=8, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class PromptCategoryConfig(Base, TimestampMixin):
    """Per-category (discovery/comparison/reputation/authority) settings."""

    __tablename__ = "prompt_category_configs"
    __table_args__ = (UniqueConstraint("category_key", name="uq_pf_category_key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    category_key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tooltip: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_signal: Mapped[str | None] = mapped_column(String(64), nullable=True)
    intent_label: Mapped[str | None] = mapped_column(String(128), nullable=True)
    recommended_ratio: Mapped[float] = mapped_column(Float, default=0.40, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PromptSectorConfig(Base, TimestampMixin):
    """Per-sector (banque/saas/assurance/...) settings."""

    __tablename__ = "prompt_sector_configs"
    __table_args__ = (UniqueConstraint("sector_key", name="uq_pf_sector_key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    sector_key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class CorePromptTemplate(Base, TimestampMixin):
    """Editable core prompt templates — DB is primary store, hardcoded is fallback."""

    __tablename__ = "core_prompt_templates"
    __table_args__ = (
        UniqueConstraint("sector_key", "category_key", "template_index", name="uq_core_template_idx"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    sector_key: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    category_key: Mapped[str] = mapped_column(String(32), nullable=False)
    template_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class StrategicPromptGenerationConfig(Base, TimestampMixin):
    """Rules for strategic prompt generation per sector/category."""

    __tablename__ = "strategic_prompt_gen_config"
    __table_args__ = (UniqueConstraint("sector_key", "category_key", name="uq_strategic_gen_sector_cat"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    sector_key: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    category_key: Mapped[str] = mapped_column(String(32), nullable=False)
    target_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    extra_templates: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class PromptFrameworkAuditLog(Base):
    """Immutable audit trail for all prompt framework config changes."""

    __tablename__ = "prompt_framework_audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    table_name: Mapped[str] = mapped_column(String(64), nullable=False)
    record_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    old_value: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    new_value: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    changed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    changed_by_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
