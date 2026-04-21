from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect

from app.config import get_settings
from app.database import Base, engine
from app.routers import admin, alerts, auth, billing, brands, content, prompts, providers, reports, runs, scores

settings = get_settings()

# Run migrations immediately at module import time, before any request can be handled
print("🔍 Running database migrations at import time...")
try:
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        inspector = inspect(engine)
        prompts_columns = [col["name"] for col in inspector.get_columns("prompts")]
        if "use_web_search" not in prompts_columns:
            print("➕ Adding use_web_search column to prompts table...")
            conn.execute(text("ALTER TABLE prompts ADD COLUMN use_web_search BOOLEAN DEFAULT FALSE"))
            conn.commit()
            print("✅ Column use_web_search added!")
        else:
            print("✅ Column use_web_search already exists")
except Exception as e:
    print(f"⚠️  Migration note: {e}")


def _parse_origins(raw: str) -> list[str]:
    """Accept comma-separated origins or '*'."""
    if not raw:
        return ["http://localhost:3000"]
    parts = [o.strip() for o in raw.split(",") if o.strip()]
    return parts or ["http://localhost:3000"]


def _run_migrations() -> None:
    """Auto-migrate missing columns on startup."""
    from sqlalchemy.exc import OperationalError

    print("🔍 Running database migrations...")
    try:
        with engine.connect() as conn:
            inspector = inspect(engine)
            prompts_columns = [col["name"] for col in inspector.get_columns("prompts")]

            if "use_web_search" not in prompts_columns:
                print("➕ Adding use_web_search column to prompts table...")
                conn.execute(text("ALTER TABLE prompts ADD COLUMN use_web_search BOOLEAN DEFAULT FALSE NOT NULL"))
                conn.commit()
                print("✅ Column use_web_search added successfully!")
            else:
                print("✅ Column use_web_search already exists")

            # Also check prompt_runs for safety
            runs_columns = [col["name"] for col in inspector.get_columns("prompt_runs")]
            print(f"✅ prompt_runs table has {len(runs_columns)} columns")
    except OperationalError as e:
        print(f"❌ Database migration failed (DB not ready?): {e}")
        raise
    except Exception as e:
        print(f"❌ Migration error: {e}")
        raise
    print("✅ All migrations completed")


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
        # MVP: auto-create tables (migrations already ran at import time)
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
    app.include_router(content.router)

    return app


app = create_app()
