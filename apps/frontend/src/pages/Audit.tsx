import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchDocuments, runAudit, getAuditResults, AuditResponse, DocumentInfo } from "../api/client";
import AuditTable from "../components/AuditTable";

export default function Audit() {
  const [params] = useSearchParams();
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [selectedDoc, setSelectedDoc] = useState(params.get("doc_id") || "");
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [polling, setPolling] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDocuments().then(setDocs);
  }, []);

  // Polling hasta que status !== 'running'
  useEffect(() => {
    if (!polling || !selectedDoc) return;
    const id = setInterval(async () => {
      try {
        const r = await getAuditResults(selectedDoc);
        setResult(r);
        if (r.status !== "running") {
          setPolling(false);
          clearInterval(id);
        }
      } catch {
        setPolling(false);
        clearInterval(id);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [polling, selectedDoc]);

  const handleRunAudit = async () => {
    if (!selectedDoc) return;
    setLoading(true);
    setResult(null);
    await runAudit(selectedDoc);
    setPolling(true);
    setLoading(false);
  };

  const handleLoadExisting = async () => {
    if (!selectedDoc) return;
    try {
      const r = await getAuditResults(selectedDoc);
      setResult(r);
    } catch {
      alert("No hay auditoría previa para este documento");
    }
  };

  const downloadReport = () => {
    if (!result?.reporte_txt) return;
    const blob = new Blob([result.reporte_txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Auditoria_SGA_${selectedDoc}.txt`;
    a.click();
  };

  const exportAsCSV = () => {
    if (!result?.secciones) return;

    let csv = "Sección,Ítem,Presencia,Calidad,Observaciones\n";
    result.secciones.forEach((sec) => {
      sec.items.forEach((item) => {
        csv += `${sec.seccion},"${item.item}","${item.presencia}","${item.calidad}","${item.observaciones || ""}"\n`;
      });
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Auditoria_SGA_${selectedDoc}.csv`;
    a.click();
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "1.5rem" }}>Auditoría SGA</h1>

      {/* Selector */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "1rem",
          marginBottom: "1.5rem",
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <select
          value={selectedDoc}
          onChange={(e) => setSelectedDoc(e.target.value)}
          style={{ flex: 1, minWidth: 250 }}
        >
          <option value="">— Seleccionar documento —</option>
          {docs.map((d) => (
            <option key={d.doc_id} value={d.doc_id}>
              {d.doc_id}
            </option>
          ))}
        </select>
        <button className="btn-ghost" onClick={handleLoadExisting} disabled={!selectedDoc}>
          Ver resultado existente
        </button>
        <button className="btn-primary" onClick={handleRunAudit} disabled={!selectedDoc || loading || polling}>
          {polling ? "Auditando…" : loading ? "Iniciando…" : "Ejecutar auditoría"}
        </button>
        {result?.reporte_txt && (
          <>
            <button className="btn-ghost" onClick={downloadReport}>
              ⬇ Descargar .txt
            </button>
            <button className="btn-ghost" onClick={exportAsCSV}>
              ⬇ Exportar CSV
            </button>
          </>
        )}
      </div>

      {polling && (
        <p style={{ color: "var(--warning)", marginBottom: "1rem", fontSize: "0.9rem" }}>
          ⏳ Auditoría en curso. Consultando resultados…
        </p>
      )}

      {/* Tabla de resultados */}
      {result && result.status === "completed" && result.secciones.length > 0 && (
        <div>
          <AuditTable sections={result.secciones} docId={selectedDoc} />
        </div>
      )}

      {result?.status === "error" && (
        <p style={{ color: "var(--error)" }}>Error en la auditoría: {(result as any).detail}</p>
      )}
    </div>
  );
}