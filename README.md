# AI Reputation Shield

Mesurez et défendez votre réputation telle qu'elle est reconstruite par les IA (ChatGPT, Claude, etc.).
Ce repo contient un MVP fonctionnel : FastAPI + Postgres + Redis + Celery côté backend, Next.js côté frontend.

## Architecture

```
REPUTATION AI/
├── apps/
│   ├── api/      # FastAPI + SQLAlchemy + Celery
│   └── web/      # Next.js 15 + Tailwind
├── docker-compose.yml   # Postgres + Redis
├── .env.example
└── .env         # local, gitignored
```

Pipeline :

1. Le client ajoute une **marque**, des **concurrents**, des **prompts**.
2. Le endpoint `POST /brands/{id}/runs` crée un `PromptRun` par (prompt × provider actif) et l'envoie dans Celery.
3. Le worker :
   - interroge le LLM *observateur* (OpenAI et/ou Anthropic) pour obtenir la réponse naturelle,
   - passe la réponse au LLM *analyseur* qui renvoie un JSON structuré strict (mentions, rangs, sentiment, citations, claims),
   - persiste tout en Postgres.
4. Le dashboard calcule : **Visibility Score**, **Share of Voice**, **Sentiment**, **Citation coverage**, et top concurrents.

## Providers LLM (activables indépendamment)

Dans `.env` :

```
OPENAI_ENABLED=false        # passer à true quand tu auras des crédits
OPENAI_API_KEY=...
OPENAI_DEFAULT_MODEL=gpt-4o-mini

ANTHROPIC_ENABLED=true
ANTHROPIC_API_KEY=...
ANTHROPIC_DEFAULT_MODEL=claude-sonnet-4-6

# Provider utilisé pour l'extraction structurée (JSON strict)
ANALYZER_PROVIDER=anthropic  # ou openai
ANALYZER_MODEL=claude-sonnet-4-6
```

- Le backend n'instancie que les providers `*_ENABLED=true` **et** ayant une clé.
- Les runs utilisent par défaut tous les providers activés. Tu peux aussi passer un sous-ensemble dans le body de `POST /brands/{id}/runs`.
- L'analyseur est un **unique** provider (configurable) pour rester cohérent et réduire les coûts.

## Lancer en local

**Prérequis :** Docker Desktop, Python 3.12+, Node 20+.

```bash
# 0. Copier et remplir .env
cp .env.example .env
# renseigne JWT_SECRET, ANTHROPIC_API_KEY (et/ou OPENAI_API_KEY)

# 1. Lancer Postgres + Redis
docker compose up -d

# 2. API (FastAPI + Celery worker)
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# terminal A — serveur HTTP
uvicorn app.main:app --reload --port 8000

# terminal B — worker Celery
celery -A app.worker.celery_app worker --loglevel=info

# 3. Frontend
cd ../web
cp .env.local.example .env.local
npm install
npm run dev
```

Front : http://localhost:3000 — API : http://localhost:8000 — docs : http://localhost:8000/docs

## Flow utilisateur

1. `/signup` — crée un compte (auth JWT locale).
2. `/dashboard/brands/new` — renseigne la marque.
3. Sur la page marque : ajoute 3–5 concurrents, 5–20 prompts stratégiques.
4. Clique **▶ Lancer les runs**. Le dashboard se rafraîchit toutes les 5 s.
5. Clique un run pour voir la réponse brute, les entités extraites, les citations et le JSON d'analyse.

## Sécurité

- `.env` est gitignored. **Ne commit jamais de clés.**
- Les clés API partagées en clair (chat, ticket, screenshot) doivent être **révoquées immédiatement** :
  - Anthropic : https://console.anthropic.com/settings/keys
  - OpenAI : https://platform.openai.com/api-keys

## Roadmap (voir spec produit)

- **V1 (MVP, ici)** — monitoring OpenAI + Anthropic, scoring, citations, auth JWT.
- **V2** — génération auto de prompts, site crawl, trust-gap analyzer, hallucination watch.
- **V3** — score snapshots quotidiens (Celery beat), multi-langues, exports PDF/Slack, benchmarks sectoriels.

## Stack

- **API :** FastAPI 0.115, SQLAlchemy 2, Pydantic 2, Celery 5, Redis, Postgres 16.
- **LLMs :** `anthropic` SDK (Messages + tool-use pour structured outputs), `openai` SDK (chat.completions + json_schema strict).
- **Web :** Next.js 15 App Router, React 19, Tailwind, Recharts (prévu).
- **Auth :** JWT maison (`python-jose` + `bcrypt`) — simple à remplacer par Clerk/Auth.js plus tard.
