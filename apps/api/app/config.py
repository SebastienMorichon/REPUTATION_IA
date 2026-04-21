from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        env_ignore_empty=True,   # variables OS vides → ignorées, .env prend le dessus
    )

    database_url: str = Field(
        default="postgresql+psycopg://reputation:reputation@localhost:5432/reputation",
        alias="DATABASE_URL",
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def _fix_db_url(cls, v: str) -> str:
        """Render injects postgresql:// — SQLAlchemy needs postgresql+psycopg:// (psycopg3).
        Also handles the legacy postgres:// alias used by some providers."""
        if v.startswith("postgres://"):
            v = "postgresql+psycopg" + v[len("postgres"):]
        elif v.startswith("postgresql://"):
            v = "postgresql+psycopg" + v[len("postgresql"):]
        return v

    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    celery_broker_url: str = Field(
        default="redis://localhost:6379/1", alias="CELERY_BROKER_URL"
    )
    celery_result_backend: str = Field(
        default="redis://localhost:6379/2", alias="CELERY_RESULT_BACKEND"
    )

    jwt_secret: str = Field(default="dev-secret-change-me", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_expires_minutes: int = Field(default=1440, alias="JWT_EXPIRES_MINUTES")

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_enabled: bool = Field(default=False, alias="OPENAI_ENABLED")
    openai_default_model: str = Field(
        default="gpt-4o-mini", alias="OPENAI_DEFAULT_MODEL"
    )
    # Modèle avec recherche web native (pour use_web_search=True)
    # Modèles supportant web_search: gpt-4.1-mini, gpt-4.1-nano, gpt-4o-mini, gpt-4o
    openai_search_model: str = Field(
        default="gpt-4.1-mini", alias="OPENAI_SEARCH_MODEL"
    )

    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    anthropic_enabled: bool = Field(default=True, alias="ANTHROPIC_ENABLED")
    anthropic_default_model: str = Field(
        default="claude-sonnet-4-20250514", alias="ANTHROPIC_DEFAULT_MODEL"
    )

    analyzer_provider: str = Field(default="anthropic", alias="ANALYZER_PROVIDER")
    analyzer_model: str = Field(default="claude-sonnet-4-20250514", alias="ANALYZER_MODEL")

    # Perplexity (online / web-augmented LLM)
    perplexity_api_key: str = Field(default="", alias="PERPLEXITY_API_KEY")
    perplexity_enabled: bool = Field(default=False, alias="PERPLEXITY_ENABLED")
    perplexity_default_model: str = Field(
        default="llama-3.1-sonar-large-128k-online", alias="PERPLEXITY_DEFAULT_MODEL"
    )

    # SMTP — optional, for alert emails. Leave empty to disable email sending.
    smtp_host: str = Field(default="", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_user: str = Field(default="", alias="SMTP_USER")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    smtp_from: str = Field(default="noreply@reputation-ai.app", alias="SMTP_FROM")

    # Comma-separated list of allowed CORS origins (or "*" to allow all).
    # Example: https://app.vercel.app,https://other-preview.vercel.app
    web_origin: str = Field(default="http://localhost:3000", alias="WEB_ORIGIN")

    # Stripe — leave empty to disable payment features
    stripe_secret_key: str = Field(default="", alias="STRIPE_SECRET_KEY")
    stripe_webhook_secret: str = Field(default="", alias="STRIPE_WEBHOOK_SECRET")
    stripe_starter_price_id: str = Field(default="", alias="STRIPE_STARTER_PRICE_ID")
    stripe_pro_price_id: str = Field(default="", alias="STRIPE_PRO_PRICE_ID")
    stripe_agency_price_id: str = Field(default="", alias="STRIPE_AGENCY_PRICE_ID")

    # LinkedIn — leave empty to use mock/draft-only mode
    linkedin_access_token: str = Field(default="", alias="LINKEDIN_ACCESS_TOKEN")
    linkedin_person_urn: str = Field(default="", alias="LINKEDIN_PERSON_URN")
    linkedin_enabled: bool = Field(default=False, alias="LINKEDIN_ENABLED")

    # Tavily — web search API for LLM providers without native web search
    tavily_api_key: str = Field(default="", alias="TAVILY_API_KEY")


@lru_cache
def get_settings() -> Settings:
    return Settings()
