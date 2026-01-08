# StudIA - Deployment & Infrastructure Guide

## Tabla de Contenidos
1. [Arquitectura de Infraestructura](#1-arquitectura-de-infraestructura)
2. [Google Cloud Setup](#2-google-cloud-setup)
3. [Firebase Setup](#3-firebase-setup)
4. [Deployment de Backend API](#4-deployment-de-backend-api)
5. [Deployment de Workers](#5-deployment-de-workers)
6. [Deployment de Frontend](#6-deployment-de-frontend)
7. [CI/CD Pipeline](#7-cicd-pipeline)
8. [Monitoring y Logging](#8-monitoring-y-logging)
9. [Costos Estimados](#9-costos-estimados)
10. [Checklist de Production](#10-checklist-de-production)

---

## 1. Arquitectura de Infraestructura

### 1.1 Diagrama de Servicios GCP

```
┌─────────────────────────────────────────────────────────────────┐
│                      Google Cloud Project                       │
│                         (studia-prod)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Firebase   │    │  Cloud Run   │    │Cloud Storage │
│              │    │              │    │              │
│ - Auth       │    │ - API Server │    │ - PDFs       │
│ - Firestore  │    │ - Workers    │    │ - Audios     │
└──────────────┘    └──────────────┘    └──────────────┘
                              │
                    ┌─────────┼─────────┐
                    │                   │
                    ▼                   ▼
            ┌──────────────┐    ┌──────────────┐
            │ Cloud Tasks  │    │Secret Manager│
            │              │    │              │
            │ - Job Queues │    │ - API Keys   │
            └──────────────┘    └──────────────┘
```

### 1.2 Recursos Necesarios

| Servicio | Propósito | SKU/Tier |
|----------|-----------|----------|
| **Firebase Authentication** | Google OAuth | Free tier (50K MAU) |
| **Firestore** | Base de datos | Pay-as-you-go |
| **Cloud Storage** | PDFs y audios | Standard storage |
| **Cloud Run** | API + Workers | Pay-per-use |
| **Cloud Tasks** | Job queues | Pay-per-task |
| **Secret Manager** | API keys | Pay-per-secret |
| **Cloud Build** | CI/CD | Free tier (120 min/day) |
| **Cloud Monitoring** | Logs y métricas | Free tier |
| **Cloud Load Balancing** | HTTPS + CDN | Pay-per-GB |

---

## 2. Google Cloud Setup

### 2.1 Crear Proyecto

```bash
# Instalar gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Login
gcloud auth login

# Crear proyecto
gcloud projects create studia-prod --name="StudIA Production"

# Set proyecto activo
gcloud config set project studia-prod

# Habilitar billing
gcloud beta billing projects link studia-prod \
  --billing-account=BILLING_ACCOUNT_ID
```

### 2.2 Habilitar APIs

```bash
# Habilitar APIs necesarias
gcloud services enable \
  run.googleapis.com \
  cloudtasks.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  firestore.googleapis.com \
  firebase.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudmonitoring.googleapis.com \
  logging.googleapis.com
```

### 2.3 Crear Service Account

```bash
# Service account para backend
gcloud iam service-accounts create studia-backend \
  --display-name="StudIA Backend Service Account"

# Grant permisos
gcloud projects add-iam-policy-binding studia-prod \
  --member="serviceAccount:studia-backend@studia-prod.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding studia-prod \
  --member="serviceAccount:studia-backend@studia-prod.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding studia-prod \
  --member="serviceAccount:studia-backend@studia-prod.iam.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"

gcloud projects add-iam-policy-binding studia-prod \
  --member="serviceAccount:studia-backend@studia-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 2.4 Setup Firestore

```bash
# Crear database en modo Native
gcloud firestore databases create \
  --location=us-central1 \
  --type=firestore-native

# Crear índices compuestos (via console o firebase CLI)
# Ver firestore.indexes.json
```

**firestore.indexes.json:**
```json
{
  "indexes": [
    {
      "collectionGroup": "papers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "level", "order": "ASCENDING" },
        { "fieldPath": "rank", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "jobs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "jobs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

Deploy índices:
```bash
firebase deploy --only firestore:indexes
```

### 2.5 Setup Cloud Storage

```bash
# Crear buckets
gsutil mb -l us-central1 gs://studia-thesis-pdfs
gsutil mb -l us-central1 gs://studia-papers
gsutil mb -l us-central1 gs://studia-podcasts

# Configurar CORS para uploads
cat > cors.json <<EOF
[
  {
    "origin": ["https://studia.app", "http://localhost:5173"],
    "method": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "responseHeader": ["Content-Type", "Authorization"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors.json gs://studia-thesis-pdfs
gsutil cors set cors.json gs://studia-papers
gsutil cors set cors.json gs://studia-podcasts

# Lifecycle policy para PDFs (retention 30 días después de delete)
cat > lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 90,
          "isLive": false
        }
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://studia-thesis-pdfs
```

### 2.6 Setup Cloud Tasks Queues

```bash
# Crear queues
gcloud tasks queues create thesis-processing-queue \
  --location=us-central1 \
  --max-concurrent-dispatches=10 \
  --max-dispatches-per-second=5

gcloud tasks queues create paper-processing-queue \
  --location=us-central1 \
  --max-concurrent-dispatches=20 \
  --max-dispatches-per-second=10

gcloud tasks queues create podcast-generation-queue \
  --location=us-central1 \
  --max-concurrent-dispatches=5 \
  --max-dispatches-per-second=2

gcloud tasks queues create flashcard-generation-queue \
  --location=us-central1 \
  --max-concurrent-dispatches=10 \
  --max-dispatches-per-second=5

gcloud tasks queues create quiz-generation-queue \
  --location=us-central1 \
  --max-concurrent-dispatches=10 \
  --max-dispatches-per-second=5
```

### 2.7 Setup Secret Manager

```bash
# Crear secrets
echo -n "your-openai-api-key" | \
  gcloud secrets create openai-api-key --data-file=-

echo -n "your-webhook-secret" | \
  gcloud secrets create webhook-secret --data-file=-

# Grant acceso a service account
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:studia-backend@studia-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding webhook-secret \
  --member="serviceAccount:studia-backend@studia-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Firebase Setup

### 3.1 Inicializar Firebase

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Inicializar proyecto
firebase init

# Seleccionar:
# - Firestore
# - Authentication
# - Hosting (para frontend)
```

### 3.2 Configurar Firebase Authentication

Via Firebase Console:
1. Ir a **Authentication** > **Sign-in method**
2. Habilitar **Google** provider
3. Configurar OAuth consent screen
4. Agregar dominios autorizados:
   - `studia.app`
   - `localhost` (para desarrollo)

### 3.3 Firebase Config para Frontend

```typescript
// frontend/src/config/firebase.ts
export const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "studia-prod.firebaseapp.com",
  projectId: "studia-prod",
  storageBucket: "studia-prod.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
};
```

### 3.4 Service Account Key (para Backend)

```bash
# Generar key para Firebase Admin SDK
gcloud iam service-accounts keys create firebase-admin-key.json \
  --iam-account=studia-backend@studia-prod.iam.gserviceaccount.com

# Guardar en Secret Manager
gcloud secrets create firebase-admin-key \
  --data-file=firebase-admin-key.json

# IMPORTANTE: Eliminar archivo local
rm firebase-admin-key.json
```

---

## 4. Deployment de Backend API

### 4.1 Dockerfile

**backend/Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY src ./src

# Build
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files
COPY --from=builder /app/dist ./dist

# Run as non-root user
USER node

EXPOSE 8080

CMD ["node", "dist/index.js"]
```

### 4.2 Deploy Script

**backend/deploy.sh:**
```bash
#!/bin/bash

set -e

PROJECT_ID="studia-prod"
SERVICE_NAME="studia-api"
REGION="us-central1"

echo "Building and deploying ${SERVICE_NAME}..."

gcloud run deploy ${SERVICE_NAME} \
  --source . \
  --platform managed \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --service-account studia-backend@${PROJECT_ID}.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,PROJECT_ID=${PROJECT_ID}" \
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest,FIREBASE_ADMIN_KEY=firebase-admin-key:latest" \
  --min-instances 1 \
  --max-instances 10 \
  --cpu 2 \
  --memory 2Gi \
  --timeout 300 \
  --concurrency 80

echo "Deployment complete!"

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --format 'value(status.url)')

echo "Service URL: ${SERVICE_URL}"
```

### 4.3 Environment Variables

**backend/.env.production:**
```bash
NODE_ENV=production
PROJECT_ID=studia-prod
REGION=us-central1

# Firebase (cargado desde Secret Manager)
# FIREBASE_ADMIN_KEY=...

# APIs (cargadas desde Secret Manager)
# OPENAI_API_KEY=...

# Cloud Storage
THESIS_BUCKET=studia-thesis-pdfs
PAPERS_BUCKET=studia-papers
PODCASTS_BUCKET=studia-podcasts

# Cloud Tasks
THESIS_QUEUE=thesis-processing-queue
PAPER_QUEUE=paper-processing-queue
PODCAST_QUEUE=podcast-generation-queue
FLASHCARD_QUEUE=flashcard-generation-queue
QUIZ_QUEUE=quiz-generation-queue

# Workers URLs (se configuran después del deploy)
THESIS_WORKER_URL=https://thesis-worker-xxx.run.app
PAPER_WORKER_URL=https://paper-worker-xxx.run.app
PODCAST_WORKER_URL=https://podcast-worker-xxx.run.app
FLASHCARD_WORKER_URL=https://flashcard-worker-xxx.run.app
QUIZ_WORKER_URL=https://quiz-worker-xxx.run.app

# CORS
FRONTEND_URL=https://studia.app
```

### 4.4 Deploy

```bash
cd backend
chmod +x deploy.sh
./deploy.sh
```

---

## 5. Deployment de Workers

### 5.1 Thesis Processor Worker

**workers/thesis-processor/Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

COPY src ./src

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

USER node

EXPOSE 8080

CMD ["node", "dist/index.js"]
```

**workers/thesis-processor/deploy.sh:**
```bash
#!/bin/bash

set -e

PROJECT_ID="studia-prod"
SERVICE_NAME="thesis-worker"
REGION="us-central1"

gcloud run deploy ${SERVICE_NAME} \
  --source . \
  --platform managed \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --service-account studia-backend@${PROJECT_ID}.iam.gserviceaccount.com \
  --no-allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,PROJECT_ID=${PROJECT_ID}" \
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest,FIREBASE_ADMIN_KEY=firebase-admin-key:latest" \
  --min-instances 0 \
  --max-instances 5 \
  --cpu 4 \
  --memory 8Gi \
  --timeout 3600 \
  --concurrency 1

echo "${SERVICE_NAME} deployed!"
```

### 5.2 Podcast Generator Worker

Similar al anterior, pero con configuraciones específicas:

```bash
gcloud run deploy podcast-worker \
  --source . \
  --platform managed \
  --region us-central1 \
  --project studia-prod \
  --service-account studia-backend@studia-prod.iam.gserviceaccount.com \
  --no-allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,PROJECT_ID=studia-prod" \
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest,ELEVENLABS_API_KEY=elevenlabs-api-key:latest" \
  --min-instances 0 \
  --max-instances 3 \
  --cpu 4 \
  --memory 8Gi \
  --timeout 3600 \
  --concurrency 1
```

### 5.3 Deploy All Workers

**deploy-all-workers.sh:**
```bash
#!/bin/bash

set -e

WORKERS=(
  "thesis-processor"
  "paper-processor"
  "podcast-generator"
  "flashcard-generator"
  "quiz-generator"
)

for worker in "${WORKERS[@]}"; do
  echo "Deploying ${worker}..."
  cd workers/${worker}
  ./deploy.sh
  cd ../..
done

echo "All workers deployed!"
```

---

## 6. Deployment de Frontend

### 6.1 Build Configuration

**frontend/vite.config.ts:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth'],
          ui: ['@mui/material'],
        },
      },
    },
  },
});
```

### 6.2 Firebase Hosting

**firebase.json:**
```json
{
  "hosting": {
    "public": "frontend/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  }
}
```

### 6.3 Deploy Script

**frontend/deploy.sh:**
```bash
#!/bin/bash

set -e

echo "Building frontend..."
npm run build

echo "Deploying to Firebase Hosting..."
firebase deploy --only hosting

echo "Frontend deployed!"
```

### 6.4 Environment Variables

**frontend/.env.production:**
```bash
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=studia-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=studia-prod
VITE_FIREBASE_STORAGE_BUCKET=studia-prod.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

VITE_API_URL=https://studia-api-xxx.run.app
```

---

## 7. CI/CD Pipeline

### 7.1 Cloud Build Config

**cloudbuild.yaml:**
```yaml
steps:
  # Backend API
  - name: 'gcr.io/cloud-builders/docker'
    id: 'build-api'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/studia-api:$SHORT_SHA'
      - '-t'
      - 'gcr.io/$PROJECT_ID/studia-api:latest'
      - 'backend/'

  - name: 'gcr.io/cloud-builders/docker'
    id: 'push-api'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/studia-api:$SHORT_SHA'

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    id: 'deploy-api'
    entrypoint: 'gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'studia-api'
      - '--image'
      - 'gcr.io/$PROJECT_ID/studia-api:$SHORT_SHA'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'

  # Workers (similar para cada worker)
  - name: 'gcr.io/cloud-builders/docker'
    id: 'build-thesis-worker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/thesis-worker:$SHORT_SHA'
      - 'workers/thesis-processor/'

  # ... repeat for other workers

  # Frontend
  - name: 'node:20'
    id: 'build-frontend'
    dir: 'frontend'
    entrypoint: 'npm'
    args: ['run', 'build']
    env:
      - 'VITE_API_URL=https://studia-api-xxx.run.app'

  - name: 'gcr.io/$PROJECT_ID/firebase'
    id: 'deploy-frontend'
    dir: 'frontend'
    args:
      - 'deploy'
      - '--only'
      - 'hosting'
      - '--project'
      - '$PROJECT_ID'

timeout: '1200s'
options:
  machineType: 'E2_HIGHCPU_8'
```

### 7.2 Triggers

```bash
# Crear trigger para main branch
gcloud builds triggers create github \
  --repo-name=studia \
  --repo-owner=your-org \
  --branch-pattern=^main$ \
  --build-config=cloudbuild.yaml
```

### 7.3 GitHub Actions (Alternativa)

**.github/workflows/deploy.yml:**
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: studia-prod

      - name: Deploy API
        run: |
          cd backend
          gcloud run deploy studia-api --source .

  deploy-workers:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        worker: [thesis-processor, paper-processor, podcast-generator]
    steps:
      - uses: actions/checkout@v3

      - name: Setup Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: studia-prod

      - name: Deploy Worker
        run: |
          cd workers/${{ matrix.worker }}
          gcloud run deploy ${{ matrix.worker }}-worker --source .

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install Dependencies
        run: |
          cd frontend
          npm ci

      - name: Build
        run: |
          cd frontend
          npm run build
        env:
          VITE_API_URL: https://studia-api-xxx.run.app

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: studia-prod
```

---

## 8. Monitoring y Logging

### 8.1 Cloud Monitoring Dashboards

```bash
# Crear dashboard
gcloud monitoring dashboards create --config-from-file=dashboard.json
```

**dashboard.json:**
```json
{
  "displayName": "StudIA Production",
  "gridLayout": {
    "widgets": [
      {
        "title": "API Request Count",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"studia-api\"",
                "aggregation": {
                  "alignmentPeriod": "60s",
                  "perSeriesAligner": "ALIGN_RATE"
                }
              }
            }
          }]
        }
      }
    ]
  }
}
```

### 8.2 Alertas

```bash
# Alert para errores > 5% en 5 minutos
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="API Error Rate High" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s
```

### 8.3 Structured Logging

```typescript
// Backend logging
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Log con contexto
logger.info('Paper uploaded', {
  userId: 'user123',
  projectId: 'proj456',
  paperId: 'paper789',
  fileSize: 2048576
});
```

### 8.4 Error Reporting

Configurar Sentry o similar:

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// En error handler
app.use((err, req, res, next) => {
  Sentry.captureException(err);
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});
```

---

## 9. Costos Estimados

### 9.1 Escenario: 1000 Usuarios Activos/Mes

| Servicio | Uso Estimado | Costo Mensual |
|----------|-------------|---------------|
| **Firestore** | 10M reads, 5M writes, 10GB storage | $50 |
| **Cloud Storage** | 500GB storage, 1TB egress | $25 |
| **Cloud Run API** | 5M requests, 500 vCPU-hours, 1GB-hours | $40 |
| **Cloud Run Workers** | 1000 tasks/day, 2000 vCPU-hours | $120 |
| **Cloud Tasks** | 100K tasks | $5 |
| **Firebase Auth** | 1000 MAU | Free |
| **Firebase Hosting** | 10GB storage, 100GB transfer | $1 |
| **Secret Manager** | 10 secrets, 10K accesses | $1 |
| **Cloud Monitoring** | Basic metrics | Free |
| **OpenAI API** | 10M tokens/month | $200 |
| **TTS (Google/ElevenLabs)** | 100 hours audio | $150 |
| **Load Balancing** | 100GB egress | $20 |

**Total Estimado: ~$612/mes**

### 9.2 Optimizaciones de Costo

1. **Usar Firebase hosting CDN** (incluido gratis)
2. **Compress audios** (Opus codec, 64kbps)
3. **Cache agresivo** en Cloud CDN
4. **Scale to zero** en workers (min-instances=0)
5. **Lifecycle policies** en Cloud Storage
6. **Batch processing** para reducir Cloud Tasks calls

---

## 10. Checklist de Production

### 10.1 Security

- [ ] Firebase Security Rules configuradas
- [ ] Cloud Run services con autenticación
- [ ] CORS configurado correctamente
- [ ] Secrets en Secret Manager (no hardcoded)
- [ ] Service accounts con permisos mínimos
- [ ] HTTPS enforced en todos los servicios
- [ ] Rate limiting configurado
- [ ] Input validation en todos los endpoints

### 10.2 Performance

- [ ] Cloud CDN habilitado
- [ ] Firestore indexes creados
- [ ] Frontend bundle optimizado
- [ ] Images comprimidas
- [ ] Audio comprimido (Opus)
- [ ] Lazy loading en frontend
- [ ] Code splitting configurado

### 10.3 Reliability

- [ ] Health checks en Cloud Run
- [ ] Retry policies en Cloud Tasks
- [ ] Error boundaries en frontend
- [ ] Graceful degradation
- [ ] Backup strategy para Firestore
- [ ] Monitoring y alertas configuradas
- [ ] Incident response plan

### 10.4 Compliance

- [ ] GDPR compliance (si aplica)
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Cookie consent
- [ ] Data retention policies

### 10.5 Testing

- [ ] Unit tests (>80% coverage)
- [ ] Integration tests
- [ ] E2E tests
- [ ] Load testing
- [ ] Security testing

---

## Scripts Útiles

### Deploy Todo

**deploy-all.sh:**
```bash
#!/bin/bash

set -e

echo "Deploying backend API..."
cd backend && ./deploy.sh && cd ..

echo "Deploying workers..."
./deploy-all-workers.sh

echo "Deploying frontend..."
cd frontend && ./deploy.sh && cd ..

echo "All services deployed!"
```

### Rollback

**rollback.sh:**
```bash
#!/bin/bash

SERVICE=$1
REVISION=$2

gcloud run services update-traffic ${SERVICE} \
  --to-revisions ${REVISION}=100 \
  --region us-central1
```

### Logs en Vivo

```bash
# API logs
gcloud run services logs tail studia-api --region us-central1

# Worker logs
gcloud run services logs tail thesis-worker --region us-central1
```

---

Esta guía cubre todos los aspectos críticos para deployar StudIA en producción en Google Cloud Platform.
