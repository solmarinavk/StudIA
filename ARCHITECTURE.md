# StudIA - Arquitectura Completa del Sistema

## Tabla de Contenidos
1. [Arquitectura General del Sistema](#1-arquitectura-general-del-sistema)
2. [Modelo de Datos (Firestore)](#2-modelo-de-datos-firestore)
3. [Estructura Frontend](#3-estructura-frontend)
4. [Estructura Backend](#4-estructura-backend)
5. [Diseño de APIs](#5-diseño-de-apis)
6. [Procesamiento Asíncrono y Jobs](#6-procesamiento-asíncrono-y-jobs)
7. [Estrategias de Confiabilidad](#7-estrategias-de-confiabilidad)

---

## 1. Arquitectura General del Sistema

### 1.1 Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Auth UI    │  │  Projects    │  │   Papers     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Podcasts   │  │  Flashcards  │  │    Quizzes   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS / REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API GATEWAY (Cloud Run)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Auth Routes │  │ Project APIs │  │  Upload APIs │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   Firestore  │  │Cloud Storage │  │  Cloud Tasks │
    │              │  │              │  │   (Queue)    │
    │  - Users     │  │  - PDFs      │  │              │
    │  - Projects  │  │  - Audios    │  │  - Jobs DB   │
    │  - Papers    │  │              │  │              │
    │  - Podcasts  │  └──────────────┘  └──────────────┘
    │  - Flashcards│           │                 │
    │  - Quizzes   │           │                 │
    └──────────────┘           │                 │
                               │                 ▼
                               │      ┌──────────────────────┐
                               │      │  Worker Services     │
                               │      │   (Cloud Run)        │
                               │      │                      │
                               │      │  - PDF Processor     │
                               └─────►│  - Bibliography      │
                                      │    Analyzer          │
                                      │  - Podcast Generator │
                                      │  - Flashcard Gen     │
                                      │  - Quiz Generator    │
                                      └──────────────────────┘
                                               │
                                               ▼
                                      ┌──────────────────────┐
                                      │   External APIs      │
                                      │                      │
                                      │  - OpenAI / Gemini   │
                                      │  - Text-to-Speech    │
                                      │  - PDF Parser        │
                                      └──────────────────────┘
```

### 1.2 Componentes Principales

#### Frontend (React + TypeScript)
- **SPA** con React Router
- **State Management**: React Query + Zustand
- **UI**: Material-UI / shadcn/ui
- **Autenticación**: Firebase Auth (Google OAuth)
- **Upload**: tus-js-client para resumable uploads
- **Audio Streaming**: HTML5 Audio API

#### Backend API (Cloud Run)
- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express.js
- **Autenticación**: Firebase Admin SDK
- **Validación**: Zod
- **Rate Limiting**: express-rate-limit
- **CORS**: configurado para frontend domain

#### Workers (Cloud Run)
- **Servicios independientes** para procesamiento pesado
- **Comunicación**: HTTP + Cloud Tasks
- **Timeout**: configurado para procesos largos (60+ minutos)

#### Storage
- **Firestore**: Base de datos principal (metadata, estados, permisos)
- **Cloud Storage**: PDFs y archivos de audio
- **Cloud Tasks**: Queue para jobs asíncronos

---

## 2. Modelo de Datos (Firestore)

### 2.1 Colección: `users`

```typescript
interface User {
  uid: string;                    // ID de Firebase Auth
  email: string;                  // Gmail del usuario
  displayName: string;            // Nombre completo
  photoURL?: string;              // URL de foto de perfil
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}
```

**Documento ID**: `{firebase_uid}`

---

### 2.2 Colección: `projects`

```typescript
interface Project {
  id: string;                     // Auto-generado
  title: string;                  // Nombre de la tesis
  description?: string;           // Descripción breve
  ownerId: string;                // uid del creador
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Análisis
  bibliographyAnalysisStatus: JobStatus;
  currentLevel: 0 | 1 | 2 | 3;   // Nivel desbloqueado (0 = no iniciado)
}

type JobStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
```

**Documento ID**: `{auto_generated}`

---

### 2.3 Colección: `projectMembers`

```typescript
interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  invitedBy: string;              // userId del invitador
  status: 'pending' | 'accepted' | 'rejected';
  invitedAt: Timestamp;
  acceptedAt?: Timestamp;
}
```

**Documento ID**: `{auto_generated}`
**Índices compuestos**:
- `projectId + userId` (unique)
- `userId + status`

---

### 2.4 Colección: `thesisPDFs`

```typescript
interface ThesisPDF {
  id: string;
  projectId: string;
  fileName: string;
  fileSize: number;               // bytes
  mimeType: string;

  // Storage
  storagePath: string;            // gs://bucket/path
  storageUrl: string;             // URL firmada temporal

  // Estado de procesamiento
  uploadStatus: JobStatus;
  uploadProgress: number;         // 0-100
  uploadJobId?: string;

  processingStatus: JobStatus;
  processingJobId?: string;
  processingError?: string;

  // Metadata extraída
  extractedText?: string;
  pageCount?: number;
  references?: Reference[];       // Referencias extraídas

  uploadedBy: string;             // userId
  uploadedAt: Timestamp;
  processedAt?: Timestamp;
}

interface Reference {
  rawText: string;
  authors?: string[];
  title?: string;
  year?: number;
  venue?: string;
  doi?: string;
}
```

**Documento ID**: `{auto_generated}`
**Índices**: `projectId`

---

### 2.5 Colección: `papers`

```typescript
interface Paper {
  id: string;
  projectId: string;

  // Ranking desde PaperScope
  rank: number;                   // Posición en el ranking
  level: 1 | 2 | 3;              // Nivel al que pertenece

  // Metadata del paper
  title: string;
  authors: string[];
  year?: number;
  doi?: string;
  abstract?: string;

  // Scores de ranking
  citationFrequency: number;      // Frecuencia de citación
  theoreticalCentrality: number;  // Centralidad teórica
  methodologicalContribution: number;
  thesisRelevance: number;
  overallScore: number;           // Score combinado

  // PDF
  fileName: string;
  fileSize: number;
  storagePath: string;
  storageUrl: string;

  // Estado de subida y procesamiento
  uploadStatus: JobStatus;
  uploadProgress: number;
  uploadJobId?: string;

  processingStatus: JobStatus;
  processingJobId?: string;
  processingError?: string;

  extractedText?: string;
  pageCount?: number;

  // Contenido generado
  podcastStatus: JobStatus;
  podcastJobId?: string;
  podcastId?: string;             // Referencia a colección podcasts

  flashcardsStatus: JobStatus;
  flashcardsJobId?: string;
  flashcardsGenerated: boolean;

  quizStatus: JobStatus;
  quizJobId?: string;
  quizId?: string;                // Referencia a colección quizzes

  uploadedBy: string;
  uploadedAt: Timestamp;
  processedAt?: Timestamp;
}
```

**Documento ID**: `{auto_generated}`
**Índices compuestos**:
- `projectId + level + rank`
- `projectId + uploadStatus`

---

### 2.6 Colección: `podcasts`

```typescript
interface Podcast {
  id: string;
  paperId: string;
  projectId: string;

  // Metadata
  title: string;                  // Título del paper
  description: string;
  duration: number;               // segundos
  language: 'es-LA';

  // Audio
  audioFileName: string;
  audioStoragePath: string;
  audioUrl: string;               // URL firmada o pública
  audioSize: number;              // bytes

  // Generación
  generationStatus: JobStatus;
  generationJobId?: string;
  generationError?: string;

  // Contenido del podcast
  script?: {
    sections: PodcastSection[];
    speakers: ['Speaker1', 'Speaker2'];
  };

  // Metadata
  level: 1 | 2 | 3;
  createdBy: string;
  createdAt: Timestamp;
  generatedAt?: Timestamp;

  // Reproducción
  playCount: number;
  lastPlayedAt?: Timestamp;
}

interface PodcastSection {
  type: 'intro' | 'research-problem' | 'theoretical-framework' |
        'models' | 'methodology' | 'results' | 'thesis-connection' | 'outro';
  speaker: 'Speaker1' | 'Speaker2';
  text: string;
  startTime: number;              // segundos desde inicio
  duration: number;
}
```

**Documento ID**: `{auto_generated}`
**Índices**: `projectId`, `paperId`

---

### 2.7 Colección: `flashcards`

```typescript
interface Flashcard {
  id: string;
  paperId: string;
  projectId: string;

  // Contenido
  front: string;                  // Pregunta/concepto
  back: string;                   // Respuesta/explicación

  // Categoría
  category: 'model' | 'variable' | 'assumption' | 'limitation' | 'methodology';

  // Dificultad
  difficulty: 'graduate';         // Siempre nivel maestría

  // Metadata del paper
  paperTitle: string;
  level: 1 | 2 | 3;

  // Estudio espaciado
  studyStats?: {
    timesStudied: number;
    correctCount: number;
    incorrectCount: number;
    lastStudiedAt?: Timestamp;
    nextReviewAt?: Timestamp;
    easeFactor: number;           // Para SM-2 algorithm
  };

  createdAt: Timestamp;
}
```

**Documento ID**: `{auto_generated}`
**Índices compuestos**:
- `projectId + category`
- `projectId + paperId`

---

### 2.8 Colección: `quizzes`

```typescript
interface Quiz {
  id: string;
  paperId: string;
  projectId: string;

  // Metadata
  title: string;
  description: string;
  paperTitle: string;
  level: 1 | 2 | 3;
  difficulty: 'high';             // Siempre dificultad alta
  language: 'es-LA';

  // Preguntas
  questions: QuizQuestion[];
  totalQuestions: number;

  // Generación
  generationStatus: JobStatus;
  generationJobId?: string;

  createdAt: Timestamp;
  generatedAt?: Timestamp;
}

interface QuizQuestion {
  id: string;
  questionText: string;
  options: string[];              // 4 opciones
  correctAnswerIndex: number;     // 0-3
  explanation: string;            // Explicación de la respuesta correcta
  category: 'theory' | 'methodology' | 'results' | 'interpretation' | 'limitations';
  points: number;                 // peso de la pregunta
}
```

**Documento ID**: `{auto_generated}`
**Índices**: `projectId`, `paperId`

---

### 2.9 Colección: `quizAttempts`

```typescript
interface QuizAttempt {
  id: string;
  quizId: string;
  projectId: string;
  userId: string;

  // Respuestas
  answers: {
    questionId: string;
    selectedAnswerIndex: number;
    isCorrect: boolean;
    timeSpent: number;            // segundos
  }[];

  // Resultados
  score: number;                  // 0-100
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: number;              // segundos totales

  startedAt: Timestamp;
  completedAt: Timestamp;
}
```

**Documento ID**: `{auto_generated}`
**Índices compuestos**: `userId + quizId`, `projectId + userId`

---

### 2.10 Colección: `jobs`

```typescript
interface Job {
  id: string;

  // Tipo de job
  type: 'thesis-upload' | 'thesis-processing' | 'bibliography-analysis' |
        'paper-upload' | 'paper-processing' | 'podcast-generation' |
        'flashcard-generation' | 'quiz-generation';

  // Referencias
  projectId: string;
  paperId?: string;
  thesisPDFId?: string;
  userId: string;                 // quien inició el job

  // Estado
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;               // 0-100

  // Timing
  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;

  // Error handling
  error?: {
    message: string;
    code: string;
    stack?: string;
  };

  retryCount: number;
  maxRetries: number;

  // Cloud Tasks
  taskName?: string;              // Nombre de la tarea en Cloud Tasks

  // Resultado
  result?: any;                   // Output del job (flexible)

  // Metadata
  metadata?: {
    fileSize?: number;
    duration?: number;
    [key: string]: any;
  };
}
```

**Documento ID**: `{auto_generated}`
**Índices compuestos**:
- `projectId + type + status`
- `userId + status`
- `status + createdAt`

---

### 2.11 Colección: `invitations`

```typescript
interface Invitation {
  id: string;
  projectId: string;
  invitedEmail: string;           // Email del invitado
  invitedUserId?: string;         // Si ya tiene cuenta
  invitedBy: string;              // userId del invitador
  role: 'editor' | 'viewer';

  status: 'pending' | 'accepted' | 'rejected' | 'expired';

  token: string;                  // Token único para aceptar invitación
  expiresAt: Timestamp;

  createdAt: Timestamp;
  respondedAt?: Timestamp;
}
```

**Documento ID**: `{auto_generated}`
**Índices**: `invitedEmail + status`, `token`

---

## 3. Estructura Frontend

### 3.1 Árbol de Carpetas

```
frontend/
├── public/
│   ├── index.html
│   └── assets/
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # App component + Router
│   ├── vite-env.d.ts
│   │
│   ├── config/
│   │   ├── firebase.ts             # Firebase config
│   │   └── api.ts                  # API base URL, axios config
│   │
│   ├── routes/
│   │   └── index.tsx               # Route definitions
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── AuthCallback.tsx
│   │   │
│   │   ├── projects/
│   │   │   ├── ProjectsListPage.tsx
│   │   │   ├── CreateProjectPage.tsx
│   │   │   └── ProjectDashboard.tsx
│   │   │
│   │   ├── thesis/
│   │   │   └── ThesisUploadPage.tsx
│   │   │
│   │   ├── bibliography/
│   │   │   ├── BibliographyAnalysisPage.tsx
│   │   │   └── PaperSelectionPage.tsx
│   │   │
│   │   ├── papers/
│   │   │   └── PapersUploadPage.tsx
│   │   │
│   │   ├── podcasts/
│   │   │   ├── PodcastsLibraryPage.tsx
│   │   │   └── PodcastPlayerPage.tsx
│   │   │
│   │   ├── flashcards/
│   │   │   └── FlashcardsStudyPage.tsx
│   │   │
│   │   └── quizzes/
│   │       ├── QuizzesListPage.tsx
│   │       └── QuizTakePage.tsx
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   │
│   │   ├── auth/
│   │   │   ├── GoogleLoginButton.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── UserMenu.tsx
│   │   │
│   │   ├── projects/
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── ProjectMembersList.tsx
│   │   │   ├── InviteMemberDialog.tsx
│   │   │   └── ProjectPermissionBadge.tsx
│   │   │
│   │   ├── thesis/
│   │   │   ├── ThesisUploader.tsx
│   │   │   ├── UploadProgressCard.tsx
│   │   │   └── ProcessingStatusCard.tsx
│   │   │
│   │   ├── bibliography/
│   │   │   ├── PaperRankingList.tsx
│   │   │   ├── PaperCard.tsx
│   │   │   ├── LevelSelector.tsx
│   │   │   └── RankingCriteria.tsx
│   │   │
│   │   ├── papers/
│   │   │   ├── MultiPaperUploader.tsx
│   │   │   ├── PaperUploadCard.tsx
│   │   │   └── IndependentProgressBar.tsx
│   │   │
│   │   ├── podcasts/
│   │   │   ├── PodcastCard.tsx
│   │   │   ├── PodcastPlayer.tsx
│   │   │   ├── AudioWaveform.tsx
│   │   │   └── PodcastQueue.tsx
│   │   │
│   │   ├── flashcards/
│   │   │   ├── FlashcardComponent.tsx
│   │   │   ├── FlashcardDeck.tsx
│   │   │   ├── StudySession.tsx
│   │   │   └── FlashcardStats.tsx
│   │   │
│   │   ├── quizzes/
│   │   │   ├── QuizCard.tsx
│   │   │   ├── QuizQuestion.tsx
│   │   │   ├── QuizResults.tsx
│   │   │   └── QuizTimer.tsx
│   │   │
│   │   ├── common/
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── ErrorAlert.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   └── EmptyState.tsx
│   │   │
│   │   └── ui/                     # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── progress.tsx
│   │       └── ...
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useProjects.ts
│   │   ├── useThesisUpload.ts
│   │   ├── usePaperUpload.ts
│   │   ├── usePodcastPlayer.ts
│   │   ├── useJobStatus.ts         # Polling de jobs
│   │   ├── useWebSocket.ts         # Real-time updates (opcional)
│   │   └── useResumableUpload.ts   # tus protocol
│   │
│   ├── services/
│   │   ├── api/
│   │   │   ├── auth.api.ts
│   │   │   ├── projects.api.ts
│   │   │   ├── thesis.api.ts
│   │   │   ├── papers.api.ts
│   │   │   ├── podcasts.api.ts
│   │   │   ├── flashcards.api.ts
│   │   │   ├── quizzes.api.ts
│   │   │   └── jobs.api.ts
│   │   │
│   │   ├── upload/
│   │   │   ├── resumableUpload.ts  # tus client
│   │   │   └── uploadManager.ts    # Coordinación de uploads
│   │   │
│   │   └── audio/
│   │       └── audioPlayer.ts
│   │
│   ├── store/
│   │   ├── authStore.ts            # Zustand: auth state
│   │   ├── projectStore.ts         # Zustand: current project
│   │   └── uploadStore.ts          # Zustand: upload states
│   │
│   ├── types/
│   │   ├── api.types.ts
│   │   ├── project.types.ts
│   │   ├── paper.types.ts
│   │   ├── podcast.types.ts
│   │   ├── flashcard.types.ts
│   │   └── quiz.types.ts
│   │
│   ├── utils/
│   │   ├── formatters.ts           # Date, size, duration formatters
│   │   ├── validators.ts
│   │   └── constants.ts
│   │
│   └── styles/
│       ├── globals.css
│       └── themes.ts
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

### 3.2 Estado Global (Zustand)

```typescript
// store/authStore.ts
interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
}

// store/projectStore.ts
interface ProjectState {
  currentProject: Project | null;
  userRole: 'owner' | 'editor' | 'viewer' | null;

  setCurrentProject: (project: Project, role: string) => void;
  clearCurrentProject: () => void;
}

// store/uploadStore.ts
interface UploadState {
  uploads: Record<string, UploadProgress>;

  addUpload: (id: string, file: File) => void;
  updateProgress: (id: string, progress: number) => void;
  completeUpload: (id: string) => void;
  failUpload: (id: string, error: string) => void;
  removeUpload: (id: string) => void;
}

interface UploadProgress {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}
```

### 3.3 React Query Keys

```typescript
// services/api/queryKeys.ts
export const queryKeys = {
  auth: {
    currentUser: ['auth', 'currentUser'],
  },
  projects: {
    all: ['projects'],
    detail: (id: string) => ['projects', id],
    members: (id: string) => ['projects', id, 'members'],
  },
  thesis: {
    byProject: (projectId: string) => ['thesis', projectId],
  },
  papers: {
    byProject: (projectId: string) => ['papers', projectId],
    byLevel: (projectId: string, level: number) => ['papers', projectId, 'level', level],
  },
  podcasts: {
    byProject: (projectId: string) => ['podcasts', projectId],
    detail: (id: string) => ['podcasts', id],
  },
  flashcards: {
    byProject: (projectId: string) => ['flashcards', projectId],
    byPaper: (paperId: string) => ['flashcards', 'paper', paperId],
  },
  quizzes: {
    byProject: (projectId: string) => ['quizzes', projectId],
    detail: (id: string) => ['quizzes', id],
  },
  jobs: {
    detail: (id: string) => ['jobs', id],
  },
};
```

---

## 4. Estructura Backend

### 4.1 Árbol de Carpetas

```
backend/
├── src/
│   ├── index.ts                    # Entry point (API server)
│   │
│   ├── config/
│   │   ├── firebase.ts             # Firebase Admin SDK
│   │   ├── storage.ts              # Cloud Storage
│   │   ├── tasks.ts                # Cloud Tasks client
│   │   └── env.ts                  # Environment variables
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts      # Verificar Firebase token
│   │   ├── errorHandler.middleware.ts
│   │   ├── validation.middleware.ts
│   │   └── rateLimiter.middleware.ts
│   │
│   ├── routes/
│   │   ├── index.ts                # Route aggregator
│   │   ├── auth.routes.ts
│   │   ├── projects.routes.ts
│   │   ├── thesis.routes.ts
│   │   ├── papers.routes.ts
│   │   ├── podcasts.routes.ts
│   │   ├── flashcards.routes.ts
│   │   ├── quizzes.routes.ts
│   │   └── jobs.routes.ts
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── projects.controller.ts
│   │   ├── thesis.controller.ts
│   │   ├── papers.controller.ts
│   │   ├── podcasts.controller.ts
│   │   ├── flashcards.controller.ts
│   │   ├── quizzes.controller.ts
│   │   └── jobs.controller.ts
│   │
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── projects.service.ts
│   │   ├── permissions.service.ts  # Validar permisos
│   │   ├── thesis.service.ts
│   │   ├── papers.service.ts
│   │   ├── podcasts.service.ts
│   │   ├── flashcards.service.ts
│   │   ├── quizzes.service.ts
│   │   ├── jobs.service.ts         # Crear y gestionar jobs
│   │   ├── storage.service.ts      # Upload a Cloud Storage
│   │   └── notifications.service.ts # Email notifications
│   │
│   ├── workers/                    # Workers para Cloud Run
│   │   ├── thesis/
│   │   │   ├── thesisProcessor.worker.ts
│   │   │   └── bibliographyAnalyzer.worker.ts
│   │   │
│   │   ├── papers/
│   │   │   └── paperProcessor.worker.ts
│   │   │
│   │   ├── podcasts/
│   │   │   └── podcastGenerator.worker.ts
│   │   │
│   │   ├── flashcards/
│   │   │   └── flashcardGenerator.worker.ts
│   │   │
│   │   └── quizzes/
│   │       └── quizGenerator.worker.ts
│   │
│   ├── lib/
│   │   ├── pdf/
│   │   │   ├── pdfParser.ts        # PDF.js o similar
│   │   │   └── referenceExtractor.ts
│   │   │
│   │   ├── ai/
│   │   │   ├── openai.client.ts    # OpenAI SDK
│   │   │   ├── gemini.client.ts    # Gemini SDK
│   │   │   └── prompts/            # Prompts templates
│   │   │       ├── podcast.prompts.ts
│   │   │       ├── flashcard.prompts.ts
│   │   │       └── quiz.prompts.ts
│   │   │
│   │   ├── tts/
│   │   │   └── textToSpeech.ts     # Google TTS o ElevenLabs
│   │   │
│   │   └── queue/
│   │       ├── taskQueue.ts        # Cloud Tasks wrapper
│   │       └── jobProcessor.ts     # Base job processor
│   │
│   ├── models/                     # Firestore models
│   │   ├── User.model.ts
│   │   ├── Project.model.ts
│   │   ├── Paper.model.ts
│   │   ├── Podcast.model.ts
│   │   ├── Flashcard.model.ts
│   │   ├── Quiz.model.ts
│   │   └── Job.model.ts
│   │
│   ├── types/
│   │   ├── api.types.ts
│   │   ├── job.types.ts
│   │   └── worker.types.ts
│   │
│   ├── utils/
│   │   ├── logger.ts               # Winston o Pino
│   │   ├── validators.ts           # Zod schemas
│   │   └── errors.ts               # Custom error classes
│   │
│   └── scripts/
│       ├── deploy-api.sh
│       └── deploy-workers.sh
│
├── package.json
├── tsconfig.json
├── Dockerfile                      # Para Cloud Run
└── .env.example
```

### 4.2 Servicios Worker (Separados)

Cada worker es un servicio de Cloud Run independiente:

```
workers/
├── thesis-processor/
│   ├── src/
│   │   ├── index.ts                # Worker HTTP endpoint
│   │   ├── processor.ts
│   │   └── bibliographyAnalyzer.ts
│   ├── Dockerfile
│   └── package.json
│
├── paper-processor/
│   ├── src/
│   │   ├── index.ts
│   │   └── processor.ts
│   ├── Dockerfile
│   └── package.json
│
├── podcast-generator/
│   ├── src/
│   │   ├── index.ts
│   │   ├── generator.ts
│   │   ├── scriptWriter.ts
│   │   └── audioSynthesizer.ts
│   ├── Dockerfile
│   └── package.json
│
├── flashcard-generator/
│   ├── src/
│   │   ├── index.ts
│   │   └── generator.ts
│   ├── Dockerfile
│   └── package.json
│
└── quiz-generator/
    ├── src/
    │   ├── index.ts
    │   └── generator.ts
    ├── Dockerfile
    └── package.json
```

---

## 5. Diseño de APIs

### 5.1 Autenticación

#### POST /api/auth/verify-token
Verifica token de Firebase

**Request:**
```typescript
{
  idToken: string;
}
```

**Response:**
```typescript
{
  user: {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
  }
}
```

---

### 5.2 Proyectos

#### GET /api/projects
Lista proyectos del usuario

**Headers:**
```
Authorization: Bearer {firebase_token}
```

**Response:**
```typescript
{
  projects: Array<{
    id: string;
    title: string;
    description?: string;
    ownerId: string;
    role: 'owner' | 'editor' | 'viewer';
    currentLevel: number;
    createdAt: string;
    updatedAt: string;
  }>
}
```

---

#### POST /api/projects
Crear nuevo proyecto

**Request:**
```typescript
{
  title: string;
  description?: string;
}
```

**Response:**
```typescript
{
  project: {
    id: string;
    title: string;
    description?: string;
    ownerId: string;
    currentLevel: 0;
    createdAt: string;
    updatedAt: string;
  }
}
```

---

#### GET /api/projects/:projectId
Obtener detalles de proyecto

**Response:**
```typescript
{
  project: Project;
  userRole: 'owner' | 'editor' | 'viewer';
  members: Array<{
    userId: string;
    email: string;
    displayName: string;
    role: 'owner' | 'editor' | 'viewer';
    joinedAt: string;
  }>;
}
```

---

#### POST /api/projects/:projectId/invite
Invitar miembro

**Request:**
```typescript
{
  email: string;          // Gmail del invitado
  role: 'editor' | 'viewer';
}
```

**Response:**
```typescript
{
  invitation: {
    id: string;
    projectId: string;
    invitedEmail: string;
    role: string;
    status: 'pending';
    expiresAt: string;
  }
}
```

---

#### POST /api/invitations/:token/accept
Aceptar invitación

**Response:**
```typescript
{
  projectMember: {
    projectId: string;
    userId: string;
    role: string;
    acceptedAt: string;
  }
}
```

---

### 5.3 Subida de Tesis

#### POST /api/projects/:projectId/thesis/upload
Iniciar subida de PDF de tesis

**Request (multipart/form-data):**
```typescript
{
  file: File;             // PDF file
}
```

**Response:**
```typescript
{
  thesisPDF: {
    id: string;
    projectId: string;
    fileName: string;
    fileSize: number;
    uploadStatus: 'uploading';
    uploadProgress: 0;
    uploadJobId: string;
  };
  uploadUrl: string;      // URL firmada para tus upload
}
```

---

#### GET /api/projects/:projectId/thesis
Obtener estado de tesis

**Response:**
```typescript
{
  thesisPDF: {
    id: string;
    fileName: string;
    uploadStatus: JobStatus;
    uploadProgress: number;
    processingStatus: JobStatus;
    pageCount?: number;
    processedAt?: string;
  } | null;
}
```

---

#### POST /api/projects/:projectId/thesis/process
Iniciar procesamiento (extracción + análisis)

**Response:**
```typescript
{
  job: {
    id: string;
    type: 'bibliography-analysis';
    status: 'pending';
    progress: 0;
  }
}
```

---

### 5.4 Análisis de Bibliografía (PaperScope)

#### GET /api/projects/:projectId/bibliography/analysis
Obtener resultados del análisis

**Response:**
```typescript
{
  status: JobStatus;
  progress: number;
  results?: {
    totalReferences: number;
    rankedPapers: Array<{
      rank: number;
      level: 1 | 2 | 3;
      title: string;
      authors: string[];
      year?: number;
      citationFrequency: number;
      theoreticalCentrality: number;
      methodologicalContribution: number;
      thesisRelevance: number;
      overallScore: number;
    }>;
  };
}
```

---

#### POST /api/projects/:projectId/unlock-level
Desbloquear siguiente nivel

**Request:**
```typescript
{
  level: 1 | 2 | 3;
}
```

**Response:**
```typescript
{
  currentLevel: number;
  unlockedPapers: Paper[];
}
```

---

### 5.5 Subida de Papers

#### POST /api/projects/:projectId/papers/upload
Subir un paper (llamada independiente por cada paper)

**Request (multipart/form-data):**
```typescript
{
  file: File;
  paperId: string;        // ID del paper del ranking (opcional)
  level: 1 | 2 | 3;
}
```

**Response:**
```typescript
{
  paper: {
    id: string;
    fileName: string;
    uploadStatus: 'uploading';
    uploadProgress: 0;
    uploadJobId: string;
    level: number;
  };
  uploadUrl: string;
}
```

---

#### GET /api/projects/:projectId/papers
Listar papers

**Query params:**
```typescript
{
  level?: 1 | 2 | 3;
  status?: JobStatus;
}
```

**Response:**
```typescript
{
  papers: Array<{
    id: string;
    title: string;
    fileName: string;
    uploadStatus: JobStatus;
    uploadProgress: number;
    processingStatus: JobStatus;
    podcastStatus: JobStatus;
    flashcardsGenerated: boolean;
    quizStatus: JobStatus;
    level: number;
    rank: number;
    uploadedAt: string;
  }>;
}
```

---

#### GET /api/papers/:paperId
Obtener detalles de paper

**Response:**
```typescript
{
  paper: Paper;
}
```

---

### 5.6 Podcasts

#### POST /api/papers/:paperId/generate-podcast
Iniciar generación de podcast

**Response:**
```typescript
{
  job: {
    id: string;
    type: 'podcast-generation';
    status: 'pending';
    progress: 0;
  }
}
```

---

#### GET /api/projects/:projectId/podcasts
Listar podcasts

**Response:**
```typescript
{
  podcasts: Array<{
    id: string;
    paperId: string;
    title: string;
    duration: number;
    audioUrl: string;
    level: number;
    generationStatus: JobStatus;
    createdAt: string;
  }>;
}
```

---

#### GET /api/podcasts/:podcastId
Obtener podcast

**Response:**
```typescript
{
  podcast: {
    id: string;
    title: string;
    description: string;
    duration: number;
    audioUrl: string;        // URL firmada o pública para streaming
    script?: {
      sections: PodcastSection[];
    };
    level: number;
  }
}
```

---

#### GET /api/podcasts/:podcastId/stream
Endpoint para streaming de audio

**Response:**
- Content-Type: audio/mpeg
- Accept-Ranges: bytes
- Content-Length: {size}
- Stream del archivo de audio

---

### 5.7 Flashcards

#### POST /api/papers/:paperId/generate-flashcards
Generar flashcards

**Response:**
```typescript
{
  job: {
    id: string;
    type: 'flashcard-generation';
    status: 'pending';
  }
}
```

---

#### GET /api/projects/:projectId/flashcards
Listar flashcards

**Query params:**
```typescript
{
  paperId?: string;
  category?: 'model' | 'variable' | 'assumption' | 'limitation' | 'methodology';
}
```

**Response:**
```typescript
{
  flashcards: Array<{
    id: string;
    paperId: string;
    paperTitle: string;
    front: string;
    back: string;
    category: string;
    level: number;
    studyStats?: {
      timesStudied: number;
      correctCount: number;
      nextReviewAt?: string;
    };
  }>;
}
```

---

#### POST /api/flashcards/:flashcardId/study
Registrar estudio de flashcard

**Request:**
```typescript
{
  correct: boolean;
}
```

**Response:**
```typescript
{
  flashcard: Flashcard;  // Con studyStats actualizado
}
```

---

### 5.8 Quizzes

#### POST /api/papers/:paperId/generate-quiz
Generar cuestionario

**Response:**
```typescript
{
  job: {
    id: string;
    type: 'quiz-generation';
    status: 'pending';
  }
}
```

---

#### GET /api/projects/:projectId/quizzes
Listar quizzes

**Response:**
```typescript
{
  quizzes: Array<{
    id: string;
    paperId: string;
    title: string;
    paperTitle: string;
    totalQuestions: number;
    level: number;
    generationStatus: JobStatus;
    createdAt: string;
  }>;
}
```

---

#### GET /api/quizzes/:quizId
Obtener quiz completo

**Response:**
```typescript
{
  quiz: {
    id: string;
    title: string;
    description: string;
    paperTitle: string;
    level: number;
    questions: Array<{
      id: string;
      questionText: string;
      options: string[];
      correctAnswerIndex: number;    // SIEMPRE incluido
      explanation: string;
      category: string;
    }>;
  }
}
```

---

#### POST /api/quizzes/:quizId/submit
Enviar respuestas

**Request:**
```typescript
{
  answers: Array<{
    questionId: string;
    selectedAnswerIndex: number;
    timeSpent: number;
  }>;
  timeSpent: number;          // Total
}
```

**Response:**
```typescript
{
  attempt: {
    id: string;
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    answers: Array<{
      questionId: string;
      selectedAnswerIndex: number;
      isCorrect: boolean;
      correctAnswerIndex: number;
      explanation: string;
    }>;
  }
}
```

---

### 5.9 Jobs

#### GET /api/jobs/:jobId
Obtener estado de job

**Response:**
```typescript
{
  job: {
    id: string;
    type: string;
    status: JobStatus;
    progress: number;
    error?: {
      message: string;
      code: string;
    };
    result?: any;
    createdAt: string;
    completedAt?: string;
  }
}
```

---

#### POST /api/jobs/:jobId/cancel
Cancelar job

**Response:**
```typescript
{
  job: {
    id: string;
    status: 'cancelled';
  }
}
```

---

### 5.10 Webhooks (Internal)

#### POST /api/webhooks/job-update
Webhook para workers (actualizar estado de job)

**Request:**
```typescript
{
  jobId: string;
  status: JobStatus;
  progress: number;
  error?: {
    message: string;
    code: string;
  };
  result?: any;
}
```

**Response:**
```typescript
{
  success: boolean;
}
```

---

## 6. Procesamiento Asíncrono y Jobs

### 6.1 Arquitectura de Jobs

```
┌─────────────────────────────────────────────────────────────┐
│                        API Server                           │
│                                                             │
│  1. Usuario sube PDF                                        │
│  2. API crea Job en Firestore                              │
│  3. API crea Task en Cloud Tasks                           │
│  4. API devuelve jobId al cliente                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Cloud Tasks enqueue
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Cloud Tasks Queue                      │
│                                                             │
│  - thesis-processing-queue                                  │
│  - paper-processing-queue                                   │
│  - podcast-generation-queue                                 │
│  - flashcard-generation-queue                               │
│  - quiz-generation-queue                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP POST
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Worker Services                         │
│                     (Cloud Run)                             │
│                                                             │
│  1. Recibe tarea                                            │
│  2. Actualiza Job.status = 'running'                       │
│  3. Procesa (con actualizaciones de progreso)              │
│  4. Guarda resultado                                        │
│  5. Actualiza Job.status = 'completed'                     │
│  6. (Opcional) Webhook a API                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Firestore onSnapshot
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│                                                             │
│  1. Poll /api/jobs/:jobId cada 2-5 segundos                │
│  2. O escucha real-time via Firestore SDK                  │
│  3. Actualiza UI con progreso                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Flujo de Upload + Processing

#### Ejemplo: Subida de Paper

**1. Frontend inicia upload**
```typescript
// Frontend
const uploadPaper = async (file: File, paperId: string) => {
  // Paso 1: Iniciar upload (obtener URL firmada)
  const { uploadUrl, paper } = await api.post(`/papers/upload`, {
    fileName: file.name,
    fileSize: file.size,
    paperId: paperId,
  });

  // Paso 2: Upload con tus-js-client (resumable)
  const upload = new tus.Upload(file, {
    endpoint: uploadUrl,
    onProgress: (bytesUploaded, bytesTotal) => {
      const progress = (bytesUploaded / bytesTotal) * 100;
      updateUploadProgress(paper.id, progress);
    },
    onSuccess: () => {
      // Paso 3: Notificar al backend que upload completó
      api.post(`/papers/${paper.id}/upload-complete`);
    },
    onError: (error) => {
      handleUploadError(paper.id, error);
    },
  });

  upload.start();

  // Paso 4: Poll job status
  pollJobStatus(paper.uploadJobId);
};
```

**2. Backend crea job**
```typescript
// Backend API
async function initiateUpload(req, res) {
  const { fileName, fileSize, paperId } = req.body;
  const { projectId } = req.params;
  const userId = req.user.uid;

  // Crear Paper en Firestore
  const paper = await db.collection('papers').add({
    projectId,
    fileName,
    fileSize,
    uploadStatus: 'uploading',
    uploadProgress: 0,
    uploadedBy: userId,
    uploadedAt: FieldValue.serverTimestamp(),
  });

  // Crear Job
  const job = await db.collection('jobs').add({
    type: 'paper-upload',
    projectId,
    paperId: paper.id,
    userId,
    status: 'pending',
    progress: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Update paper con jobId
  await paper.update({ uploadJobId: job.id });

  // Generar URL firmada para Cloud Storage
  const bucket = storage.bucket('studia-papers');
  const filePath = `projects/${projectId}/papers/${paper.id}/${fileName}`;
  const [uploadUrl] = await bucket.file(filePath).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 60 * 60 * 1000, // 1 hora
    contentType: 'application/pdf',
  });

  res.json({
    paper: paper.data(),
    uploadUrl,
  });
}
```

**3. Frontend completa upload**
```typescript
// Backend API
async function uploadComplete(req, res) {
  const { paperId } = req.params;

  // Update paper status
  await db.collection('papers').doc(paperId).update({
    uploadStatus: 'processing',
    uploadProgress: 100,
  });

  // Crear tarea en Cloud Tasks para procesamiento
  const task = {
    httpRequest: {
      httpMethod: 'POST',
      url: 'https://paper-processor-xxxx.run.app/process',
      headers: {
        'Content-Type': 'application/json',
      },
      body: Buffer.from(JSON.stringify({
        paperId,
        jobId: paper.uploadJobId,
      })).toString('base64'),
    },
  };

  await cloudTasksClient.createTask({
    parent: queuePath,
    task,
  });

  res.json({ success: true });
}
```

**4. Worker procesa paper**
```typescript
// Worker (Cloud Run)
app.post('/process', async (req, res) => {
  const { paperId, jobId } = req.body;

  try {
    // Actualizar job
    await db.collection('jobs').doc(jobId).update({
      status: 'running',
      startedAt: FieldValue.serverTimestamp(),
    });

    // Paso 1: Extraer texto del PDF (10%)
    await updateJobProgress(jobId, 10);
    const paper = await db.collection('papers').doc(paperId).get();
    const pdfBuffer = await downloadFromStorage(paper.data().storagePath);
    const extractedText = await extractTextFromPDF(pdfBuffer);

    // Paso 2: Analizar contenido (30%)
    await updateJobProgress(jobId, 30);
    const analysis = await analyzePaperContent(extractedText);

    // Paso 3: Extraer metadata (50%)
    await updateJobProgress(jobId, 50);
    const metadata = await extractMetadata(extractedText);

    // Paso 4: Guardar en Firestore (70%)
    await updateJobProgress(jobId, 70);
    await db.collection('papers').doc(paperId).update({
      extractedText,
      processingStatus: 'completed',
      pageCount: analysis.pageCount,
      ...metadata,
      processedAt: FieldValue.serverTimestamp(),
    });

    // Paso 5: Iniciar generación de podcast automáticamente (opcional)
    await updateJobProgress(jobId, 90);
    await createPodcastGenerationJob(paperId);

    // Completar job
    await db.collection('jobs').doc(jobId).update({
      status: 'completed',
      progress: 100,
      completedAt: FieldValue.serverTimestamp(),
      result: { paperId },
    });

    res.status(200).json({ success: true });

  } catch (error) {
    // Manejar error
    await db.collection('jobs').doc(jobId).update({
      status: 'failed',
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
      },
      completedAt: FieldValue.serverTimestamp(),
    });

    await db.collection('papers').doc(paperId).update({
      processingStatus: 'error',
      processingError: error.message,
    });

    res.status(500).json({ error: error.message });
  }
});

async function updateJobProgress(jobId: string, progress: number) {
  await db.collection('jobs').doc(jobId).update({ progress });
}
```

**5. Frontend recibe actualizaciones**
```typescript
// Frontend - Polling approach
const pollJobStatus = (jobId: string) => {
  const interval = setInterval(async () => {
    const job = await api.get(`/jobs/${jobId}`);

    updateUploadStore(job);

    if (job.status === 'completed' || job.status === 'failed') {
      clearInterval(interval);

      if (job.status === 'completed') {
        showSuccessNotification('Paper procesado exitosamente');
        refetchPapers();
      } else {
        showErrorNotification(job.error.message);
      }
    }
  }, 3000); // Poll cada 3 segundos
};

// Alternativa: Real-time con Firestore SDK
const subscribeToJobUpdates = (jobId: string) => {
  return db.collection('jobs').doc(jobId).onSnapshot((snapshot) => {
    const job = snapshot.data();

    updateUploadStore(job);

    if (job.status === 'completed' || job.status === 'failed') {
      // Handle completion
    }
  });
};
```

### 6.3 Gestión de Múltiples Uploads Concurrentes

```typescript
// Frontend - Upload Manager
class UploadManager {
  private uploads: Map<string, tus.Upload> = new Map();
  private maxConcurrent = 3;
  private queue: Array<{ file: File; paperId: string }> = [];

  async addUpload(file: File, paperId: string) {
    if (this.uploads.size >= this.maxConcurrent) {
      this.queue.push({ file, paperId });
      return;
    }

    await this.startUpload(file, paperId);
  }

  private async startUpload(file: File, paperId: string) {
    const { uploadUrl, paper } = await api.post('/papers/upload', {
      fileName: file.name,
      fileSize: file.size,
      paperId,
    });

    const upload = new tus.Upload(file, {
      endpoint: uploadUrl,
      retryDelays: [0, 3000, 5000, 10000],
      onProgress: (bytesUploaded, bytesTotal) => {
        const progress = (bytesUploaded / bytesTotal) * 100;
        uploadStore.updateProgress(paper.id, progress);
      },
      onSuccess: async () => {
        await api.post(`/papers/${paper.id}/upload-complete`);
        this.uploads.delete(paper.id);
        this.processQueue();
      },
      onError: (error) => {
        uploadStore.failUpload(paper.id, error.message);
        this.uploads.delete(paper.id);
        this.processQueue();
      },
    });

    this.uploads.set(paper.id, upload);
    upload.start();
  }

  private processQueue() {
    if (this.queue.length > 0 && this.uploads.size < this.maxConcurrent) {
      const next = this.queue.shift()!;
      this.startUpload(next.file, next.paperId);
    }
  }

  pauseUpload(paperId: string) {
    const upload = this.uploads.get(paperId);
    if (upload) {
      upload.abort();
    }
  }

  resumeUpload(paperId: string) {
    const upload = this.uploads.get(paperId);
    if (upload) {
      upload.start();
    }
  }
}
```

### 6.4 Retry Strategy

```typescript
// Backend - Job Retry Logic
interface RetryConfig {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
}

const JOB_RETRY_CONFIG: Record<string, RetryConfig> = {
  'paper-processing': {
    maxRetries: 3,
    backoffMultiplier: 2,
    initialDelay: 5000,
  },
  'podcast-generation': {
    maxRetries: 5,
    backoffMultiplier: 3,
    initialDelay: 10000,
  },
};

async function retryJob(jobId: string) {
  const job = await getJob(jobId);
  const config = JOB_RETRY_CONFIG[job.type];

  if (job.retryCount >= config.maxRetries) {
    await db.collection('jobs').doc(jobId).update({
      status: 'failed',
      error: {
        message: 'Max retries exceeded',
        code: 'MAX_RETRIES_EXCEEDED',
      },
    });
    return;
  }

  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, job.retryCount);

  await db.collection('jobs').doc(jobId).update({
    status: 'pending',
    retryCount: job.retryCount + 1,
  });

  // Re-enqueue con delay
  await enqueueTask(job.type, {
    jobId,
    ...job.metadata,
  }, delay);
}
```

---

## 7. Estrategias de Confiabilidad

### 7.1 Evitar Loading Infinito

#### Problema
El frontend se queda esperando respuesta infinitamente cuando un proceso falla sin notificar.

#### Solución

**1. Timeouts en Frontend**
```typescript
// Hook personalizado
function useJobWithTimeout(jobId: string, timeoutMs: number = 300000) { // 5 min
  const [job, setJob] = useState<Job | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setTimedOut(true);
    }, timeoutMs);

    const unsubscribe = pollJob(jobId, (updatedJob) => {
      setJob(updatedJob);

      if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
        clearTimeout(timeout);
      }
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [jobId, timeoutMs]);

  return { job, timedOut };
}
```

**2. Health Checks en Workers**
```typescript
// Worker heartbeat
async function processWithHeartbeat(jobId: string, processor: () => Promise<void>) {
  const heartbeatInterval = setInterval(async () => {
    await db.collection('jobs').doc(jobId).update({
      lastHeartbeat: FieldValue.serverTimestamp(),
    });
  }, 30000); // Cada 30 segundos

  try {
    await processor();
  } finally {
    clearInterval(heartbeatInterval);
  }
}

// Cron job para detectar jobs colgados
async function detectStalledJobs() {
  const fiveMinutesAgo = Timestamp.fromDate(new Date(Date.now() - 5 * 60 * 1000));

  const stalledJobs = await db.collection('jobs')
    .where('status', '==', 'running')
    .where('lastHeartbeat', '<', fiveMinutesAgo)
    .get();

  for (const doc of stalledJobs.docs) {
    await retryJob(doc.id);
  }
}
```

**3. Graceful Degradation en UI**
```typescript
// Componente que muestra estado
function ProcessingStatus({ jobId }: { jobId: string }) {
  const { job, timedOut } = useJobWithTimeout(jobId);

  if (timedOut) {
    return (
      <Alert severity="warning">
        El procesamiento está tardando más de lo esperado.
        Puedes cerrar esta ventana, te notificaremos cuando complete.
        <Button onClick={() => enableNotifications(jobId)}>
          Notificarme
        </Button>
      </Alert>
    );
  }

  if (!job) return <Spinner />;

  if (job.status === 'failed') {
    return (
      <Alert severity="error">
        Error: {job.error.message}
        <Button onClick={() => retryJob(jobId)}>Reintentar</Button>
      </Alert>
    );
  }

  return <ProgressBar value={job.progress} />;
}
```

### 7.2 Persistencia de Progreso

#### Problema
Usuario cierra la ventana durante un upload/procesamiento y pierde todo el progreso.

#### Solución

**1. Resumable Uploads (tus protocol)**
```typescript
// tus automáticamente guarda progreso en localStorage
const upload = new tus.Upload(file, {
  endpoint: uploadUrl,
  resume: true,  // Habilitar resume
  removeFingerprintOnSuccess: true,

  // tus guarda fingerprint en localStorage
  fingerprint: (file) => {
    return Promise.resolve(
      `studia-upload-${projectId}-${file.name}-${file.size}`
    );
  },
});

// Al recargar la página, tus automáticamente resume
```

**2. Estado Persistente en Backend**
```typescript
// Todos los estados viven en Firestore
// Frontend puede recuperar estado en cualquier momento

async function recoverPendingUploads(userId: string) {
  const pendingJobs = await db.collection('jobs')
    .where('userId', '==', userId)
    .where('status', 'in', ['pending', 'running'])
    .where('createdAt', '>', thirtyMinutesAgo)
    .get();

  return pendingJobs.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
}

// Frontend al cargar
useEffect(() => {
  const pending = await recoverPendingUploads(currentUser.uid);

  pending.forEach(job => {
    // Reanudar polling o mostrar en UI
    pollJobStatus(job.id);
  });
}, [currentUser]);
```

**3. Notificaciones por Email**
```typescript
// Backend - al completar job
async function onJobComplete(job: Job) {
  const user = await getUser(job.userId);
  const project = await getProject(job.projectId);

  await sendEmail({
    to: user.email,
    subject: `[StudIA] ${getJobTypeLabel(job.type)} completado`,
    html: `
      <h1>Tu ${getJobTypeLabel(job.type)} ha sido completado</h1>
      <p>Proyecto: ${project.title}</p>
      <a href="${getFrontendUrl()}/projects/${project.id}">
        Ver resultados
      </a>
    `,
  });
}
```

### 7.3 Manejo de Errores Granular

#### Problema
Un error en un componente rompe toda la aplicación.

#### Solución

**1. Error Boundaries**
```typescript
// ErrorBoundary component
class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          resetError={() => this.setState({ hasError: false })}
        />
      );
    }

    return this.props.children;
  }
}

// Uso en páginas críticas
function PapersUploadPage() {
  return (
    <ErrorBoundary>
      <MultiPaperUploader />
    </ErrorBoundary>
  );
}
```

**2. Errores con Contexto**
```typescript
// Custom error classes
class StudiaError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'StudiaError';
  }
}

class UploadError extends StudiaError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'UPLOAD_ERROR', 500, context);
    this.name = 'UploadError';
  }
}

// Uso
throw new UploadError('Failed to upload paper', {
  paperId: paper.id,
  fileName: file.name,
  fileSize: file.size,
});
```

**3. Error Recovery UI**
```typescript
function UploadCard({ upload }: { upload: UploadProgress }) {
  const [retrying, setRetrying] = useState(false);

  if (upload.status === 'error') {
    return (
      <Card>
        <Alert severity="error">
          <AlertTitle>Error al subir {upload.fileName}</AlertTitle>
          {upload.error}
        </Alert>

        <Button
          onClick={async () => {
            setRetrying(true);
            await retryUpload(upload.id);
            setRetrying(false);
          }}
          disabled={retrying}
        >
          {retrying ? 'Reintentando...' : 'Reintentar'}
        </Button>

        <Button onClick={() => removeUpload(upload.id)}>
          Cancelar
        </Button>
      </Card>
    );
  }

  return <NormalUploadCard upload={upload} />;
}
```

### 7.4 Rate Limiting y Throttling

#### Problema
Usuario sube 50 papers simultáneamente, satura el sistema.

#### Solución

**1. Frontend Queue**
```typescript
// Ya mostrado en UploadManager
// Limitar a 3 uploads concurrentes
```

**2. Backend Rate Limiting**
```typescript
import rateLimit from 'express-rate-limit';

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 uploads por ventana
  message: 'Demasiados uploads, intenta de nuevo en 15 minutos',
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/papers/upload', uploadLimiter, uploadController);
```

**3. Cloud Tasks Queue Config**
```typescript
// Configuración de Cloud Tasks
const queueConfig = {
  name: 'paper-processing-queue',
  rateLimits: {
    maxConcurrentDispatches: 10,
    maxDispatchesPerSecond: 5,
  },
  retryConfig: {
    maxAttempts: 5,
    maxBackoff: '3600s',
    minBackoff: '10s',
  },
};
```

### 7.5 Monitoreo y Observabilidad

```typescript
// Logger estructurado
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'studia-api' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

// Uso en endpoints
app.post('/api/papers/upload', async (req, res) => {
  logger.info('Upload initiated', {
    userId: req.user.uid,
    projectId: req.params.projectId,
    fileName: req.body.fileName,
    fileSize: req.body.fileSize,
  });

  try {
    // ... process upload

    logger.info('Upload successful', { paperId: paper.id });
    res.json({ paper });
  } catch (error) {
    logger.error('Upload failed', {
      error: error.message,
      stack: error.stack,
      userId: req.user.uid,
    });

    res.status(500).json({ error: error.message });
  }
});

// Métricas con OpenTelemetry o Cloud Monitoring
import { metric } from '@google-cloud/monitoring';

async function recordUploadMetric(size: number, duration: number) {
  await metric.write({
    name: 'paper_upload_size',
    value: size,
    labels: { unit: 'bytes' },
  });

  await metric.write({
    name: 'paper_upload_duration',
    value: duration,
    labels: { unit: 'ms' },
  });
}
```

---

## Resumen de Decisiones Arquitectónicas

### Frontend
- **React + TypeScript**: Tipado fuerte, ecosistema maduro
- **React Query**: Cache, refetch automático, optimistic updates
- **Zustand**: Estado global ligero sin boilerplate
- **tus-js-client**: Uploads resumables estándar
- **Firebase Auth SDK**: Integración directa con Google OAuth

### Backend
- **Cloud Run**: Auto-scaling, pay-per-use, soporte para long-running tasks
- **Express.js**: Framework minimalista, fácil de extender
- **Firestore**: NoSQL flexible, real-time updates, fácil sincronización con frontend
- **Cloud Storage**: Storage escalable, URLs firmadas, integración nativa
- **Cloud Tasks**: Queue confiable, retry automático, rate limiting built-in

### Procesamiento
- **Workers separados**: Aislamiento, escalado independiente, timeouts configurables
- **Jobs en Firestore**: Estado persistente, fácil de consultar, real-time updates
- **Polling + Real-time**: Combinación para máxima confiabilidad

### Confiabilidad
- **Resumable uploads**: Nunca perder progreso
- **Job persistence**: Estado siempre recuperable
- **Error boundaries**: Failures aislados
- **Timeouts y heartbeats**: Detectar procesos colgados
- **Retry strategies**: Exponential backoff
- **Notifications**: Email cuando completa

---

Este diseño está listo para implementación en producción con alta confiabilidad, buena UX, y escalabilidad horizontal.
