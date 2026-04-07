import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

// ── Tipos ────────────────────────────────────────────────────
export interface DocumentInfo {
  doc_id: string;
  secciones_disponibles: number[];
  total_chunks: number;
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
  calidad: string;
  presencia: string;
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
  status: string;
  secciones: AuditSectionResult[];
  reporte_txt?: string;
}

// ── Funciones de API ─────────────────────────────────────────
export const fetchDocuments = () =>
  api.get<DocumentInfo[]>("/documents/").then((r) => r.data);

export const fetchSectionContent = (docId: string, seccion: number) =>
  api
    .get<{ doc_id: string; seccion: number; contenido: string }>(
      `/documents/${encodeURIComponent(docId)}/section/${seccion}`
    )
    .then((r) => r.data);

export const semanticSearch = (payload: {
  query: string;
  doc_id?: string;
  num_seccion?: number;
  top_k?: number;
}) => api.post<SearchResponse>("/search/", payload).then((r) => r.data);

export const runAudit = (docId: string) =>
  api.post(`/audit/${encodeURIComponent(docId)}`).then((r) => r.data);

export const getAuditResults = (docId: string) =>
  api
    .get<AuditResponse>(`/audit/${encodeURIComponent(docId)}/results`)
    .then((r) => r.data);

export const convertTxtToMd = (texto: string, nombre?: string) =>
  api
    .post<{ markdown: string; nombre_archivo: string }>("/convert/", {
      texto,
      nombre_archivo: nombre,
    })
    .then((r) => r.data);