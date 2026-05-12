import { useEffect, useRef, useState } from "react";
import {
  fetchDocuments,
  startBatch,
  getBatchStatus,
  stopBatch,
  DocumentInfo,
  BatchStatus,
  BatchResultItem,
  RateLimitStatus,
} from "../api/client";

// ── Helpers ────────────────────────────────────────────────────────────────────

function isAudited(doc: DocumentInfo): boolean {
  return Object.values(doc.secciones_estado).some((v) => v !== "sin_auditoria");
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "var(--text-muted)";
  if (score >= 75) return "var(--success)";
  if (score >= 50) return "var(--warning)";
  return "var(--error)";
}

function levelColor(nivel: string): string {
  if (nivel === "bloqueado") return "var(--error)";
  if (nivel === "advertencia") return "var(--warning)";
  return "var(--success)";
}

// ── Gauge de consumo ───────────────────────────────────────────────────────────

function Gauge({
  label,
  actual,
  limite,
  pct,
  unit = "",
}: {
  label: string;
  actual: number;
  limite: number;
  pct: number;
  unit?: string;
}) {
  const color =
    pct >= 90 ? "var(--error)" : pct >= 70 ? "var(--warning)" : "var(--success)";
  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          marginBottom: 4,
        }}
      >
        <span style={{ color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
        <span style={{ color, fontWeight: 700 }}>
          {actual.toLocaleString()}{unit} / {limite.toLocaleString()}{unit}
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: "var(--border)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(100, pct)}%`,
            height: "100%",
            background: color,
            borderRadius: 4,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
        {pct}% utilizado
      </div>
    </div>
  );
}

// ── Estado de un documento en la lista ────────────────────────────────────────

type DocStatus =
  | "pendiente"
  | "en_curso"
  | "completado"
  | "error"
  | "bloqueado"
  | "ya_auditado"
  | "omitido";

function getDocStatus(
  docId: string,
  batchStatus: BatchStatus | null,
  docs: DocumentInfo[]
): DocStatus {
  if (!batchStatus) {
    const doc = docs.find((d) => d.doc_id === docId);
    return doc && isAudited(doc) ? "ya_auditado" : "pendiente";
  }
  if (batchStatus.en_curso === docId) return "en_curso";
  const result = batchStatus.resultados.find((r) => r.doc_id === docId);
  if (result) {
    if (result.status === "completado") return "completado";
    if (result.status === "bloqueado") return "bloqueado";
    return "error";
  }
  if (batchStatus.omitidos_ids.includes(docId)) return "ya_auditado";
  if (batchStatus.cola.includes(docId)) return "pendiente";
  const doc = docs.find((d) => d.doc_id === docId);
  return doc && isAudited(doc) ? "ya_auditado" : "omitido";
}

const STATUS_LABEL: Record<DocStatus, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso...",
  completado: "Completado",
  error: "Error",
  bloqueado: "Bloqueado",
  ya_auditado: "Ya auditado",
  omitido: "Omitido",
};

const STATUS_COLOR: Record<DocStatus, string> = {
  pendiente: "var(--text-muted)",
  en_curso: "var(--accent)",
  completado: "var(--success)",
  error: "var(--error)",
  bloqueado: "var(--error)",
  ya_auditado: "var(--text-muted)",
  omitido: "var(--text-muted)",
};

// ── Componente principal ───────────────────────────────────────────────────────

export default function Massive() {
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "ok" | "error" } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ordenar: no auditados primero
  const sortedDocs = [...docs].sort((a, b) => {
    const aA = isAudited(a) ? 1 : 0;
    const bA = isAudited(b) ? 1 : 0;
    return aA - bA;
  });

  const pendientesCount = docs.filter((d) => !isAudited(d)).length;

  // Polling
  const startPolling = (fast: boolean) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      getBatchStatus().then(setBatchStatus).catch(() => {});
    }, fast ? 3000 : 8000);
  };

  useEffect(() => {
    fetchDocuments()
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoadingDocs(false));

    getBatchStatus().then(setBatchStatus).catch(() => {});
    startPolling(false);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    startPolling(batchStatus?.running ?? false);
  }, [batchStatus?.running]);

  const handleStart = async () => {
    if (!docs.length) return;
    setStarting(true);
    setMessage(null);
    try {
      const allIds = sortedDocs.map((d) => d.doc_id);
      const res = await startBatch(allIds);
      setMessage({ text: res.mensaje, type: "ok" });
      const status = await getBatchStatus();
      setBatchStatus(status);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error al iniciar.";
      setMessage({ text: msg, type: "error" });
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    try {
      const res = await stopBatch();
      setMessage({ text: res.mensaje, type: "ok" });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error al detener.";
      setMessage({ text: msg, type: "error" });
    }
  };

  const rl: RateLimitStatus | null = batchStatus?.rate_limit ?? null;
  const progresoPct =
    batchStatus && batchStatus.total > 0
      ? Math.round(((batchStatus.completados + batchStatus.fallidos) / batchStatus.total) * 100)
      : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Header ── */}
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Auditoría Masiva</h1>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
          {pendientesCount} documentos sin auditar · cola secuencial con límite de API
        </p>
      </div>

      {/* ── Consumo de API ── */}
      <div
        style={{
          background: "var(--surface)",
          border: `1px solid ${rl ? levelColor(rl.nivel) + "55" : "var(--border)"}`,
          borderRadius: "var(--radius-lg)",
          padding: "1.25rem 1.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Consumo de API Gemini</h2>
          {rl && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: levelColor(rl.nivel),
                background: levelColor(rl.nivel) + "18",
                border: `1px solid ${levelColor(rl.nivel)}44`,
                borderRadius: "var(--radius-sm)",
                padding: "2px 10px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {rl.nivel}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          {rl ? (
            <>
              <Gauge label="RPM" actual={rl.rpm.actual} limite={rl.rpm.limite} pct={rl.rpm.pct} />
              <Gauge
                label="RPD (cap 400)"
                actual={rl.rpd.actual}
                limite={rl.rpd.limite}
                pct={rl.rpd.pct}
              />
              <Gauge label="TPM" actual={rl.tpm.actual} limite={rl.tpm.limite} pct={rl.tpm.pct} unit=" tok" />
              <div style={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: levelColor(rl.nivel) }}>
                  {rl.docs_restantes_hoy}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  docs auditables hoy
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {rl.rpd.restante} peticiones restantes
                </div>
              </div>
            </>
          ) : (
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Cargando estado de API…</span>
          )}
        </div>

        {rl && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.6rem 1rem",
              background: levelColor(rl.nivel) + "12",
              border: `1px solid ${levelColor(rl.nivel)}33`,
              borderRadius: "var(--radius)",
              fontSize: 13,
              color: levelColor(rl.nivel),
            }}
          >
            {rl.nivel === "bloqueado" && "⛔ "}
            {rl.nivel === "advertencia" && "⚠️ "}
            {rl.nivel === "normal" && "✓ "}
            {rl.mensaje}
          </div>
        )}
      </div>

      {/* ── Controles y progreso ── */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "1.25rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            className="btn-primary"
            onClick={handleStart}
            disabled={starting || batchStatus?.running || loadingDocs || rl?.nivel === "bloqueado"}
            style={{ minWidth: 200 }}
          >
            {starting ? "Iniciando…" : batchStatus?.running ? "En curso…" : `Auditar ${pendientesCount} documentos pendientes`}
          </button>

          {batchStatus?.running && (
            <button className="btn-ghost" onClick={handleStop} style={{ color: "var(--error)" }}>
              Detener
            </button>
          )}

          {batchStatus && (
            <div style={{ display: "flex", gap: "1rem", fontSize: 13, color: "var(--text-secondary)", flexWrap: "wrap" }}>
              <span>✓ <strong style={{ color: "var(--success)" }}>{batchStatus.completados}</strong> completados</span>
              {batchStatus.fallidos > 0 && (
                <span>✗ <strong style={{ color: "var(--error)" }}>{batchStatus.fallidos}</strong> fallidos</span>
              )}
              <span style={{ color: "var(--text-muted)" }}>{batchStatus.omitidos} ya auditados omitidos</span>
            </div>
          )}
        </div>

        {message && (
          <div
            style={{
              fontSize: 13,
              padding: "0.5rem 0.75rem",
              borderRadius: "var(--radius)",
              background: message.type === "ok" ? "var(--success-bg)" : "var(--error-bg)",
              color: message.type === "ok" ? "var(--success)" : "var(--error)",
            }}
          >
            {message.text}
          </div>
        )}

        {batchStatus && batchStatus.total > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: "var(--text-secondary)" }}>
                {batchStatus.completados + batchStatus.fallidos} / {batchStatus.total} documentos
              </span>
              <span style={{ fontWeight: 700, color: "var(--accent)" }}>{progresoPct}%</span>
            </div>
            <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
              <div
                style={{
                  width: `${progresoPct}%`,
                  height: "100%",
                  background: "var(--accent)",
                  borderRadius: 4,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
            {batchStatus.en_curso && (
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
                Auditando:{" "}
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>{batchStatus.en_curso}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Lista de documentos ── */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "1.25rem 1.5rem",
        }}
      >
        <h2 style={{ margin: "0 0 1rem", fontSize: 14, fontWeight: 600 }}>
          Documentos ({docs.length})
        </h2>

        {loadingDocs ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Cargando documentos…</div>
        ) : docs.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No hay documentos disponibles.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {sortedDocs.map((doc) => {
              const status = getDocStatus(doc.doc_id, batchStatus, docs);
              const result: BatchResultItem | undefined = batchStatus?.resultados.find(
                (r) => r.doc_id === doc.doc_id
              );
              const isRunning = batchStatus?.en_curso === doc.doc_id;

              return (
                <div
                  key={doc.doc_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.5rem 0.6rem",
                    borderRadius: "var(--radius)",
                    background: isRunning ? "var(--accent-muted)" : "transparent",
                    border: isRunning ? "1px solid var(--accent)44" : "1px solid transparent",
                    transition: "background 0.2s",
                  }}
                >
                  {/* Indicador */}
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: STATUS_COLOR[status],
                      flexShrink: 0,
                      animation: isRunning ? "pulse 1.4s infinite" : undefined,
                    }}
                  />

                  {/* Nombre */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: status === "ya_auditado" || status === "omitido"
                          ? "var(--text-muted)"
                          : "var(--text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {doc.year ? `[${doc.year}] ` : ""}{doc.doc_id}
                    </div>
                    {result?.motivo && (
                      <div style={{ fontSize: 11, color: "var(--error)", marginTop: 1 }}>
                        {result.motivo}
                      </div>
                    )}
                  </div>

                  {/* Puntaje o badge */}
                  {result?.puntaje != null ? (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: scoreColor(result.puntaje),
                        background: scoreColor(result.puntaje) + "18",
                        borderRadius: "var(--radius-sm)",
                        padding: "2px 8px",
                      }}
                    >
                      {result.puntaje}%
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        color: STATUS_COLOR[status],
                        background: STATUS_COLOR[status] + "14",
                        borderRadius: "var(--radius-sm)",
                        padding: "2px 8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
