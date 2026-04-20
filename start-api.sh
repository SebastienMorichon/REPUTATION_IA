#!/bin/zsh
# Lance l'API FastAPI en mode dev avec rechargement automatique
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
cd "$(dirname "$0")/apps/api"
source .venv/bin/activate
exec uvicorn app.main:app --reload --port 8000
