# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**AI Reputation Shield** — SaaS that monitors how AI systems (ChatGPT, Claude, Perplexity) present brands when users ask market-related questions. It measures AI visibility, share of voice, sentiment, citation quality, and tracks competitors across LLM responses.

Monorepo with two apps:
- `apps/api/` — FastAPI backend (Python 3.12)
- `apps/web/` — Next.js 15 frontend (React 19)

External services: **PostgreSQL 16** + **Redis 7** (locally via Homebrew, not Docker).

---

## Running the project

```bash
# Start everything (API + Celery worker + Next.js frontend)
./start-all.sh

# Kills stale processes on ports 8000/3000 automatically,
# then checks that Postgres + Redis are running before starting.
```

Individual processes (from `apps/api/`, with venv activated):
```bash
uvicorn app.main:app --port 8000                                  # API
celery -A app.worker.celery_app worker --loglevel=warning -n worker1@%h  # Worker
```

Frontend (`apps/web/`):
```bash
npm run dev    # port 3000
npm run build
npm run lint
```

**After any `.env` change**, restart both the API and the Celery worker — `@lru_cache` on `get_settings()` and `_providers()` means changes are only picked up at process start.

---

## Environment variables

`.env` lives at the repo root (gitignored). `apps/api/app/config.py` reads it via `pydantic-settings` with `env_ignore_empty=True` — this is critical: it prevents empty OS env vars (e.g. `ANTHROPIC_API_KEY=` exported in shell) from silently overriding the `.env` file values.

Key variables:
| Variable | Notes |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg://user:pass@localhost/dbname` |
| `CELERY_BROKER_URL` | `redis://localhost:6379/1` |
| `CELERY_RESULT_BACKEND` | `redis://localhost:6379/2` |
| `JWT_SECRET` | Change in production |
| `ANTHROPIC_ENABLED` / `ANTHROPIC_API_KEY` | Set both to activate |
| `OPENAI_ENABLED` / `OPENAI_API_KEY` | Set both to activate |
| `ANALYZER_PROVIDER` / `ANALYZER_MODEL` | Which provider does JSON extraction |

---

## Backend architecture (`apps/api/`)

### Request → DB pipeline

1. **FastAPI router** validates request, checks auth via `deps.py` (`current_user`, `brand_for_user`)
2. **`POST /brands/{id}/runs`** creates a `PromptRun` row per (prompt × provider) and enqueues Celery tasks
3. **Celery task** (`tasks.py → run_prompt`):
   - Calls `provider.generate()` → raw LLM response ("observation")
   - Calls `analyze_response()` → structured extraction ("analysis")
   - Persists `Mention` and `Citation` rows, sets `status = "done"`
4. **Scores** are computed on-demand by `scoring.py` from `PromptRun`/`Mention` rows

### LLM provider abstraction

`providers/base.py` defines `LLMProvider` ABC with two methods:
- `generate()` — free-form completion (observation stage)
- `generate_structured()` — JSON schema strict output (analysis stage)

`providers/registry.py` has `@lru_cache` on `_providers()`. Add a new provider by implementing `LLMProvider` and registering it there.

**Anthropic**: uses `tool_use` with `tool_choice={"type":"tool","name":schema_name}` to force structured output.  
**OpenAI**: uses `response_format.json_schema` with `strict: True`.

### Analyzer schema

`analyzer/extractor.py` contains `ANALYSIS_SCHEMA` — a strict JSON schema (`additionalProperties: false`) that the LLM must fill. It extracts: brand presence, rank, mention entities with sentiment, citations with URLs, and factual claims. Changing this schema requires verifying both provider implementations.

### Route ordering rule

**Literal routes must be declared before parameterized routes in the same router.** E.g., `POST /generate` must come before `DELETE /{prompt_id}` — otherwise FastAPI matches `/generate` as a `{prompt_id}` value and returns 405.

### Database

No Alembic migrations yet — tables are auto-created via `SQLAlchemy metadata.create_all()` at startup. Schema lives entirely in `app/models.py`. Key JSONB columns: `prompt_runs.analysis`, `prompt_runs.raw_response`, `score_snapshots.details`.

---

## Frontend architecture (`apps/web/`)

### Auth & routing

- Token stored in `localStorage` as `reputation.token`
- `components/AuthGate.tsx` protects all `/dashboard/*` routes
- `lib/api.ts` — `apiFetch<T>()` wraps all requests with `Authorization: Bearer` header and throws `ApiError` on non-2xx

### Theme system

Light/dark toggle uses a `data-theme` attribute on `<html>`. CSS custom properties in `globals.css` drive all colors. Tailwind extends colors from these vars (`bg`, `card`, `sidebar`, `text`, `muted`, `border`, `accent`, `good`, `warn`, `bad`, `feat`, `feat-text`). The root layout injects an inline script to set `data-theme` from localStorage before React hydrates, with `suppressHydrationWarning` on `<html>` to suppress the mismatch warning.

### Data fetching

All dashboard data is fetched client-side. Brand detail page (`brands/[id]/page.tsx`) polls every 6 seconds to pick up Celery task completions. Runs are fetched with `?limit=100`.

### Heatmap logic

`buildHeatmap()` in the brand detail page merges all runs for each (prompt × provider) pair — newest run per provider wins. Cell states: `cited` (green, with rank), `absent` (gray ○), `pending` (orange ⏳), `failed` (red ✗), or no run (—).

### Next.js specifics

- Uses App Router. Async params must be unwrapped with `use(params)` (React 19 pattern).
- After upgrading Next.js versions, delete `.next/` cache: `rm -rf apps/web/.next`
- `next.config.mjs` sets `outputFileTracingRoot` to the monorepo root.

---

## Auto-prompt generation

`POST /brands/{id}/prompts/generate` generates monitoring prompts based on `brand.category`. Templates are hardcoded in `routers/prompts.py` for 8 categories: `banque`, `e-commerce`, `saas`, `restaurant`, `immobilier`, `santé`, `consulting`, `générique`. Falls back to `générique` if the category doesn't match. Skips prompts that already exist (exact text match). The `générique` template is also the fallback for unrecognized category strings.

---

## Scoring

`scoring.py → compute_scores(runs)` produces:
- **Visibility** — % of done runs where `is_target_brand = true`
- **Share of Voice** — target brand mentions / total mentions (including competitors)
- **Sentiment** — % of target mentions with `positive` sentiment
- **Citation** — % of done runs with ≥1 citation where `refers_to_target = true`

All scores are 0–100 floats. The frontend uses letter grades A–E (A ≥ 75 %, E < 15 %).

---

## Celery

- Broker: `redis://localhost:6379/1`, Result backend: `redis://localhost:6379/2`
- `worker_prefetch_multiplier=1`, `task_acks_late=True`, `concurrency=2`
- To kill zombie workers: `pkill -9 -f "celery"`
- To purge the queue: `celery -A app.worker.celery_app purge -f`
- Always start with `-n worker1@%h` to avoid `DuplicateNodenameWarning`
