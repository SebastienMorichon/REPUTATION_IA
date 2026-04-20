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
