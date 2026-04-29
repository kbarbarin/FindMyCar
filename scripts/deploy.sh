#!/usr/bin/env bash
# Script de déploiement FindMyCar.
# Usage : ./scripts/deploy.sh [backend|frontend|scheduler|firestore|all]
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-findmycar-354b0}"
REGION="${REGION:-europe-west1}"
SERVICE_NAME="${SERVICE_NAME:-findmycar-backend}"
SECRET_FILE="${SECRET_FILE:-.secret}"

cd "$(dirname "$0")/.."

# Récupère ou crée le secret du scheduler (persisté dans .secret pour réutilisation)
ensure_secret() {
  if [[ -f "$SECRET_FILE" ]]; then
    SCHEDULER_SECRET=$(cat "$SECRET_FILE")
  else
    SCHEDULER_SECRET=$(openssl rand -hex 32)
    echo "$SCHEDULER_SECRET" > "$SECRET_FILE"
    echo "→ Secret créé et sauvé dans $SECRET_FILE (gitignored)"
  fi
}

deploy_backend() {
  ensure_secret
  echo "═══ Déploiement backend Cloud Run ═══"
  ENV_VARS="NODE_ENV=production"
  ENV_VARS="$ENV_VARS,SCRAPER_MODE=live"
  ENV_VARS="$ENV_VARS,SCRAPER_ENGINE=auto"
  ENV_VARS="$ENV_VARS,FIREBASE_PROJECT_ID=$PROJECT_ID"
  ENV_VARS="$ENV_VARS,CORS_ORIGIN=https://$PROJECT_ID.web.app"
  ENV_VARS="$ENV_VARS,SCHEDULER_SECRET=$SCHEDULER_SECRET"

  gcloud run deploy "$SERVICE_NAME" --source=backend --region="$REGION" --platform=managed --allow-unauthenticated --memory=1Gi --cpu=1 --timeout=120 --concurrency=20 --max-instances=3 --set-env-vars="$ENV_VARS" --project="$PROJECT_ID"

  BACKEND_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)' --project="$PROJECT_ID")
  echo "$BACKEND_URL" > .backend_url
  echo "→ Backend déployé : $BACKEND_URL (sauvé dans .backend_url)"
}

deploy_frontend() {
  if [[ ! -f .backend_url ]]; then
    echo "✖ .backend_url introuvable — lance 'deploy.sh backend' d'abord"
    exit 1
  fi
  BACKEND_URL=$(cat .backend_url)
  echo "═══ Build frontend avec VITE_API_URL=$BACKEND_URL ═══"
  (cd frontend && VITE_API_URL="$BACKEND_URL" npm run build)
  echo "═══ Déploiement Firebase Hosting ═══"
  firebase deploy --only hosting --project="$PROJECT_ID"
  echo "→ Frontend en ligne : https://$PROJECT_ID.web.app"
}

deploy_firestore() {
  echo "═══ Deploy Firestore rules ═══"
  firebase deploy --only firestore:rules --project="$PROJECT_ID"

  echo "═══ Deploy Firestore indexes ═══"
  # Les indexes peuvent renvoyer 400 si Firestore juge un index single-field
  # redondant (creation automatique). C'est non-fatal : on continue le pipeline.
  if ! firebase deploy --only firestore:indexes --project="$PROJECT_ID"; then
    echo "⚠ Deploy des indexes echoue (souvent un index single-field redondant)."
    echo "  Le reste du pipeline continue. Verifie firestore.indexes.json si besoin."
  fi
}

deploy_scheduler() {
  ensure_secret
  if [[ ! -f .backend_url ]]; then
    echo "✖ .backend_url introuvable — lance 'deploy.sh backend' d'abord"
    exit 1
  fi
  BACKEND_URL=$(cat .backend_url)
  echo "═══ Configuration Cloud Scheduler ═══"
  # Idempotent : delete puis create si existe déjà
  gcloud scheduler jobs delete findmycar-scrape --location="$REGION" --project="$PROJECT_ID" --quiet 2>/dev/null || true
  gcloud scheduler jobs create http findmycar-scrape --schedule="0 */6 * * *" --uri="$BACKEND_URL/api/internal/scrape" --http-method=POST --headers="X-Scheduler-Secret=$SCHEDULER_SECRET" --time-zone="Europe/Paris" --attempt-deadline=60s --location="$REGION" --project="$PROJECT_ID"
  echo "→ Scheduler configuré (toutes les 6h)"
}

case "${1:-all}" in
  backend)   deploy_backend ;;
  frontend)  deploy_frontend ;;
  firestore) deploy_firestore ;;
  scheduler) deploy_scheduler ;;
  all)       deploy_backend; deploy_frontend; deploy_firestore; deploy_scheduler ;;
  *)         echo "Usage: $0 [backend|frontend|firestore|scheduler|all]"; exit 1 ;;
esac
