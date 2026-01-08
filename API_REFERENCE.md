# StudIA - API Reference Quick Guide

## Base URL
```
Production: https://api.studia.app
Development: http://localhost:3000
```

## Autenticación

Todas las requests (excepto `/auth/*`) requieren header de autenticación:

```
Authorization: Bearer {firebase_id_token}
```

---

## Endpoints por Recurso

### 🔐 Autenticación

| Method | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/verify-token` | Verificar token de Firebase |

---

### 📁 Proyectos

| Method | Endpoint | Descripción | Permisos |
|--------|----------|-------------|----------|
| GET | `/api/projects` | Listar proyectos del usuario | - |
| POST | `/api/projects` | Crear nuevo proyecto | - |
| GET | `/api/projects/:projectId` | Obtener detalles de proyecto | viewer+ |
| PATCH | `/api/projects/:projectId` | Actualizar proyecto | editor+ |
| DELETE | `/api/projects/:projectId` | Eliminar proyecto | owner |
| POST | `/api/projects/:projectId/invite` | Invitar miembro | editor+ |
| GET | `/api/projects/:projectId/members` | Listar miembros | viewer+ |
| DELETE | `/api/projects/:projectId/members/:userId` | Remover miembro | owner |

---

### 📄 Tesis (PDF Principal)

| Method | Endpoint | Descripción | Permisos |
|--------|----------|-------------|----------|
| POST | `/api/projects/:projectId/thesis/upload` | Iniciar subida de PDF | editor+ |
| GET | `/api/projects/:projectId/thesis` | Obtener estado de tesis | viewer+ |
| POST | `/api/projects/:projectId/thesis/:thesisId/upload-complete` | Completar upload | editor+ |
| POST | `/api/projects/:projectId/thesis/process` | Iniciar procesamiento | editor+ |
| DELETE | `/api/projects/:projectId/thesis/:thesisId` | Eliminar tesis | owner |

---

### 📚 Análisis de Bibliografía (PaperScope)

| Method | Endpoint | Descripción | Permisos |
|--------|----------|-------------|----------|
| GET | `/api/projects/:projectId/bibliography/analysis` | Obtener resultados | viewer+ |
| POST | `/api/projects/:projectId/unlock-level` | Desbloquear nivel | editor+ |

---

### 📑 Papers

| Method | Endpoint | Descripción | Permisos |
|--------|----------|-------------|----------|
| POST | `/api/projects/:projectId/papers/upload` | Subir paper | editor+ |
| GET | `/api/projects/:projectId/papers` | Listar papers | viewer+ |
| GET | `/api/papers/:paperId` | Obtener detalles | viewer+ |
| PATCH | `/api/papers/:paperId` | Actualizar metadata | editor+ |
| DELETE | `/api/papers/:paperId` | Eliminar paper | editor+ |
| POST | `/api/papers/:paperId/upload-complete` | Completar upload | editor+ |

---

### 🎙️ Podcasts

| Method | Endpoint | Descripción | Permisos |
|--------|----------|-------------|----------|
| POST | `/api/papers/:paperId/generate-podcast` | Generar podcast | editor+ |
| GET | `/api/projects/:projectId/podcasts` | Listar podcasts | viewer+ |
| GET | `/api/podcasts/:podcastId` | Obtener detalles | viewer+ |
| GET | `/api/podcasts/:podcastId/stream` | Stream de audio | viewer+ |
| DELETE | `/api/podcasts/:podcastId` | Eliminar podcast | editor+ |

---

### 🗂️ Flashcards

| Method | Endpoint | Descripción | Permisos |
|--------|----------|-------------|----------|
| POST | `/api/papers/:paperId/generate-flashcards` | Generar flashcards | editor+ |
| GET | `/api/projects/:projectId/flashcards` | Listar flashcards | viewer+ |
| GET | `/api/flashcards/:flashcardId` | Obtener detalles | viewer+ |
| POST | `/api/flashcards/:flashcardId/study` | Registrar estudio | viewer+ |
| DELETE | `/api/flashcards/:flashcardId` | Eliminar flashcard | editor+ |

---

### ❓ Quizzes

| Method | Endpoint | Descripción | Permisos |
|--------|----------|-------------|----------|
| POST | `/api/papers/:paperId/generate-quiz` | Generar quiz | editor+ |
| GET | `/api/projects/:projectId/quizzes` | Listar quizzes | viewer+ |
| GET | `/api/quizzes/:quizId` | Obtener quiz completo | viewer+ |
| POST | `/api/quizzes/:quizId/submit` | Enviar respuestas | viewer+ |
| GET | `/api/quizzes/:quizId/attempts` | Ver intentos previos | viewer+ |
| DELETE | `/api/quizzes/:quizId` | Eliminar quiz | editor+ |

---

### ⚙️ Jobs

| Method | Endpoint | Descripción | Permisos |
|--------|----------|-------------|----------|
| GET | `/api/jobs/:jobId` | Obtener estado de job | viewer+ |
| POST | `/api/jobs/:jobId/cancel` | Cancelar job | editor+ |
| GET | `/api/projects/:projectId/jobs` | Listar jobs del proyecto | viewer+ |

---

### 📧 Invitaciones

| Method | Endpoint | Descripción | Permisos |
|--------|----------|-------------|----------|
| GET | `/api/invitations` | Listar invitaciones pendientes | - |
| POST | `/api/invitations/:token/accept` | Aceptar invitación | - |
| POST | `/api/invitations/:token/reject` | Rechazar invitación | - |

---

## Códigos de Estado HTTP

| Código | Significado |
|--------|-------------|
| 200 | OK - Request exitoso |
| 201 | Created - Recurso creado |
| 204 | No Content - Exitoso sin contenido |
| 400 | Bad Request - Request inválido |
| 401 | Unauthorized - Token inválido/expirado |
| 403 | Forbidden - Sin permisos |
| 404 | Not Found - Recurso no existe |
| 409 | Conflict - Conflicto (ej: email duplicado) |
| 429 | Too Many Requests - Rate limit excedido |
| 500 | Internal Server Error - Error del servidor |
| 503 | Service Unavailable - Servicio no disponible |

---

## Tipos de Jobs

| Tipo | Descripción | Duración Estimada |
|------|-------------|-------------------|
| `thesis-upload` | Subida de PDF de tesis | 1-5 min |
| `thesis-processing` | Extracción de texto y metadata | 2-10 min |
| `bibliography-analysis` | Análisis y ranking de referencias | 5-15 min |
| `paper-upload` | Subida de paper | 30s-3 min |
| `paper-processing` | Extracción de texto del paper | 1-5 min |
| `podcast-generation` | Generación de podcast (script + audio) | 10-30 min |
| `flashcard-generation` | Generación de flashcards | 2-5 min |
| `quiz-generation` | Generación de cuestionario | 3-7 min |

---

## Estados de Jobs

| Estado | Descripción |
|--------|-------------|
| `idle` | Inicial, antes de comenzar |
| `pending` | En cola, esperando procesamiento |
| `running` | En ejecución |
| `completed` | Completado exitosamente |
| `failed` | Falló con error |
| `cancelled` | Cancelado por usuario |

---

## Formato de Errores

```typescript
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "No tienes permisos para realizar esta acción",
    "details": {
      "requiredRole": "editor",
      "currentRole": "viewer"
    }
  }
}
```

### Códigos de Error Comunes

| Código | Descripción |
|--------|-------------|
| `INVALID_TOKEN` | Token de autenticación inválido |
| `PERMISSION_DENIED` | Sin permisos suficientes |
| `RESOURCE_NOT_FOUND` | Recurso no encontrado |
| `UPLOAD_FAILED` | Error en subida de archivo |
| `PROCESSING_FAILED` | Error en procesamiento |
| `INVALID_FILE_TYPE` | Tipo de archivo no permitido |
| `FILE_TOO_LARGE` | Archivo excede tamaño máximo |
| `RATE_LIMIT_EXCEEDED` | Límite de requests excedido |
| `PROJECT_LIMIT_REACHED` | Límite de proyectos alcanzado |
| `INVALID_INVITATION` | Token de invitación inválido |

---

## Rate Limits

| Endpoint | Límite |
|----------|--------|
| `POST /api/projects` | 10 proyectos / 24 horas |
| `POST /api/*/upload` | 20 uploads / 15 minutos |
| `POST /api/*/generate-*` | 50 generaciones / hora |
| Otros endpoints | 1000 requests / hora |

---

## Webhooks (Interno - Workers a API)

### POST /api/webhooks/job-update

Usado por workers para actualizar estado de jobs.

**Headers:**
```
X-Webhook-Secret: {secret_from_env}
```

**Request:**
```typescript
{
  jobId: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  error?: {
    message: string;
    code: string;
  };
  result?: any;
}
```

---

## Paginación

Para endpoints que retornan listas largas:

**Query params:**
```
?limit=20&offset=0
```

**Response:**
```typescript
{
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }
}
```

---

## Filtros Comunes

### GET /api/projects/:projectId/papers

**Query params:**
```
?level=1              # Filtrar por nivel (1, 2, 3)
?status=completed     # Filtrar por estado
?sort=rank            # Ordenar por: rank, uploadedAt, title
?order=asc            # Orden: asc, desc
```

### GET /api/projects/:projectId/flashcards

**Query params:**
```
?paperId=xxx          # Filtrar por paper
?category=model       # Filtrar por categoría
```

---

## Upload Flow (tus protocol)

### 1. Iniciar Upload
```http
POST /api/projects/:projectId/papers/upload
Content-Type: application/json

{
  "fileName": "paper.pdf",
  "fileSize": 2048576,
  "paperId": "optional-paper-id"
}
```

**Response:**
```json
{
  "paper": {
    "id": "paper123",
    "uploadStatus": "uploading",
    "uploadJobId": "job456"
  },
  "uploadUrl": "https://storage.googleapis.com/..."
}
```

### 2. Upload con tus
```javascript
const upload = new tus.Upload(file, {
  endpoint: uploadUrl,
  onProgress: (bytes, total) => {
    console.log(bytes, total);
  }
});
upload.start();
```

### 3. Completar Upload
```http
POST /api/papers/:paperId/upload-complete
```

### 4. Poll Job Status
```http
GET /api/jobs/:jobId

Response:
{
  "job": {
    "status": "running",
    "progress": 45
  }
}
```

---

## Ejemplos de Uso

### Crear Proyecto y Subir Tesis

```typescript
// 1. Crear proyecto
const { project } = await api.post('/api/projects', {
  title: 'Mi Tesis de Maestría',
  description: 'Análisis econométrico...'
});

// 2. Subir PDF de tesis
const { uploadUrl, thesisPDF } = await api.post(
  `/api/projects/${project.id}/thesis/upload`,
  formData
);

// 3. Upload con tus
const upload = new tus.Upload(pdfFile, {
  endpoint: uploadUrl,
  onSuccess: async () => {
    // 4. Completar upload
    await api.post(`/api/projects/${project.id}/thesis/${thesisPDF.id}/upload-complete`);

    // 5. Iniciar procesamiento
    const { job } = await api.post(`/api/projects/${project.id}/thesis/process`);

    // 6. Poll status
    const interval = setInterval(async () => {
      const { job: updatedJob } = await api.get(`/api/jobs/${job.id}`);

      if (updatedJob.status === 'completed') {
        clearInterval(interval);
        console.log('¡Procesamiento completo!');
      }
    }, 3000);
  }
});

upload.start();
```

### Generar Podcast para Paper

```typescript
// 1. Generar podcast
const { job } = await api.post(`/api/papers/${paperId}/generate-podcast`);

// 2. Poll hasta completar
await pollUntilComplete(job.id);

// 3. Obtener podcast
const { podcast } = await api.get(`/api/papers/${paperId}/podcast`);

// 4. Stream audio
const audioUrl = `/api/podcasts/${podcast.id}/stream`;
```

### Realizar Quiz

```typescript
// 1. Obtener quiz
const { quiz } = await api.get(`/api/quizzes/${quizId}`);

// 2. Usuario responde preguntas
const answers = quiz.questions.map((q, i) => ({
  questionId: q.id,
  selectedAnswerIndex: userAnswers[i],
  timeSpent: timings[i]
}));

// 3. Enviar respuestas
const { attempt } = await api.post(`/api/quizzes/${quizId}/submit`, {
  answers,
  timeSpent: totalTime
});

// 4. Ver resultados
console.log(`Score: ${attempt.score}%`);
console.log(`Correctas: ${attempt.correctAnswers}/${attempt.totalQuestions}`);
```

---

## WebSocket (Opcional - Real-time)

Si se implementa WebSocket para updates en tiempo real:

### Conectar
```typescript
const socket = io('wss://api.studia.app', {
  auth: {
    token: firebaseToken
  }
});
```

### Suscribirse a Proyecto
```typescript
socket.emit('subscribe', { projectId });

socket.on('job:update', (data) => {
  console.log('Job updated:', data);
});

socket.on('paper:processed', (data) => {
  console.log('Paper processed:', data);
});

socket.on('podcast:ready', (data) => {
  console.log('Podcast ready:', data);
});
```

---

## Mejores Prácticas

### 1. Siempre Manejar Errores
```typescript
try {
  const result = await api.post('/api/projects', data);
} catch (error) {
  if (error.response?.status === 401) {
    // Renovar token
  } else if (error.response?.status === 429) {
    // Rate limited
  } else {
    // Otro error
  }
}
```

### 2. Usar React Query para Cache
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['projects', projectId],
  queryFn: () => api.get(`/api/projects/${projectId}`),
  staleTime: 5 * 60 * 1000, // 5 minutos
});
```

### 3. Optimistic Updates
```typescript
const mutation = useMutation({
  mutationFn: updateProject,
  onMutate: async (newData) => {
    // Cancelar queries en progreso
    await queryClient.cancelQueries(['projects', projectId]);

    // Snapshot del valor anterior
    const previous = queryClient.getQueryData(['projects', projectId]);

    // Actualizar optimísticamente
    queryClient.setQueryData(['projects', projectId], newData);

    return { previous };
  },
  onError: (err, variables, context) => {
    // Revertir en caso de error
    queryClient.setQueryData(['projects', projectId], context.previous);
  },
});
```

### 4. Retry con Backoff
```typescript
const { data } = useQuery({
  queryKey: ['job', jobId],
  queryFn: () => api.get(`/api/jobs/${jobId}`),
  retry: 3,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});
```

---

Esta guía de referencia rápida cubre todos los endpoints principales y patrones de uso de la API de StudIA.
