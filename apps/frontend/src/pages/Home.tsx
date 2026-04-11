import { useEffect, useState } from "react";
import { fetchDocuments, DocumentInfo } from "../api/client";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDocuments()
      .then(setDocs)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "var(--text-muted)" }}>Cargando documentos…</p>;

  return (
    <div>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "1.5rem" }}>
        Documentos procesados ({docs.length})
      </h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "1rem",
        }}
      >
        {docs.map((doc) => (
          <div
            key={doc.doc_id}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "1rem",
            }}
          >
            <p
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "0.5rem",
                wordBreak: "break-word",
              }}
            >
              {doc.doc_id}
            </p>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              {doc.secciones_disponibles.length} secciones · {doc.total_chunks} chunks
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "0.75rem" }}>
              {doc.secciones_disponibles.map((s) => (
                <span
                  key={s}
                  style={{
                    fontSize: "0.7rem",
                    padding: "1px 6px",
                    background: "var(--bg)",
                    borderRadius: 4,
                    border: "1px solid var(--border)",
                  }}
                >
                  §{s}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                className="btn-ghost"
                style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                onClick={() =>
                  navigate(`/search?doc_id=${encodeURIComponent(doc.doc_id)}`)
                }
              >
                Buscar
              </button>
              <button
                className="btn-primary"
                style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                onClick={() =>
                  navigate(`/audit?doc_id=${encodeURIComponent(doc.doc_id)}`)
                }
              >
                Auditar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}