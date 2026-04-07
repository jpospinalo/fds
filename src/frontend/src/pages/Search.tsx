import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { semanticSearch, SearchResult } from "../api/client";

export default function Search() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState("");
  const [docId, setDocId] = useState(params.get("doc_id") || "");
  const [seccion, setSeccion] = useState<number | "">("");
  const [topK, setTopK] = useState(5);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const resp = await semanticSearch({
        query,
        doc_id: docId || undefined,
        num_seccion: seccion !== "" ? Number(seccion) : undefined,
        top_k: topK,
      });
      setResults(resp.resultados);
    } catch {
      setError("Error conectando con la API");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "1.5rem" }}>
        Búsqueda semántica
      </h1>

      {/* Filtros */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "1rem",
          marginBottom: "1.5rem",
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto auto",
          gap: "0.75rem",
          alignItems: "end",
        }}
      >
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Documento (opcional)
          </label>
          <input
            placeholder="FDS 22 - Esmalte…"
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            style={{ marginTop: 4 }}
          />
        </div>
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Sección SGA (opcional)
          </label>
          <select
            value={seccion}
            onChange={(e) => setSeccion(e.target.value === "" ? "" : Number(e.target.value))}
            style={{ marginTop: 4 }}
          >
            <option value="">Todas las secciones</option>
            {Array.from({ length: 16 }, (_, i) => i + 1).map((s) => (
              <option key={s} value={s}>
                Sección {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Top K
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            style={{ marginTop: 4, width: 70 }}
          />
        </div>
        <div />
      </div>

      {/* Barra de búsqueda */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <input
          placeholder="¿Qué EPP se recomienda? ¿Cuál es el número ONU?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{ flex: 1, padding: "0.6rem 1rem" }}
        />
        <button className="btn-primary" onClick={handleSearch} disabled={loading}>
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {error && <p style={{ color: "var(--error)", marginBottom: "1rem" }}>{error}</p>}

      {/* Resultados */}
      {results.length > 0 && (
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
          {results.length} fragmentos encontrados
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {results.map((r, i) => (
          <div
            key={i}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "1rem",
            }}
          >
            {/* Metadatos */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                flexWrap: "wrap",
                marginBottom: "0.75rem",
              }}
            >
              <span className="badge badge-present">§{String(r.metadatos.seccion ?? "–")}</span>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  alignSelf: "center",
                }}
              >
                {String(r.metadatos.doc_id ?? "")}
              </span>
            </div>
            {/* Texto en Markdown */}
            <div style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{r.texto}</ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}