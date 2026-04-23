# Déploiement FindMyCar — version express qui marche

Tu as déjà :
- Projet GCP/Firebase `findmycar-354b0` (plan Blaze activé ✓)
- Firestore database créée ✓
- Artifact Registry `findmycar` créée ✓

Il reste 3 choses : déployer le backend, déployer le frontend, configurer le scheduler.

---

## Étape 1 : déployer le backend (Cloud Run)

La commande `gcloud run deploy --source` fait tout en une fois : upload, build, deploy. Pas besoin de `cloudbuild.yaml`.

```bash
cd /Users/killianbarbarin/Desktop/FindMyCar

gcloud run deploy findmycar-backend \
  --source=backend \
  --region=europe-west1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --timeout=120 \
  --concurrency=20 \
  --max-instances=3 \
  --set-env-vars=NODE_ENV=production,SCRAPER_MODE=live,SCRAPER_ENGINE=auto,FIREBASE_PROJECT_ID=findmycar-354b0,CORS_ORIGIN=https://findmycar-354b0.web.app,SCHEDULER_SECRET=$(openssl rand -hex 32) \
  --project=findmycar-354b0
```

La 1re fois ça prend ~5 min (build de l'image). La commande imprime l'URL du service à la fin, ex :
`https://findmycar-backend-xxxxxxxxxx-ew.a.run.app`

**Garde cette URL**, on en a besoin après.

Test :
```bash
curl https://findmycar-backend-xxxxxxxxxx-ew.a.run.app/api/health
```

---

## Étape 2 : déployer le frontend (Firebase Hosting)

```bash
cd frontend

# URL du Cloud Run que tu viens d'obtenir
BACKEND_URL="https://findmycar-backend-xxxxxxxxxx-ew.a.run.app"

VITE_API_URL="$BACKEND_URL" npm run build

cd ..
firebase deploy --only hosting --project=findmycar-354b0
```

Ton site est en ligne : **https://findmycar-354b0.web.app**

(Alternative : le `firebase.json` que je t'ai préparé fait `rewrites /api/* → Cloud Run`. Ça marchera si Firebase Hosting a accès au service Cloud Run. Mais pour la 1re déploiement, passer par `VITE_API_URL` direct est plus simple.)

---

## Étape 3 : Cloud Scheduler (scraping automatique)

```bash
# Récupère le secret qu'on a généré à l'étape 1
gcloud run services describe findmycar-backend \
  --region=europe-west1 \
  --format='value(spec.template.spec.containers[0].env[?(@.name=="SCHEDULER_SECRET")].value)' \
  --project=findmycar-354b0

# Note le secret qui s'affiche. Puis :
SECRET="le-secret-affiche-ci-dessus"
URL=$(gcloud run services describe findmycar-backend \
  --region=europe-west1 \
  --format='value(status.url)' \
  --project=findmycar-354b0)

gcloud scheduler jobs create http findmycar-scrape \
  --schedule="0 */6 * * *" \
  --uri="$URL/api/internal/scrape" \
  --http-method=POST \
  --headers="X-Scheduler-Secret=$SECRET" \
  --time-zone="Europe/Paris" \
  --attempt-deadline=60s \
  --location=europe-west1 \
  --project=findmycar-354b0
```

Toutes les 6h, le scheduler va lancer un batch de scraping qui alimente Firestore.

Test manuel :
```bash
gcloud scheduler jobs run findmycar-scrape \
  --location=europe-west1 \
  --project=findmycar-354b0
```

---

## Si tu veux les stats Firestore — droits IAM

Le Cloud Run a besoin du rôle `datastore.user` pour écrire dans Firestore. C'est normalement automatique sur le Service Account par défaut du Compute Engine, mais si tu as des erreurs :

```bash
PROJECT_NUMBER=$(gcloud projects describe findmycar-354b0 --format='value(projectNumber)')
SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding findmycar-354b0 \
  --member="serviceAccount:$SA" \
  --role="roles/datastore.user"
```

---

## Troubleshooting

### Build 125 qu'on vient de voir
Le nouveau `Dockerfile` (léger, sans Playwright) est **stable** en build Cloud. Le `Dockerfile.cloudrun` (avec Playwright) peut planter si l'image MCR a changé. Commence par le simple, upgrade plus tard si besoin.

### Billing account ID
Si jamais tu dois relier le billing manuellement :
```bash
gcloud billing accounts list
# → te donne une ligne type 01ABCD-234EFG-567HIJ
gcloud billing projects link findmycar-354b0 --billing-account=01ABCD-234EFG-567HIJ
```

### Voir les logs Cloud Run
```bash
gcloud run services logs read findmycar-backend --region=europe-west1 --limit=50 --project=findmycar-354b0
```

### Voir les logs Cloud Build (si build échoue)
Le lien est dans la sortie de `gcloud run deploy`. Format :
`https://console.cloud.google.com/cloud-build/builds/<BUILD_ID>?project=<NUMBER>`

### Si Firestore refuse les writes
Vérifier les règles :
```bash
firebase deploy --only firestore:rules --project=findmycar-354b0
```

Et les indexes :
```bash
firebase deploy --only firestore:indexes --project=findmycar-354b0
```

### Forcer un redeploy propre
```bash
gcloud run services delete findmycar-backend --region=europe-west1 --project=findmycar-354b0
# Puis relance l'étape 1
```

---

## Coûts attendus (plan Blaze)

Avec les limites du free tier quotidien, tu vises **0 € / mois** en démo :

| Service | Free tier | Tu consommes |
|---|---|---|
| Cloud Run | 2M req/mois, scale-to-zero | ~100/jour probablement |
| Firestore | 50k reads/j, 20k writes/j, 1 GiB | Bien en-dessous |
| Hosting | 10 GiB storage, 360 MiB/j | Site très léger |
| Scheduler | 3 jobs gratuits | 1 job |
| Artifact Registry | 0.5 GiB gratuits | ~500 MB |

Le plan Blaze ne coûte que ce qui dépasse le free tier. Tant que le projet reste en démo → facture à 0 €.

---

## Récapitulatif commandes dans l'ordre

Copie-colle, c'est tout :

```bash
cd /Users/killianbarbarin/Desktop/FindMyCar

# 1. Backend
SECRET=$(openssl rand -hex 32)
echo "SCHEDULER_SECRET=$SECRET"  # note-le

gcloud run deploy findmycar-backend \
  --source=backend \
  --region=europe-west1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=1Gi --cpu=1 --timeout=120 \
  --concurrency=20 --max-instances=3 \
  --set-env-vars="NODE_ENV=production,SCRAPER_MODE=live,SCRAPER_ENGINE=auto,FIREBASE_PROJECT_ID=findmycar-354b0,CORS_ORIGIN=https://findmycar-354b0.web.app,SCHEDULER_SECRET=$SECRET" \
  --project=findmycar-354b0

# Note l'URL qui s'affiche, ex https://findmycar-backend-xxx-ew.a.run.app
BACKEND_URL="<colle-ici>"

# 2. Frontend
cd frontend && VITE_API_URL="$BACKEND_URL" npm run build && cd ..
firebase deploy --only hosting --project=findmycar-354b0

# 3. Firestore rules + indexes (une seule fois)
firebase deploy --only firestore --project=findmycar-354b0

# 4. Scheduler (optionnel)
gcloud scheduler jobs create http findmycar-scrape \
  --schedule="0 */6 * * *" \
  --uri="$BACKEND_URL/api/internal/scrape" \
  --http-method=POST \
  --headers="X-Scheduler-Secret=$SECRET" \
  --time-zone="Europe/Paris" \
  --location=europe-west1 \
  --project=findmycar-354b0
```
