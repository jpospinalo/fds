import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { convertTxtToMd } from "../api/client";

export default function Convert() {
  const [inputText, setInputText] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [fileName, setFileName] = useState("documento");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"source" | "preview">("source");

  const handleConvert = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    try {
      const r = await convertTxtToMd(inputText, fileName);
      setMarkdown(r.markdown);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name.replace(".txt", ""));
    const reader = new FileReader();
    reader.onload = () => setInputText(reader.result as string);
    reader.readAsText(file, "utf-8");
  };

  const downloadMd = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.md`;
    a.click();
  };

  const copyMd = () => {
    navigator.clipboard.writeText(markdown);
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>TXT → Markdown</h1>
      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        Pega el texto de una FDS o sube un .txt y obtén Markdown estructurado automáticamente.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        {/* Panel izquierdo: Input */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.5rem",
            }}
          >
            <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Texto de entrada
            </label>
            <label
              htmlFor="file-upload"
              style={{
                fontSize: "0.75rem",
                color: "var(--accent)",
                cursor: "pointer",
              }}
            >
              Subir .txt
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </div>
          <textarea
            placeholder="Pega aquí el texto de la ficha de datos de seguridad…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{ height: 420, resize: "vertical", fontFamily: "monospace", fontSize: "0.8rem" }}
          />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <input
              placeholder="Nombre del archivo"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn-primary" onClick={handleConvert} disabled={loading || !inputText.trim()}>
              {loading ? "Convirtiendo…" : "Convertir"}
            </button>
          </div>
        </div>

        {/* Panel derecho: Output */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.5rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {(["source", "preview"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    fontSize: "0.75rem",
                    padding: "3px 10px",
                    background: view === v ? "var(--accent)" : "transparent",
                    color: view === v ? "#fff" : "var(--text-muted)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                  }}
                >
                  {v === "source" ? "Fuente" : "Vista previa"}
                </button>
              ))}
            </div>
            {markdown && (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn-ghost" onClick={copyMd} style={{ fontSize: "0.75rem" }}>
                  Copiar
                </button>
                <button className="btn-ghost" onClick={downloadMd} style={{ fontSize: "0.75rem" }}>
                  Descargar .md
                </button>
              </div>
            )}
          </div>

          {view === "source" ? (
            <textarea
              readOnly
              value={markdown}
              placeholder="El Markdown generado aparecerá aquí…"
              style={{
                height: 420,
                fontFamily: "monospace",
                fontSize: "0.8rem",
                resize: "vertical",
                color: markdown ? "var(--text)" : "var(--text-muted)",
              }}
            />
          ) : (
            <div
              style={{
                height: 420,
                overflowY: "auto",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "1rem",
                fontSize: "0.875rem",
                lineHeight: 1.6,
              }}
            >
              {markdown ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
              ) : (
                <p style={{ color: "var(--text-muted)" }}>Vista previa del Markdown…</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}