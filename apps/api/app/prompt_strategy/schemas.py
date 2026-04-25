"""Pydantic schemas for the Prompt Strategy Engine endpoints."""
from __future__ import annotations

from pydantic import BaseModel


class CategoryInfoResponse(BaseModel):
    key: str
    title: str
    description: str
    tooltip: str
    expected_signal: str
    recommended_ratio: float
    is_brand_mentioned_typical: bool
    score_mapping: list[str]
    intent_label: str


class PromptStrategicRead(BaseModel):
    id: str
    text: str
    enabled: bool
    use_web_search: bool
    importance: int
    prompt_category: str | None
    intent_label: str | None
    business_value_score: float | None
    priority_level: str | None
    difficulty_level: str | None
    explanation: str | None
    target_competitors: list[str] | None
    is_brand_mentioned: bool
    expected_signal: str | None
    created_at: str

    model_config = {"from_attributes": True}


class CategoryGroup(BaseModel):
    key: str
    title: str
    tooltip: str
    description: str
    expected_signal: str
    recommended_ratio: float
    prompts: list[PromptStrategicRead]


class GroupedPromptsResponse(BaseModel):
    discovery: CategoryGroup
    comparison: CategoryGroup
    reputation: CategoryGroup
    authority: CategoryGroup
    uncategorized_count: int
