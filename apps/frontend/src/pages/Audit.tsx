import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchDocuments,
  runAudit,
  getAuditResults,
  AuditResponse,
  AuditSectionResult,
  DocumentInfo,
} from "../api/client";
import { useBackgroundPolling } from "../hooks/useBackgroundPolling";

// ── Helpers de color ───────────────────────────────────────────────────────────
const CALIDAD_MAP: Record<
  string,
  { label: string; color: string; bg: string; dot: string }
> = {
  Confiable: { label: "Confiable",          color: "#10b981", bg: "rgba(16,185,129,0.12)",  dot: "#10b981" },
  Conf_CR:   { label: "Con restricciones",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)", dot: "#f59e0b" },
  NO_Conf:   { label: "No confiable",       color: "#ef4444", bg: "rgba(239,68,68,0.12)",  dot: "#ef4444" },
};

const PRESENCIA_MAP: Record<string, { color: string; bg: string }> = {
  Presente:    { color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  No_Presente: { color: "var(--text-muted)", bg: "var(--surface-2)" },
};

function getCalidad(k: string) {
  return CALIDAD_MAP[k] ?? { label: k, color: "var(--text-muted)", bg: "var(--surface-2)", dot: "var(--border)" };
}
function getPresencia(k: string) {
  return PRESENCIA_MAP[k] ?? { color: "var(--text-muted)", bg: "var(--surface-2)" };
}

// ── Componente de una sección SGA ─────────────────────────────────────────────
function SectionCard({ sec }: { sec: AuditSectionResult }) {
  const [open, setOpen] = useState(false);

  const items = sec.items ?? [];
  const total = items.length;
  const ok = items.filter((i) => i.calidad === "Confiable").length;
  const cr = items.filter((i) => i.calidad === "Conf_CR").length;
  const nc = items.filter((i) => i.calidad === "NO_Conf").length;
  const pct = total > 0 ? Math.round((ok / total) * 100) : null;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        marginBottom: 6,
        transition: "border-color 0.15s",
      }}
    >
      {/* Header clickeable */}
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          padding: "0.75rem 1rem",
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderRadius: 0,
        }}
      >
        {/* Número de sección */}
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-secondary)",
            flexShrink: 0,
          }}
        >
          {sec.seccion}
        </span>

        {/* Barra de progreso + porcentaje */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 5,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text)",
              }}
            >
              Sección {sec.seccion}
            </span>
            {pct !== null && (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  marginLeft: 8,
                }}
              >
                {pct}%
                {sec.puntaje_porcentual !== undefined &&
                  sec.puntaje_porcentual !== null &&
                  ` · ${sec.puntaje_porcentual}% puntaje`}
              </span>
            )}
          </div>
          {total > 0 && (
            <div
              style={{
                height: 5,
                borderRadius: 3,
                background: "var(--surface-2)",
                overflow: "hidden",
                display: "flex",
              }}
            >
              <div style={{ width: `${(ok / total) * 100}%`, background: "#10b981" }} />
              <div style={{ width: `${(cr / total) * 100}%`, background: "#f59e0b" }} />
              <div style={{ width: `${(nc / total) * 100}%`, background: "#ef4444" }} />
            </div>
          )}
        </div>

        {/* Mini contadores */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {ok > 0 && <Dot n={ok} color="#10b981" />}
          {cr > 0 && <Dot n={cr} color="#f59e0b" />}
          {nc > 0 && <Dot n={nc} color="#ef4444" />}
          {total === 0 && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              sin datos
            </span>
          )}
        </div>

        {/* Chevron */}
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        >
          ▾
        </span>
      </button>

      {/* Detalle expandible */}
      {open && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "0.75rem 1rem",
            animation: "fadeIn 0.15s ease",
          }}
        >
          {items.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {items.map((item, idx) => {
                const q = getCalidad(item.calidad);
                const p = getPresencia(item.presencia);
                return (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--surface-2)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text)",
                        lineHeight: 1.4,
                      }}
                    >
                      {item.item}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 9px",
                        borderRadius: 20,
                        background: p.bg,
                        color: p.color,
                        whiteSpace: "nowrap",
                        fontWeight: 500,
                      }}
                    >
                      {item.presencia === "Presente" ? "✓ Presente" : "✗ Ausente"}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 9px",
                        borderRadius: 20,
                        background: q.bg,
                        color: q.color,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        whiteSpace: "nowrap",
                        fontWeight: 500,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: q.dot,
                          flexShrink: 0,
                        }}
                      />
                      {q.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <pre
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                whiteSpace: "pre-wrap",
                fontFamily: "var(--font-mono)",
                maxHeight: 200,
                overflowY: "auto",
                margin: 0,
              }}
            >
              {sec.raw_text || "Sin datos estructurados para esta sección"}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function Dot({ n, color }: { n: number; color: string }) {
  return (
    <span
      style={{
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        background: color + "22",
        color,
        fontSize: 11,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 5px",
      }}
    >
      {n}
    </span>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function Audit() {
  const [params] = useSearchParams();
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [selectedDoc, setSelectedDoc] = useState(params.get("doc_id") || "");
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchDocuments()
      .then(setDocs)
      .catch(() => setErrorMsg("No se pudo conectar con la API"));
  }, []);

  const handlePollResult = useCallback((data: { status: string }) => {
    const typed = data as AuditResponse;
    if (typed.status !== "running") {
      setResult(typed);
      setPollingId(null);
    }
  }, []);

  const fetcher = useCallback(
    (id: string) => getAuditResults(id) as Promise<{ status: string }>,
    []
  );

  useBackgroundPolling(pollingId, fetcher, handlePollResult, 3000);

  const handleRun = async () => {
    if (!selectedDoc) return;
    setLoading(true);
    setErrorMsg("");
    setResult(null);
    try {
      await runAudit(selectedDoc);
      setPollingId(selectedDoc);
    } catch {
      setErrorMsg("Error al iniciar la auditoría. Verifica que la API esté activa.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadExisting = async () => {
    if (!selectedDoc) return;
    setErrorMsg("");
    try {
      const r = await getAuditResults(selectedDoc);
      setResult(r);
    } catch {
      setErrorMsg(
        "No hay auditoría previa para este documento. Ejecuta primero 'Ejecutar auditoría'."
      );
    }
  };

  // ── Descargas ──────────────────────────────────────────────────────────────
  const dl = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: filename }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadTxt = () => {
    if (result?.reporte_txt)
      dl(result.reporte_txt, `Auditoria_SGA_${selectedDoc}.txt`, "text/plain");
  };

  const downloadCsv = () => {
    if (result?.reporte_csv)
      dl(result.reporte_csv, `Auditoria_SGA_${selectedDoc}.csv`, "text/csv;charset=utf-8;");
  };

  const downloadMd = () => {
    if (!result) return;
    const secciones = (result.secciones ?? [])
      .map((s) => {
        const rows = (s.items ?? [])
          .map((it) => `| ${it.item} | ${it.presencia} | ${it.calidad} |`)
          .join("\n");
        const pct = s.puntaje_porcentual !== undefined ? ` — ${s.puntaje_porcentual}%` : "";
        return `## Sección ${s.seccion}${pct}\n\n| Ítem | Presencia | Calidad |\n|---|---|---|\n${rows || "| Sin datos | — | — |"}`;
      })
      .join("\n\n---\n\n");
    const md = `# Auditoría SGA — ${result.doc_id}\n\n${secciones}`;
    dl(md, `Auditoria_SGA_${selectedDoc}.md`, "text/markdown");
  };

  // ── Estado derivado ────────────────────────────────────────────────────────
  const isRunning = pollingId !== null;
  const secciones: AuditSectionResult[] = Array.isArray(result?.secciones)
    ? result!.secciones
    : [];

  const totalItems = secciones.flatMap((s) => s.items ?? []).length;
  const okItems = secciones
    .flatMap((s) => s.items ?? [])
    .filter((i) => i.calidad === "Confiable").length;
  const globalPct = totalItems > 0 ? Math.round((okItems / totalItems) * 100) : null;

  const btnStyle = {
    padding: "0.45rem 0.9rem",
    fontSize: 13,
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    cursor: "pointer",
    color: "var(--text)",
  };

  const btnPrimaryStyle = {
    ...btnStyle,
    background: "var(--accent)",
    border: "none",
    color: "#fff",
    fontWeight: 500,
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <h1
        style={{
          fontSize: "1.2rem",
          marginBottom: "0.35rem",
          fontWeight: 600,
        }}
      >
        Auditoría SGA
      </h1>
      <p
        style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          marginBottom: "1.5rem",
        }}
      >
        Evalúa automáticamente las secciones de una FDS según la normativa SGA.
      </p>

      {/* ── Controles ─────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "1rem",
          marginBottom: "1.5rem",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <select
          value={selectedDoc}
          onChange={(e) => {
            setSelectedDoc(e.target.value);
            setResult(null);
            setErrorMsg("");
          }}
          style={{ flex: 1, minWidth: 220 }}
        >
          <option value="">— Seleccionar documento —</option>
          {docs.map((d) => (
            <option key={d.doc_id} value={d.doc_id}>
              {d.doc_id}
            </option>
          ))}
        </select>

        <button
          onClick={handleLoadExisting}
          disabled={!selectedDoc}
          style={{
            ...btnStyle,
            opacity: selectedDoc ? 1 : 0.45,
            cursor: selectedDoc ? "pointer" : "not-allowed",
          }}
        >
          Ver existente
        </button>

        <button
          onClick={handleRun}
          disabled={!selectedDoc || loading || isRunning}
          style={{
            ...btnPrimaryStyle,
            opacity: selectedDoc && !loading && !isRunning ? 1 : 0.45,
            cursor:
              selectedDoc && !loading && !isRunning ? "pointer" : "not-allowed",
          }}
        >
          {isRunning ? (
            <>
              <span className="spinner" /> Auditando…
            </>
          ) : loading ? (
            "Iniciando…"
          ) : (
            "Ejecutar auditoría"
          )}
        </button>

        {result?.status === "completed" && (
          <>
            {result.reporte_txt && (
              <button onClick={downloadTxt} style={btnStyle}>
                ↓ TXT
              </button>
            )}
            {result.reporte_csv && (
              <button onClick={downloadCsv} style={btnStyle}>
                ↓ CSV
              </button>
            )}
            <button onClick={downloadMd} style={btnStyle}>
              ↓ MD
            </button>
          </>
        )}
      </div>

      {/* ── Banner de estado ───────────────────────────────────────────────── */}
      {isRunning && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: "var(--radius)",
            fontSize: 13,
            color: "#f59e0b",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span className="spinner" />
          Auditoría en curso (puedes cambiar de pestaña, seguirá corriendo)…
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "var(--error-bg)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--radius)",
            fontSize: 13,
            color: "var(--error)",
            marginBottom: "1rem",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* ── Resumen global ─────────────────────────────────────────────────── */}
      {result?.status === "completed" && secciones.length > 0 && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
              marginBottom: "1.25rem",
            }}
          >
            {[
              { label: "Secciones",       value: secciones.length },
              { label: "Ítems totales",   value: totalItems },
              { label: "Confiables",      value: okItems },
              {
                label: "Puntuación",
                value: globalPct !== null ? `${globalPct}%` : "—",
              },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "0.85rem 1rem",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    margin: "0 0 4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {m.label}
                </p>
                <p style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Leyenda */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: "1rem",
              fontSize: 12,
              color: "var(--text-secondary)",
            }}
          >
            {[
              { color: "#10b981", label: "Confiable" },
              { color: "#f59e0b", label: "Con restricciones" },
              { color: "#ef4444", label: "No confiable" },
            ].map((l) => (
              <span
                key={l.label}
                style={{ display: "flex", alignItems: "center", gap: 5 }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: l.color,
                  }}
                />
                {l.label}
              </span>
            ))}
          </div>

          {/* Cards por sección */}
          <div className="animate-fade-in">
            {secciones.map((s) => (
              <SectionCard key={s.seccion} sec={s} />
            ))}
          </div>
        </>
      )}

      {result?.status === "error" && (
        <p style={{ color: "var(--error)", fontSize: 13 }}>
          Error en la auditoría:{" "}
          {result.detail || "Error desconocido. Revisa los logs del backend."}
        </p>
      )}
    </div>
  );
}