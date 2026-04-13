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

const SECTION_NAMES: Record<number, string> = {
  1:  "Identificación del producto",
  2:  "Identificación del peligro o peligros",
  3:  "Composición / información sobre los componentes",
  4:  "Primeros auxilios",
  5:  "Medidas de lucha contra incendios",
  6:  "Medidas en caso de vertido accidental",
  7:  "Manipulación y almacenamiento",
  8:  "Controles de exposición / protección personal",
  9:  "Propiedades físicas y químicas",
  10: "Estabilidad y reactividad",
  11: "Información toxicológica",
  12: "Información ecotoxicológica",
  13: "Eliminación de los productos",
  14: "Información relativa al transporte",
  15: "Información sobre la reglamentación",
  16: "Otras informaciones",
};

const ITEM_DESCRIPTIONS: Record<string, string> = {
  "1_0": "Título de sección",
  "1_1": "Identificador SGA del producto",
  "1_2": "Otros medios de identificación",
  "1_3": "Uso recomendado y restricciones de uso",
  "1_4": "Datos del proveedor",
  "1_5": "Número de teléfono para emergencias",
  "2_0": "Título de sección",
  "2_1": "Clasificación SGA de la sustancia / mezcla",
  "2_2_1": "Elementos de etiqueta SGA — Pictogramas",
  "2_2_2": "Elementos de etiqueta SGA — Palabra de advertencia",
  "2_2_3": "Elementos de etiqueta SGA — Indicaciones de peligro",
  "2_2_4": "Elementos de etiqueta SGA — Consejos de prudencia",
  "2_3": "Otros peligros no cubiertos por el SGA",
  "3_0": "Título de sección",
  "3_1_1": "Identidad química de la sustancia",
  "3_1_1_1": "Nombres comunes o sinónimos de la sustancia",
  "3_1_1_2": "Número CAS y otros identificadores únicos de la sustancia",
  "3_1_1_3": "Impurezas, aditivos o estabilizadores presentes",
  "3_2_1": "Identidad química de la mezcla",
  "3_2_1_1": "Nombres comunes o sinónimos de la mezcla",
  "3_2_1_2": "Número CAS y otros identificadores únicos de la mezcla",
  "3_2_1_3": "Concentración o gamas de concentraciones de los componentes",
  "4_0": "Título de sección",
  "4_1": "Medidas de primeros auxilios según vía de exposición",
  "4_2": "Síntomas y efectos más importantes, agudos o retardados",
  "4_3": "Atención médica inmediata y tratamientos especiales",
  "5_0": "Título de sección",
  "5_1": "Medios de extinción adecuados e inadecuados",
  "5_2": "Peligros específicos derivados del producto químico",
  "5_3": "Recomendaciones para el personal de emergencia",
  "6_0": "Título de sección",
  "6_1": "Precauciones personales, equipo de protección y procedimientos de emergencia",
  "6_2": "Precauciones relativas al medio ambiente",
  "6_3": "Métodos y materiales de contención y limpieza",
  "7_0": "Título de sección",
  "7_1": "Precauciones para una manipulación segura",
  "7_2": "Condiciones de almacenamiento seguro",
  "7_3": "Usos específicos finales",
  "8_0": "Título de sección",
  "8_1": "Parámetros de control — límites de exposición",
  "8_2": "Controles técnicos apropiados",
  "8_3": "Medidas de protección individual (EPP)",
  "9_0": "Título de sección",
  "9_1": "Propiedades físicas y químicas",
  "10_0": "Título de sección",
  "10_1": "Reactividad",
  "10_2": "Estabilidad química",
  "10_3": "Posibilidad de reacciones peligrosas",
  "10_4": "Condiciones que deben evitarse",
  "10_5": "Materiales incompatibles",
  "10_6": "Productos de descomposición peligrosos",
  "11_0": "Título de sección",
  "11_1": "Efectos toxicológicos",
  "11_2": "Posibles vías de exposición",
  "11_3": "Síntomas relacionados con características físicas, químicas y toxicológicas",
  "11_4": "Efectos inmediatos, retardados y crónicos",
  "11_5": "Medidas numéricas de toxicidad",
  "12_0": "Título de sección",
  "12_1": "Toxicidad ecológica",
  "12_2": "Persistencia y degradabilidad",
  "12_3": "Potencial de bioacumulación",
  "12_4": "Movilidad en el suelo",
  "12_5": "Otros efectos adversos",
  "13_0": "Título de sección",
  "13_1": "Métodos de eliminación",
  "14_0": "Título de sección",
  "14_1": "Número ONU",
  "14_2": "Designación oficial de transporte (ONU)",
  "14_3": "Clase(s) de peligro para el transporte",
  "14_4": "Grupo de embalaje",
  "14_5": "Peligros para el medio ambiente",
  "14_6": "Precauciones especiales para el usuario",
  "15_0": "Título de sección",
  "15_1": "Reglamentación en materia de seguridad, salud y medio ambiente",
  "16_0": "Título de sección",
  "16_1": "Información adicional",
};

/** Strips "Item_" prefix → "1_0", "2_2_1", "3_1_1_1", etc. */
function getItemKey(rawLabel: string): string {
  return rawLabel.replace(/^Item_/, "");
}

/** Human-readable description for a key. Falls back to formatted key. */
function getItemDescription(rawLabel: string): string {
  const key = getItemKey(rawLabel);
  return ITEM_DESCRIPTIONS[key] ?? key.replace(/_/g, ".");
}

/**
 * Indent level based on how many segments the key has.
 * "1_0"     → 2 segments → level 0 (top-level items)
 * "2_2_1"   → 3 segments → level 1 (subsection)
 * "3_1_1_1" → 4 segments → level 2 (sub-subsection)
 */
function getIndentLevel(key: string): number {
  return Math.max(0, key.split("_").length - 2);
}

// ── Single checklist row ─────────────────────────────────────────────────────
function CheckRow({
  label,
  present,
  isFirst,
}: {
  label: string;
  present: boolean;
  isFirst: boolean;
}) {
  const key = getItemKey(label);
  const description = getItemDescription(label);
  const level = getIndentLevel(key);
  const isSectionTitle = key.endsWith("_0");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 14px 7px 0",
        paddingLeft: `${14 + level * 22}px`,
        borderTop: isFirst ? "none" : "1px solid var(--border)",
        background: "transparent",
      }}
    >
      {/* Connector line for nested items */}
      {level > 0 && (
        <div
          style={{
            width: 12,
            height: 1,
            background: "var(--border)",
            flexShrink: 0,
            marginLeft: -4,
          }}
        />
      )}

      {/* Checkbox */}
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 3,
          border: `1.5px solid ${present ? "#10b981" : "var(--border)"}`,
          background: present ? "#10b981" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        {present && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path
              d="M1 3.5L3 5.5L8 1"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Item ID badge */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: isSectionTitle ? "var(--text-muted)" : "var(--text-secondary)",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 3,
          padding: "1px 5px",
          fontFamily: "var(--font-mono)",
          flexShrink: 0,
          letterSpacing: "0.03em",
          opacity: isSectionTitle ? 0.7 : 1,
        }}
      >
        {key}
      </span>

      {/* Description */}
      <span
        style={{
          fontSize: isSectionTitle ? 12 : 13,
          color: isSectionTitle
            ? "var(--text-muted)"
            : present
            ? "var(--text)"
            : "var(--text-secondary)",
          flex: 1,
          lineHeight: 1.4,
          fontStyle: isSectionTitle ? "italic" : "normal",
        }}
      >
        {description}
      </span>

      {/* Status pill */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: "2px 10px",
          borderRadius: 20,
          whiteSpace: "nowrap",
          flexShrink: 0,
          background: present
            ? "rgba(16,185,129,0.1)"
            : "rgba(239,68,68,0.07)",
          color: present ? "#10b981" : "#ef4444",
          border: `1px solid ${
            present ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.18)"
          }`,
        }}
      >
        {present ? "Presente" : "No presente"}
      </span>
    </div>
  );
}

// ── Section accordion card ───────────────────────────────────────────────────
function SectionChecklist({ sec }: { sec: AuditSectionResult }) {
  const [open, setOpen] = useState(true);

  const items = sec.items ?? [];
  // Exclude the "title" item (x_0) from the count metrics
  const contentItems = items.filter(
    (i) => !getItemKey(i.item).endsWith("_0")
  );
  const presentCount = contentItems.filter(
    (i) => i.presencia === "Presente"
  ).length;
  const total = contentItems.length;
  const pct = total > 0 ? Math.round((presentCount / total) * 100) : 0;

  const barColor =
    pct === 100 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        marginBottom: 6,
      }}
    >
      {/* Section header */}
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          padding: "11px 14px",
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderRadius: 0,
        }}
      >
        {/* Section number */}
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-secondary)",
            flexShrink: 0,
            fontFamily: "var(--font-mono)",
          }}
        >
          {sec.seccion}
        </span>

        {/* Title + progress */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 5,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {SECTION_NAMES[sec.seccion] ?? `Sección ${sec.seccion}`}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {presentCount}/{total} presentes &nbsp;·&nbsp; {pct}%
            </span>
          </div>
          {/* Progress bar */}
          <div
            style={{
              height: 3,
              borderRadius: 2,
              background: "var(--surface-2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: barColor,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>

        {/* Chevron */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
            color: "var(--text-muted)",
          }}
        >
          <path
            d="M2 4L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Checklist body */}
      {open && items.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {items.map((item, idx) => (
            <CheckRow
              key={idx}
              label={item.item}
              present={item.presencia === "Presente"}
              isFirst={idx === 0}
            />
          ))}
        </div>
      )}

      {open && items.length === 0 && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "10px 14px",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          Sin datos para esta sección
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
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

  // Downloads
  const dl = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), {
      href: url,
      download: filename,
    }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadTxt = () => {
    if (result?.reporte_txt)
      dl(result.reporte_txt, `Auditoria_SGA_${selectedDoc}.txt`, "text/plain");
  };

  const downloadCsv = () => {
    if (result?.reporte_csv)
      dl(
        result.reporte_csv,
        `Auditoria_SGA_${selectedDoc}.csv`,
        "text/csv;charset=utf-8;"
      );
  };

  const downloadMd = () => {
    if (!result) return;
    const secciones = (result.secciones ?? [])
      .map((s) => {
        const rows = (s.items ?? [])
          .map(
            (it) =>
              `| ${getItemKey(it.item)} | ${getItemDescription(it.item)} | ${
                it.presencia
              } |`
          )
          .join("\n");
        return `## Sección ${s.seccion} — ${
          SECTION_NAMES[s.seccion] ?? ""
        }\n\n| ID | Descripción | Presencia |\n|---|---|---|\n${
          rows || "| — | Sin datos | — |"
        }`;
      })
      .join("\n\n---\n\n");
    const md = `# Auditoría SGA — ${result.doc_id}\n\n${secciones}`;
    dl(md, `Auditoria_SGA_${selectedDoc}.md`, "text/markdown");
  };

  // Derived state
  const isRunning = pollingId !== null;
  const secciones: AuditSectionResult[] = Array.isArray(result?.secciones)
    ? result!.secciones
    : [];

  const allItems = secciones.flatMap((s) =>
    (s.items ?? []).filter((i) => !getItemKey(i.item).endsWith("_0"))
  );
  const totalItems = allItems.length;
  const presentItems = allItems.filter((i) => i.presencia === "Presente").length;
  const absentItems = totalItems - presentItems;
  const globalPct =
    totalItems > 0 ? Math.round((presentItems / totalItems) * 100) : 0;

  const btnBase: React.CSSProperties = {
    padding: "0.45rem 0.9rem",
    fontSize: 13,
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    cursor: "pointer",
    color: "var(--text)",
  };

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: "var(--accent)",
    border: "none",
    color: "#fff",
    fontWeight: 500,
  };

  return (
    <div style={{ maxWidth: 820 }}>
      <h1
        style={{ fontSize: "1.2rem", marginBottom: "0.35rem", fontWeight: 600 }}
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

      {/* Controls */}
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
            ...btnBase,
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
            ...btnPrimary,
            opacity:
              selectedDoc && !loading && !isRunning ? 1 : 0.45,
            cursor:
              selectedDoc && !loading && !isRunning
                ? "pointer"
                : "not-allowed",
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
              <button onClick={downloadTxt} style={btnBase}>
                ↓ TXT
              </button>
            )}
            {result.reporte_csv && (
              <button onClick={downloadCsv} style={btnBase}>
                ↓ CSV
              </button>
            )}
            <button onClick={downloadMd} style={btnBase}>
              ↓ MD
            </button>
          </>
        )}
      </div>

      {/* Running banner */}
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
          Auditoría en curso. Puedes cambiar de pestaña, seguirá corriendo…
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

      {/* Results */}
      {result?.status === "completed" && secciones.length > 0 && (
        <div className="animate-fade-in">
          {/* Summary metrics */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 8,
              marginBottom: "1.25rem",
            }}
          >
            {[
              {
                label: "Secciones",
                value: secciones.length,
                color: "var(--text)",
              },
              {
                label: "Ítems totales",
                value: totalItems,
                color: "var(--text)",
              },
              {
                label: "Presentes",
                value: presentItems,
                color: "#10b981",
              },
              {
                label: "No presentes",
                value: absentItems,
                color: "#ef4444",
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
                    fontSize: 10,
                    color: "var(--text-secondary)",
                    margin: "0 0 4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {m.label}
                </p>
                <p
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    margin: 0,
                    color: m.color,
                  }}
                >
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* Overall progress bar */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "0.85rem 1rem",
              marginBottom: "1.25rem",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              Cobertura total
            </span>
            <div
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                background: "var(--surface-2)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${globalPct}%`,
                  background:
                    globalPct === 100
                      ? "#10b981"
                      : globalPct >= 60
                      ? "#f59e0b"
                      : "#ef4444",
                  transition: "width 0.5s ease",
                  borderRadius: 3,
                }}
              />
            </div>
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text)",
                whiteSpace: "nowrap",
                minWidth: 44,
                textAlign: "right",
              }}
            >
              {globalPct}%
            </span>
          </div>

          {/* Legend */}
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
              { color: "#10b981", label: "Presente" },
              { color: "#ef4444", label: "No presente" },
            ].map((l) => (
              <span
                key={l.label}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: l.color,
                    flexShrink: 0,
                  }}
                />
                {l.label}
              </span>
            ))}
            <span
              style={{
                marginLeft: "auto",
                color: "var(--text-muted)",
                fontStyle: "italic",
              }}
            >
              Contadores excluyen ítem de título de sección
            </span>
          </div>

          {/* Per-section checklists */}
          {secciones.map((s) => (
            <SectionChecklist key={s.seccion} sec={s} />
          ))}
        </div>
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