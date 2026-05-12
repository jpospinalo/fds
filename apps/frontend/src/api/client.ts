import axios from "axios";

// Local dev: vacío → Vite proxy enruta a localhost:8000
// Producción: VITE_API_URL=http://ec2-xxx:8000 se inyecta en el build
const BASE_URL = import.meta.env.VITE_API_URL ?? "";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 
    "Content-Type": "application/json" 
  },
});

// Opcional: Interceptor para debugging rápido
api.interceptors.request.use((config) => {
  console.log(`🚀 Request enviada a: ${config.baseURL}${config.url}`);
  return config;
});
// ── Tipos compartidos ──────────────────────────────────────────────────────────

export type SeccionEstado = "presente" | "incompleta" | "no_presente" | "sin_auditoria";

export interface DocumentInfo {
  doc_id: string;
  year?: number;
  secciones_disponibles: number[];
  total_chunks: number;
  secciones_estado: Record<string, SeccionEstado>;
}

export interface SearchResult {
  texto: string;
  metadatos: Record<string, unknown>;
}

export interface SearchResponse {
  query: string;
  resultados: SearchResult[];
  total: number;
}

export interface AuditItemResult {
  item: string;
  calidad: string;      // "Confiable" | "Conf_CR" | "NO_Conf"
  presencia: string;    // "Presente" | "No_Presente"
  observaciones?: string;
}

export interface AuditSectionResult {
  seccion: number;
  puntaje_bruto?: number;
  puntaje_porcentual?: number;
  items: AuditItemResult[];
  raw_text: string;
}

export interface AuditChanges {
  added: Array<{ seccion: number; item: string }>;
  removed: Array<{ seccion: number; item: string }>;
  status_changed: Array<{ seccion: number; item: string; before: string; after: string }>;
  note?: string;
}

export interface AuditResponse {
  doc_id: string;
  status: string;       // "completed" | "running" | "error"
  secciones: AuditSectionResult[];
  reporte_txt?: string;
  reporte_csv?: string;
  detail?: string;
  changes?: AuditChanges;
}

export interface PipelineJob {
  job_id: string;
  doc_id: string;
  status: "running" | "completed" | "error";
  progress: number;
  message: string;
  markdown?: string;
  secciones?: Record<number, string | null>;
  secciones_encontradas?: number;
}

// ── Funciones de API ───────────────────────────────────────────────────────────

export const fetchDocuments = () =>
  api.get<DocumentInfo[]>("/api/documents/").then((r) => r.data);

export const fetchSectionContent = (docId: string, seccion: number, year?: number) =>
  api
    .get<{ doc_id: string; seccion: number; contenido: string }>(
      `/api/documents/${encodeURIComponent(docId)}/section/${seccion}${year ? `?year=${year}` : ""}`
    )
    .then((r) => r.data);

export const semanticSearch = (payload: {
  query: string;
  doc_id?: string;
  num_seccion?: number;
  top_k?: number;
}) =>
  api
    .post<SearchResponse>("/api/search/", payload)
    .then((r) => r.data);

export const checkAuditExists = (docId: string) =>
  api
    .get<{ exists: boolean; created_at: string | null; updated_at: string | null }>(
      `/api/audit/${encodeURIComponent(docId)}/exists`
    )
    .then((r) => r.data);

export const runAudit = (docId: string, force = false) =>
  api
    .post<{ status: string; doc_id: string; message: string }>(
      `/api/audit/${encodeURIComponent(docId)}${force ? "?force=true" : ""}`
    )
    .then((r) => r.data);

export const getAuditResults = (docId: string) =>
  api
    .get<AuditResponse>(`/api/audit/${encodeURIComponent(docId)}/results`)
    .then((r) => r.data);

export const convertTxtToMd = (texto: string, nombre?: string) =>
  api
    .post<{ markdown: string; nombre_archivo: string }>("/api/convert/", {
      texto,
      nombre_archivo: nombre,
    })
    .then((r) => r.data);

export const uploadPdf = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post<{ job_id: string; doc_id: string; status: string }>(
      "/pipeline/upload",
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    )
    .then((r) => r.data);
};

export const getJobStatus = (jobId: string) =>
  api
    .get<PipelineJob>(`/pipeline/${jobId}/status`)
    .then((r) => r.data);

export interface MetricsSectionData {
  seccion: number;
  nombre: string;
  puntaje_promedio: number | null;
  tasa_presencia: number | null;
  docs_auditados: number;
}

export interface MetricsData {
  generated_at: string;
  resumen: {
    total_auditados: number;
    con_error: number;
    corriendo: number;
  };
  calidad: {
    puntaje_promedio_global: number | null;
    tasa_presencia_global: number | null;
    items_presentes: number;
    items_ausentes: number;
    total_items: number;
  };
  por_seccion: MetricsSectionData[];
  documentos_recientes: Array<{
    doc_id: string;
    created_at: string;
    updated_at: string | null;
    puntaje_global: number | null;
  }>;
  items_mas_ausentes: Array<{
    item: string;
    ausencias: number;
    total: number;
    tasa_ausencia: number;
  }>;
}

export const fetchMetrics = () =>
  api.get<MetricsData>("/api/metrics/").then((r) => r.data);

// ── Auditoría Masiva ───────────────────────────────────────────────────────────

export interface RateLimitStatus {
  rpm: { actual: number; limite: number; pct: number };
  rpd: { actual: number; limite: number; limite_real: number; restante: number; pct: number };
  tpm: { actual: number; limite: number; pct: number };
  docs_restantes_hoy: number;
  nivel: "normal" | "advertencia" | "bloqueado";
  mensaje: string;
}

export interface BatchResultItem {
  doc_id: string;
  status: "completado" | "error" | "bloqueado";
  puntaje?: number;
  motivo?: string;
}

export interface BatchStatus {
  running: boolean;
  stopped: boolean;
  total: number;
  completados: number;
  fallidos: number;
  omitidos: number;
  en_curso: string | null;
  cola: string[];
  resultados: BatchResultItem[];
  omitidos_ids: string[];
  started_at: string | null;
  rate_limit: RateLimitStatus;
}

export const startBatch = (doc_ids: string[]) =>
  api.post<{ status: string; pendientes: number; omitidos: number; mensaje: string }>(
    "/api/batch/start",
    { doc_ids }
  ).then((r) => r.data);

export const getBatchStatus = () =>
  api.get<BatchStatus>("/api/batch/status").then((r) => r.data);

export const stopBatch = () =>
  api.post<{ status: string; mensaje: string }>("/api/batch/stop").then((r) => r.data);