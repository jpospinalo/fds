import { useEffect, useState } from "react";
import { fetchDocuments, DocumentInfo } from "../api/client";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchDocuments()
      .then(setDocs)
      .catch(() => setError("No se pudo conectar con la API. Verifica que el backend esté activo en :8000"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 14 }}>
        <span className="spinner" /> Cargando documentos…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "1rem",
          background: "var(--error-bg)",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: "var(--radius)",
          color: "var(--error)",
          fontSize: 13,
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.2rem", marginBottom: "0.35rem", fontWeight: 600 }}>
        Documentos procesados
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
        {docs.length} documento{docs.length !== 1 ? "s" : ""} disponibles en la base vectorial
      </p>

      {docs.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            textAlign: "center",
            color: "var(--text-secondary)",
            fontSize: 13,
          }}
        >
          No hay documentos disponibles. Sube un PDF desde la sección{" "}
          <button
            onClick={() => navigate("/upload")}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent)",
              cursor: "pointer",
              fontSize: 13,
              padding: 0,
              textDecoration: "underline",
            }}
          >
            Subir PDF
          </button>
          .
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "1rem",
          }}
        >
          {docs.map((doc) => (
            <div
              key={doc.doc_id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "1.1rem",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)")
              }
            >
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: "0.4rem",
                  wordBreak: "break-word",
                  lineHeight: 1.4,
                }}
              >
                {doc.doc_id}
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  marginBottom: "0.75rem",
                }}
              >
                {doc.secciones_disponibles.length} secciones · {doc.total_chunks} chunks
              </p>

              {/* Tags de secciones */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  marginBottom: "0.9rem",
                }}
              >
                {doc.secciones_disponibles.map((s) => (
                  <span
                    key={s}
                    style={{
                      fontSize: 11,
                      padding: "1px 6px",
                      background: "var(--surface-2)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    §{s}
                  </span>
                ))}
              </div>

              {/* Acciones */}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 12, padding: "0.35rem 0.75rem", flex: 1 }}
                  onClick={() =>
                    navigate(`/search?doc_id=${encodeURIComponent(doc.doc_id)}`)
                  }
                >
                  Buscar
                </button>
                <button
                  className="btn-primary"
                  style={{ fontSize: 12, padding: "0.35rem 0.75rem", flex: 1 }}
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
      )}
    </div>
  );
}