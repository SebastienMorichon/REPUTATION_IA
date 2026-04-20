#!/bin/zsh
# Lance le worker Celery qui exécute les prompt runs en arrière-plan
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
cd "$(dirname "$0")/apps/api"
source .venv/bin/activate
exec celery -A app.worker.celery_app worker --loglevel=info --concurrency=2
