import { useCallback, useEffect, useRef, useState } from "react";
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

// ── Helpers de color ───────────────────────────────────────────
const CALIDAD_MAP: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  Confiable: { label: "Confiable", color: "#166534", bg: "#dcfce7", dot: "#16a34a" },
  Conf_CR:   { label: "Con restricciones", color: "#92400e", bg: "#fef3c7", dot: "#d97706" },
  NO_Conf:   { label: "No confiable", color: "#991b1b", bg: "#fee2e2", dot: "#dc2626" },
};

const PRESENCIA_MAP: Record<string, { color: string; bg: string }> = {
  Presente:    { color: "#1e40af", bg: "#dbeafe" },
  No_Presente: { color: "#6b7280", bg: "#f3f4f6" },
};

function calidad(k: string) {
  return CALIDAD_MAP[k] ?? { label: k, color: "#6b7280", bg: "#f3f4f6", dot: "#9ca3af" };
}
function presencia(k: string) {
  return PRESENCIA_MAP[k] ?? { color: "#6b7280", bg: "#f3f4f6" };
}

// ── Componente de una sección SGA ─────────────────────────────
function SectionCard({ sec }: { sec: AuditSectionResult }) {
  const [open, setOpen] = useState(false);

  const items = sec.items ?? [];
  const total = items.length;
  const ok = items.filter((i) => i.calidad === "Confiable").length;
  const cr = items.filter((i) => i.calidad === "Conf_CR").length;
  const nc = items.filter((i) => i.calidad === "NO_Conf").length;
  const pct = total > 0 ? Math.round((ok / total) * 100) : null;

  const barColor =
    pct === null ? "#d1d5db" : pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";

  return (
    <div
      style={{
        background: "var(--color-background-primary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-lg)",
        overflow: "hidden",
        marginBottom: 8,
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
        }}
      >
        {/* Número de sección */}
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--color-background-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-text-secondary)",
            flexShrink: 0,
          }}
        >
          {sec.seccion}
        </span>

        {/* Barra de progreso + contadores */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
              Sección {sec.seccion}
            </span>
            {pct !== null && (
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                {pct}% confiable
              </span>
            )}
          </div>
          {total > 0 && (
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "var(--color-background-tertiary)",
                overflow: "hidden",
                display: "flex",
              }}
            >
              <div style={{ width: `${(ok / total) * 100}%`, background: "#16a34a" }} />
              <div style={{ width: `${(cr / total) * 100}%`, background: "#d97706" }} />
              <div style={{ width: `${(nc / total) * 100}%`, background: "#dc2626" }} />
            </div>
          )}
        </div>

        {/* Mini badges resumen */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {ok > 0 && <Dot n={ok} color="#16a34a" />}
          {cr > 0 && <Dot n={cr} color="#d97706" />}
          {nc > 0 && <Dot n={nc} color="#dc2626" />}
          {total === 0 && (
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>sin datos</span>
          )}
        </div>

        {/* Chevron */}
        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-secondary)",
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
            borderTop: "0.5px solid var(--color-border-tertiary)",
            padding: "0.75rem 1rem",
          }}
        >
          {items.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((item, idx) => {
                const q = calidad(item.calidad);
                const p = presencia(item.presencia);
                return (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: "var(--border-radius-md)",
                      background: "var(--color-background-secondary)",
                    }}
                  >
                    <span style={{ fontSize: 12, color: "var(--color-text-primary)" }}>
                      {item.item}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: p.bg,
                        color: p.color,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.presencia}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: q.bg,
                        color: q.color,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: q.dot,
                          display: "inline-block",
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
                color: "var(--color-text-secondary)",
                whiteSpace: "pre-wrap",
                fontFamily: "var(--font-mono)",
                maxHeight: 200,
                overflowY: "auto",
                margin: 0,
              }}
            >
              {sec.raw_text || "Sin datos estructurados"}
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
        fontWeight: 500,
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

// ── Página principal ───────────────────────────────────────────
export default function Audit() {
  const [params] = useSearchParams();
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [selectedDoc, setSelectedDoc] = useState(params.get("doc_id") || "");
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchDocuments().then(setDocs).catch(() => {});
  }, []);

  // Callback tipado defensivamente
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
      setPollingId(selectedDoc); // usamos doc_id como "job id" en el auditor
    } catch (e: unknown) {
      setErrorMsg("Error al iniciar la auditoría");
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
      setErrorMsg("No hay auditoría previa para este documento");
    }
  };

  const downloadTxt = () => {
    if (!result?.reporte_txt) return;
    const blob = new Blob([result.reporte_txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), {
      href: url,
      download: `Auditoria_SGA_${selectedDoc}.txt`,
    }).click();
  };

  const downloadMd = () => {
    if (!result) return;
    const secciones = (result.secciones ?? [])
      .map((s) => {
        const items = (s.items ?? [])
          .map(
            (it) =>
              `| ${it.item} | ${it.presencia} | ${it.calidad} |`
          )
          .join("\n");
        return `## Sección ${s.seccion}\n\n| Ítem | Presencia | Calidad |\n|---|---|---|\n${items || "| Sin datos | — | — |"}`;
      })
      .join("\n\n---\n\n");
    const md = `# Auditoría SGA — ${result.doc_id}\n\n${secciones}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), {
      href: url,
      download: `Auditoria_SGA_${selectedDoc}.md`,
    }).click();
  };

  const isRunning = pollingId !== null;
  const secciones: AuditSectionResult[] = Array.isArray(result?.secciones)
    ? result!.secciones
    : [];

  const totalItems = secciones.flatMap((s) => s.items ?? []).length;
  const okItems = secciones
    .flatMap((s) => s.items ?? [])
    .filter((i) => i.calidad === "Confiable").length;
  const globalPct = totalItems > 0 ? Math.round((okItems / totalItems) * 100) : null;

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", fontWeight: 500 }}>
        Auditoría SGA
      </h1>

      {/* Controles */}
      <div
        style={{
          background: "var(--color-background-secondary)",
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: "var(--border-radius-lg)",
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
            padding: "0.45rem 0.9rem",
            fontSize: 13,
            background: "var(--color-background-primary)",
            border: "0.5px solid var(--color-border-secondary)",
            borderRadius: "var(--border-radius-md)",
            cursor: selectedDoc ? "pointer" : "not-allowed",
            color: "var(--color-text-primary)",
          }}
        >
          Ver existente
        </button>
        <button
          onClick={handleRun}
          disabled={!selectedDoc || loading || isRunning}
          style={{
            padding: "0.45rem 0.9rem",
            fontSize: 13,
            background: selectedDoc && !loading && !isRunning ? "#6366f1" : "#d1d5db",
            color: selectedDoc && !loading && !isRunning ? "#fff" : "#9ca3af",
            border: "none",
            borderRadius: "var(--border-radius-md)",
            cursor: selectedDoc && !loading && !isRunning ? "pointer" : "not-allowed",
          }}
        >
          {isRunning ? "Auditando…" : loading ? "Iniciando…" : "Ejecutar auditoría"}
        </button>
        {result && (
          <>
            <button
              onClick={downloadTxt}
              style={{
                padding: "0.45rem 0.9rem",
                fontSize: 13,
                background: "var(--color-background-primary)",
                border: "0.5px solid var(--color-border-secondary)",
                borderRadius: "var(--border-radius-md)",
                cursor: "pointer",
                color: "var(--color-text-primary)",
              }}
            >
              ↓ TXT
            </button>
            <button
              onClick={downloadMd}
              style={{
                padding: "0.45rem 0.9rem",
                fontSize: 13,
                background: "var(--color-background-primary)",
                border: "0.5px solid var(--color-border-secondary)",
                borderRadius: "var(--border-radius-md)",
                cursor: "pointer",
                color: "var(--color-text-primary)",
              }}
            >
              ↓ MD
            </button>
          </>
        )}
      </div>

      {/* Estado de polling */}
      {isRunning && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#fef3c7",
            border: "0.5px solid #fde68a",
            borderRadius: "var(--border-radius-md)",
            fontSize: 13,
            color: "#92400e",
            marginBottom: "1rem",
          }}
        >
          ⏳ Auditoría en curso (puedes cambiar de pestaña, seguirá corriendo)…
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#fee2e2",
            border: "0.5px solid #fca5a5",
            borderRadius: "var(--border-radius-md)",
            fontSize: 13,
            color: "#991b1b",
            marginBottom: "1rem",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Resumen global */}
      {result?.status === "completed" && secciones.length > 0 && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
              marginBottom: "1.5rem",
            }}
          >
            {[
              { label: "Secciones evaluadas", value: secciones.length },
              { label: "Ítems totales", value: totalItems },
              { label: "Ítems confiables", value: okItems },
              {
                label: "Puntuación global",
                value: globalPct !== null ? `${globalPct}%` : "—",
              },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  background: "var(--color-background-secondary)",
                  borderRadius: "var(--border-radius-md)",
                  padding: "0.75rem 1rem",
                }}
              >
                <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 4px" }}>
                  {m.label}
                </p>
                <p style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>{m.value}</p>
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
              color: "var(--color-text-secondary)",
            }}
          >
            {[
              { color: "#16a34a", label: "Confiable" },
              { color: "#d97706", label: "Con restricciones" },
              { color: "#dc2626", label: "No confiable" },
            ].map((l) => (
              <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: l.color,
                    display: "inline-block",
                  }}
                />
                {l.label}
              </span>
            ))}
          </div>

          {/* Cards por sección */}
          {secciones.map((s) => (
            <SectionCard key={s.seccion} sec={s} />
          ))}
        </>
      )}

      {result?.status === "error" && (
        <p style={{ color: "#dc2626", fontSize: 13 }}>
          Error: {(result as Record<string, unknown>).detail as string}
        </p>
      )}
    </div>
  );
}