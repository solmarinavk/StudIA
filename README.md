# StudIA - Plataforma de Asistencia para Investigación Académica

<div align="center">

**Ayuda inteligente para estudiantes de maestría y doctorado**

[Arquitectura](#arquitectura) • [API](#api) • [Deployment](#deployment) • [Roadmap](#roadmap)

</div>

---

## 📋 Descripción

StudIA es una plataforma web diseñada para ayudar a estudiantes de posgrado a:

1. **Analizar** su tesis y extraer referencias bibliográficas clave
2. **Descubrir** papers relevantes rankeados por importancia (PaperScope)
3. **Aprender** mediante podcasts generados automáticamente en español latino
4. **Estudiar** con flashcards académicas de nivel maestría
5. **Evaluar** su conocimiento con cuestionarios interactivos

### Stack Tecnológico

**Frontend**: React + TypeScript
**Backend**: Node.js + TypeScript
**Autenticación**: Google OAuth (Firebase Auth)
**Infraestructura**: Google Cloud Platform
- Cloud Run (API + Workers)
- Firestore (Base de datos)
- Cloud Storage (PDFs y audios)
- Cloud Tasks (Job queues)

---

## 🗂️ Documentación

Este repositorio contiene el diseño completo de la arquitectura, listo para implementación en producción.

### Documentos Principales

| Documento | Descripción | Enlace |
|-----------|-------------|--------|
| **ARCHITECTURE.md** | Arquitectura completa del sistema, modelo de datos, estructura de código | [Ver →](./ARCHITECTURE.md) |
| **API_REFERENCE.md** | Referencia rápida de todos los endpoints de la API | [Ver →](./API_REFERENCE.md) |
| **DEPLOYMENT.md** | Guía de deployment e infraestructura en GCP | [Ver →](./DEPLOYMENT.md) |
| **IMPLEMENTATION_ROADMAP.md** | Roadmap de implementación por fases con estimaciones | [Ver →](./IMPLEMENTATION_ROADMAP.md) |

---

## 🏗️ Arquitectura

### Componentes Principales

```
┌─────────────────────────────────────────────┐
│         FRONTEND (React + TS)               │
│  • Auth UI                                  │
│  • Proyectos colaborativos                  │
│  • Upload de tesis y papers                 │
│  • Biblioteca de podcasts                   │
│  • Flashcards y quizzes                     │
└─────────────────────────────────────────────┘
                    │
                    │ REST API
                    ▼
┌─────────────────────────────────────────────┐
│       API GATEWAY (Cloud Run)               │
│  • Autenticación                            │
│  • Gestión de proyectos                     │
│  • Upload management                        │
│  • Job orchestration                        │
└─────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
   ┌────────┐  ┌────────┐  ┌────────┐
   │Firestore│ │ Cloud  │  │ Cloud  │
   │         │ │Storage │  │ Tasks  │
   └────────┘  └────────┘  └────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  WORKERS (Cloud Run)  │
                    │  • PDF Processor      │
                    │  • Bibliography       │
                    │  • Podcast Generator  │
                    │  • Flashcard Gen      │
                    │  • Quiz Generator     │
                    └───────────────────────┘
```

Para más detalles, ver [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 🎯 Features Principales

### 1. Autenticación y Colaboración
- Login con cuenta Gmail (Google OAuth)
- Proyectos colaborativos con permisos (owner/editor/viewer)
- Sistema de invitaciones por email

### 2. Análisis de Tesis (PaperScope)
- Subida de PDF con progreso real
- Extracción automática de referencias bibliográficas
- Ranking de papers por:
  - Frecuencia de citación
  - Centralidad teórica
  - Aporte metodológico
  - Relevancia para la tesis
- Sistema de niveles progresivos (3 → 5 → 10 papers)

### 3. Subida de Papers
- Múltiples uploads simultáneos
- Progreso independiente por archivo
- Procesamiento asíncrono sin bloquear UI
- Resumable uploads (tus protocol)

### 4. Podcasts Académicos
- Generación automática por paper
- Formato conversacional (2 personas)
- Duración: 15-20 minutos
- Español latino
- Contenido estructurado:
  - Problema de investigación
  - Marco teórico
  - Modelos y metodología
  - Resultados
  - Conexión con la tesis
- Streaming sin recargar página

### 5. Flashcards Académicas
- Generadas automáticamente
- Nivel de dificultad: maestría
- Categorías:
  - Modelos
  - Variables clave
  - Supuestos
  - Limitaciones
  - Metodología
- Sistema de estudio espaciado (spaced repetition)

### 6. Cuestionarios Interactivos
- Generados a partir de papers
- Dificultad alta (nivel posgrado)
- Multiple choice (4 opciones)
- Respuestas correctas siempre incluidas
- Explicaciones detalladas
- Historial de intentos y scores

---

## 🔧 Modelo de Datos

### Colecciones Principales (Firestore)

```
users/
  {userId}

projects/
  {projectId}

projectMembers/
  {memberId}

thesisPDFs/
  {thesisId}

papers/
  {paperId}

podcasts/
  {podcastId}

flashcards/
  {flashcardId}

quizzes/
  {quizId}

jobs/
  {jobId}
```

Para el schema completo, ver [ARCHITECTURE.md § Modelo de Datos](./ARCHITECTURE.md#2-modelo-de-datos-firestore)

---

## 🚀 API Overview

### Endpoints Principales

| Recurso | Endpoints | Método |
|---------|-----------|--------|
| **Proyectos** | `/api/projects` | GET, POST |
| | `/api/projects/:id` | GET, PATCH, DELETE |
| **Tesis** | `/api/projects/:id/thesis/upload` | POST |
| | `/api/projects/:id/thesis/process` | POST |
| **Bibliografía** | `/api/projects/:id/bibliography/analysis` | GET |
| | `/api/projects/:id/unlock-level` | POST |
| **Papers** | `/api/projects/:id/papers/upload` | POST |
| | `/api/papers/:id` | GET, DELETE |
| **Podcasts** | `/api/papers/:id/generate-podcast` | POST |
| | `/api/podcasts/:id` | GET |
| | `/api/podcasts/:id/stream` | GET |
| **Flashcards** | `/api/papers/:id/generate-flashcards` | POST |
| | `/api/projects/:id/flashcards` | GET |
| **Quizzes** | `/api/papers/:id/generate-quiz` | POST |
| | `/api/quizzes/:id` | GET |
| | `/api/quizzes/:id/submit` | POST |
| **Jobs** | `/api/jobs/:id` | GET |

Para referencia completa, ver [API_REFERENCE.md](./API_REFERENCE.md)

---

## 📦 Estructura de Carpetas

### Frontend
```
frontend/
├── src/
│   ├── pages/          # Páginas de la app
│   ├── components/     # Componentes reutilizables
│   ├── hooks/          # Custom hooks
│   ├── services/       # API clients
│   ├── store/          # Zustand stores
│   └── types/          # TypeScript types
├── package.json
└── vite.config.ts
```

### Backend
```
backend/
├── src/
│   ├── routes/         # Express routes
│   ├── controllers/    # Request handlers
│   ├── services/       # Business logic
│   ├── workers/        # Background jobs
│   ├── middleware/     # Auth, validation, etc.
│   └── models/         # Firestore models
├── package.json
└── Dockerfile
```

### Workers
```
workers/
├── thesis-processor/
├── paper-processor/
├── podcast-generator/
├── flashcard-generator/
└── quiz-generator/
```

Para estructura completa, ver [ARCHITECTURE.md § Estructura](./ARCHITECTURE.md#3-estructura-frontend)

---

## 🔄 Procesamiento Asíncrono

### Flujo de Jobs

1. **Frontend** inicia una operación (ej: subir PDF)
2. **API** crea un Job en Firestore
3. **API** encola tarea en Cloud Tasks
4. **Worker** procesa la tarea de forma asíncrona
5. **Worker** actualiza progreso en Firestore
6. **Frontend** poll/escucha cambios en Job
7. **Frontend** actualiza UI con progreso

### Estados de Jobs

- `idle` → `uploading` → `processing` → `completed`
- O en caso de error: → `error`

### Estrategias de Confiabilidad

- ✅ **Resumable uploads** (tus protocol)
- ✅ **Estado persistente** en Firestore
- ✅ **Retry automático** con exponential backoff
- ✅ **Timeouts y heartbeats** para detectar jobs colgados
- ✅ **Notificaciones por email** cuando completa
- ✅ **Graceful degradation** en UI

Para más detalles, ver [ARCHITECTURE.md § Procesamiento Asíncrono](./ARCHITECTURE.md#6-procesamiento-asíncrono-y-jobs)

---

## 🌐 Deployment

### Servicios GCP Necesarios

- **Firebase Authentication** (Google OAuth)
- **Firestore** (Base de datos NoSQL)
- **Cloud Storage** (PDFs y audios)
- **Cloud Run** (API + Workers)
- **Cloud Tasks** (Job queues)
- **Secret Manager** (API keys)
- **Firebase Hosting** (Frontend)

### Quick Deploy

```bash
# Backend API
cd backend
./deploy.sh

# Workers
./deploy-all-workers.sh

# Frontend
cd frontend
./deploy.sh
```

Para guía completa de deployment, ver [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 📅 Roadmap de Implementación

### Estimación Total: ~5-6 meses (1 dev) | 3 meses (2 devs)

#### Fase 1-2: Fundamentos (3.5 semanas)
- Setup inicial
- Autenticación + Proyectos
- Sistema de permisos

#### Fase 3-5: Core Features (6.5 semanas)
- Upload de tesis
- Análisis de bibliografía (PaperScope)
- Upload de papers

#### Fase 6-8: Contenido Generado (6 semanas)
- Generación de podcasts
- Flashcards
- Quizzes

#### Fase 9-10: Launch (4 semanas)
- Optimización y pulido
- Beta testing
- Deploy a producción

Para roadmap completo con tareas detalladas, ver [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)

---

## 💰 Costos Estimados

**Para 1000 usuarios activos/mes:**

| Servicio | Costo/mes |
|----------|-----------|
| Firestore | $50 |
| Cloud Storage | $25 |
| Cloud Run (API + Workers) | $160 |
| OpenAI API | $200 |
| Text-to-Speech | $150 |
| Otros (Tasks, CDN, etc.) | $27 |
| **TOTAL** | **~$612/mes** |

Para desglose detallado, ver [DEPLOYMENT.md § Costos](./DEPLOYMENT.md#9-costos-estimados)

---

## 🔒 Seguridad

- ✅ **Autenticación** con Firebase (Google OAuth)
- ✅ **Autorización** basada en permisos por proyecto
- ✅ **API keys** en Secret Manager
- ✅ **CORS** configurado correctamente
- ✅ **Rate limiting** en endpoints críticos
- ✅ **Validation** de inputs con Zod
- ✅ **HTTPS** enforced en todos los servicios

---

## 📊 Monitoreo

### Métricas Clave

- API response time (p50, p95, p99)
- Error rate
- Upload success rate
- Job completion rate
- Active users
- Papers procesados
- Podcasts generados

### Herramientas

- **Cloud Monitoring** (métricas y dashboards)
- **Cloud Logging** (logs estructurados)
- **Sentry** (error tracking - opcional)
- **Cloud Alerting** (alertas automáticas)

---

## 🧪 Testing

### Coverage Objetivo

- **Unit tests**: >80% coverage
- **Integration tests**: Flujos críticos
- **E2E tests**: Happy paths principales
- **Load testing**: 1000 concurrent users

### Herramientas

- **Vitest** (frontend unit tests)
- **Jest** (backend unit tests)
- **Playwright** (E2E tests)
- **k6** (load testing)

---

## 📝 Próximos Pasos

1. ✅ **Diseño completo** (este repositorio)
2. ⏭️ **POC técnico** (validar stack con feature simple)
3. ⏭️ **Setup inicial** (GCP project, Firebase, repos)
4. ⏭️ **Fase 1** (Auth + Proyectos)
5. ⏭️ **Iteración continua** con releases semanales

---

## 🤝 Contribución

Este es un proyecto de diseño arquitectónico. Para implementación:

1. Fork el repositorio
2. Crear branch de feature
3. Implementar según especificaciones
4. Abrir PR con descripción detallada

---

## 📄 Licencia

TBD

---

## 📞 Contacto

Para preguntas sobre el diseño o implementación, abrir un issue en este repositorio.

---

<div align="center">

**Diseñado para producción | Listo para implementar**

</div>
