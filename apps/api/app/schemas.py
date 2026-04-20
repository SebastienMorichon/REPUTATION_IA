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


class PromptRead(ORMModel):
    id: uuid.UUID
    brand_id: uuid.UUID
    text: str
    language: str | None
    intent: str | None
    importance: int
    enabled: bool
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
