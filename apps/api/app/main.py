from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.routers import admin, alerts, auth, billing, brands, prompts, providers, reports, runs, scores

settings = get_settings()


def _parse_origins(raw: str) -> list[str]:
    """Accept comma-separated origins or '*'."""
    if not raw:
        return ["http://localhost:3000"]
    parts = [o.strip() for o in raw.split(",") if o.strip()]
    return parts or ["http://localhost:3000"]


def create_app() -> FastAPI:
    app = FastAPI(title="AI Reputation Shield API", version="0.1.0")

    origins = _parse_origins(settings.web_origin)
    allow_all = origins == ["*"]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if allow_all else origins,
        allow_origin_regex=r"https://.*\.vercel\.app" if not allow_all else None,
        allow_credentials=not allow_all,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def _bootstrap_schema() -> None:
        # MVP: auto-create tables. Replace with Alembic before first prod deploy.
        Base.metadata.create_all(bind=engine)

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(brands.router)
    app.include_router(prompts.router)
    app.include_router(runs.router)
    app.include_router(scores.router)
    app.include_router(alerts.router)
    app.include_router(reports.router)
    app.include_router(providers.router)
    app.include_router(billing.router)
    app.include_router(admin.router)

    return app


app = create_app()
