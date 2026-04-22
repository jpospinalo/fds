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

export interface AuditResponse {
  doc_id: string;
  status: string;       // "completed" | "running" | "error"
  secciones: AuditSectionResult[];
  reporte_txt?: string;
  reporte_csv?: string; // ← añadido: el backend lo genera pero faltaba aquí
  detail?: string;      // ← para errores
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

export const fetchSectionContent = (docId: string, seccion: number) =>
  api
    .get<{ doc_id: string; seccion: number; contenido: string }>(
      `/api/documents/${encodeURIComponent(docId)}/section/${seccion}`
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

export const runAudit = (docId: string) =>
  api
    .post<{ status: string; doc_id: string; message: string }>(
      `/api/audit/${encodeURIComponent(docId)}`
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