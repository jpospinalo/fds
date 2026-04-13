import { useCallback, useState } from "react";
import { uploadPdf, getJobStatus, PipelineJob } from "../api/client";
import { useBackgroundPolling } from "../hooks/useBackgroundPolling";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const SECCION_NOMBRES: Record<number, string> = {
  1: "Identificación del producto",
  2: "Identificación de peligros",
  3: "Composición / componentes",
  4: "Primeros auxilios",
  5: "Lucha contra incendios",
  6: "Vertido accidental",
  7: "Manipulación y almacenamiento",
  8: "Controles de exposición",
  9: "Propiedades físicas y químicas",
  10: "Estabilidad y reactividad",
  11: "Información toxicológica",
  12: "Información ecotoxicológica",
  13: "Eliminación de productos",
  14: "Información de transporte",
  15: "Información reglamentaria",
  16: "Otra información",
};

export default function Upload() {
  const [dragging, setDragging] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<PipelineJob | null>(null);
  const [selectedSec, setSelectedSec] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handlePollResult = useCallback((data: { status: string }) => {
    setJob(data as PipelineJob);
  }, []);

  const fetcher = useCallback(
    (id: string) => getJobStatus(id) as Promise<{ status: string }>,
    []
  );

  useBackgroundPolling(jobId, fetcher, handlePollResult, 2000);

  const process = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("Solo se aceptan archivos PDF");
      return;
    }
    setUploading(true);
    setErrorMsg("");
    setJob(null);
    setSelectedSec(null);
    try {
      const resp = await uploadPdf(file);
      setJobId(resp.job_id);
    } catch {
      setErrorMsg("Error al subir el archivo");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) process(file);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) process(file);
    e.target.value = "";
  };

  const secciones = job?.secciones ?? {};
  const seccionesEncontradas = Object.entries(secciones).filter(([, v]) => v !== null);
  const isRunning = job?.status === "running" || uploading;

  const downloadMarkdown = () => {
    if (!job?.markdown) return;
    const blob = new Blob([job.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), {
      href: url,
      download: `${job.doc_id}.md`,
    }).click();
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: 500 }}>
        Procesar PDF propio
      </h1>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
        Sube cualquier FDS en PDF. El sistema extrae automáticamente las 16 secciones SGA usando Docling.
        Puedes cambiar de pestaña mientras procesa.
      </p>

      {/* Zona de drop */}
      {!isRunning && job?.status !== "completed" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragging ? "#6366f1" : "var(--color-border-secondary)"}`,
            borderRadius: "var(--border-radius-lg)",
            padding: "3rem 2rem",
            textAlign: "center",
            background: dragging ? "rgba(99,102,241,0.05)" : "var(--color-background-secondary)",
            marginBottom: "1.5rem",
            transition: "all 0.15s",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
            Arrastra un PDF aquí
          </p>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16 }}>
            o selecciona un archivo
          </p>
          <label
            htmlFor="pdf-upload"
            style={{
              padding: "0.5rem 1.25rem",
              fontSize: 13,
              background: "#6366f1",
              color: "#fff",
              borderRadius: "var(--border-radius-md)",
              cursor: "pointer",
              display: "inline-block",
            }}
          >
            Seleccionar PDF
          </label>
          <input
            id="pdf-upload"
            type="file"
            accept=".pdf"
            onChange={onFileInput}
            style={{ display: "none" }}
          />
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

      {/* Progreso */}
      {isRunning && job && (
        <div
          style={{
            background: "var(--color-background-secondary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-lg)",
            padding: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{job.message}</span>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {job.progress}%
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: "var(--color-background-tertiary)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${job.progress}%`,
                background: "#6366f1",
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 8 }}>
            ⓘ Puedes cambiar de pestaña, el procesamiento continúa en el servidor.
          </p>
        </div>
      )}

      {/* Resultado */}
      {job?.status === "completed" && (
        <div>
          {/* Resumen */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              marginBottom: "1rem",
            }}
          >
            {[
              { label: "Documento", value: job.doc_id },
              { label: "Secciones encontradas", value: `${job.secciones_encontradas ?? 0} / 16` },
              { label: "Texto extraído", value: `${((job.markdown?.length ?? 0) / 1000).toFixed(1)}k chars` },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  background: "var(--color-background-secondary)",
                  borderRadius: "var(--border-radius-md)",
                  padding: "0.75rem",
                }}
              >
                <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 4px" }}>
                  {m.label}
                </p>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    margin: 0,
                    wordBreak: "break-all",
                  }}
                >
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", flexWrap: "wrap" }}>
            <button
              onClick={downloadMarkdown}
              style={{
                padding: "0.45rem 0.9rem",
                fontSize: 13,
                background: "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: "var(--border-radius-md)",
                cursor: "pointer",
              }}
            >
              ↓ Descargar Markdown completo
            </button>
            <button
              onClick={() => {
                setJob(null);
                setJobId(null);
                setSelectedSec(null);
              }}
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
              Procesar otro PDF
            </button>
          </div>

          {/* Grid de secciones */}
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, alignItems: "start" }}>
            {/* Sidebar de secciones */}
            <div
              style={{
                background: "var(--color-background-secondary)",
                border: "0.5px solid var(--color-border-tertiary)",
                borderRadius: "var(--border-radius-lg)",
                overflow: "hidden",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: "var(--color-text-secondary)",
                  padding: "0.6rem 0.75rem",
                  borderBottom: "0.5px solid var(--color-border-tertiary)",
                  margin: 0,
                }}
              >
                Secciones extraídas
              </p>
              {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => {
                const found = secciones[n] !== null && secciones[n] !== undefined;
                return (
                  <button
                    key={n}
                    onClick={() => found && setSelectedSec(n)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      textAlign: "left",
                      background:
                        selectedSec === n
                          ? "rgba(99,102,241,0.1)"
                          : "transparent",
                      border: "none",
                      borderBottom: "0.5px solid var(--color-border-tertiary)",
                      cursor: found ? "pointer" : "default",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: found ? "#16a34a" : "#d1d5db",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        color: found
                          ? "var(--color-text-primary)"
                          : "var(--color-text-secondary)",
                      }}
                    >
                      §{n} {SECCION_NOMBRES[n]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Contenido de la sección seleccionada */}
            <div
              style={{
                background: "var(--color-background-primary)",
                border: "0.5px solid var(--color-border-tertiary)",
                borderRadius: "var(--border-radius-lg)",
                padding: "1rem",
                minHeight: 400,
                maxHeight: 600,
                overflowY: "auto",
              }}
            >
              {selectedSec ? (
                <>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      marginBottom: "1rem",
                      paddingBottom: "0.5rem",
                      borderBottom: "0.5px solid var(--color-border-tertiary)",
                    }}
                  >
                    §{selectedSec} — {SECCION_NOMBRES[selectedSec]}
                  </p>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {secciones[selectedSec] as string}
                    </ReactMarkdown>
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                  Selecciona una sección del panel izquierdo para ver su contenido.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {job?.status === "error" && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#fee2e2",
            border: "0.5px solid #fca5a5",
            borderRadius: "var(--border-radius-md)",
            fontSize: 13,
            color: "#991b1b",
          }}
        >
          Error en el pipeline: {job.message}
          <br />
          <button
            onClick={() => { setJob(null); setJobId(null); }}
            style={{
              marginTop: 8,
              padding: "0.35rem 0.75rem",
              fontSize: 12,
              background: "transparent",
              border: "0.5px solid #fca5a5",
              borderRadius: "var(--border-radius-md)",
              cursor: "pointer",
              color: "#991b1b",
            }}
          >
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}