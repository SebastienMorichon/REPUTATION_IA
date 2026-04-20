#!/bin/zsh
# Lance l'API, le worker Celery et le frontend en une seule commande.
# Usage: ./start-all.sh
# Arrêt: Ctrl+C (arrête les 3 processus)

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

# ── Libérer les ports si déjà occupés ──────────────────────
for PORT in 8000 3000; do
  PID_ON_PORT=$(lsof -ti :$PORT 2>/dev/null || true)
  if [[ -n "$PID_ON_PORT" ]]; then
    echo "⚠️  Port $PORT occupé (PID $PID_ON_PORT) — arrêt du processus existant..."
    kill -9 $PID_ON_PORT 2>/dev/null || true
    sleep 1
  fi
done

# ── Vérification Postgres + Redis ───────────────────────────
echo "🔍 Vérification Postgres + Redis..."
pg_isready -q || { echo "❌ Postgres n'est pas démarré. Lance: brew services start postgresql@16"; exit 1; }
redis-cli ping > /dev/null 2>&1 || { echo "❌ Redis n'est pas démarré. Lance: brew services start redis"; exit 1; }
echo "✅ Postgres et Redis actifs"

# ── Cleanup automatique à la sortie ────────────────────────
cleanup() {
  echo ""
  echo "🛑 Arrêt en cours..."
  kill "$API_PID" "$WORKER_PID" "$BEAT_PID" "$WEB_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  echo "✅ Tout arrêté."
}
trap cleanup EXIT INT TERM

# ── API ─────────────────────────────────────────────────────
echo "🚀 Démarrage de l'API (port 8000)..."
cd "$ROOT/apps/api"
source .venv/bin/activate
uvicorn app.main:app --port 8000 &
API_PID=$!

# ── Worker Celery ────────────────────────────────────────────
echo "⚙️  Démarrage du worker Celery..."
celery -A app.worker.celery_app worker --loglevel=warning --concurrency=2 -n worker1@%h &
WORKER_PID=$!

# ── Celery Beat (tâches planifiées) ─────────────────────────
echo "⏰ Démarrage de Celery Beat (runs planifiés + emails)..."
celery -A app.worker.celery_app beat --loglevel=warning &
BEAT_PID=$!

# Attendre que l'API soit prête
sleep 3
curl -sf http://localhost:8000/health > /dev/null && echo "✅ API prête" || echo "⚠️  API pas encore prête (vérifier /tmp/reputation-api.log)"

# ── Frontend ─────────────────────────────────────────────────
echo "🌐 Démarrage du frontend (port 3000)..."
cd "$ROOT/apps/web"
npm run dev &
WEB_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Frontend   → http://localhost:3000"
echo "  API        → http://localhost:8000"
echo "  API docs   → http://localhost:8000/docs"
echo "  Celery     → worker + beat (runs auto + emails)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Ctrl+C pour tout arrêter"
echo ""

wait
