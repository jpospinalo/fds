import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { convertTxtToMd } from "../api/client";

export default function Convert() {
  const [inputText, setInputText] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [fileName, setFileName] = useState("documento");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"source" | "preview">("preview");

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

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name.replace(/\.txt$/, ""));
    const reader = new FileReader();
    reader.onload = () => setInputText(reader.result as string);
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  const downloadTxt = () => {
    dl(inputText, `${fileName}.txt`, "text/plain");
  };

  const downloadMd = () => {
    if (!markdown) return;
    dl(markdown, `${fileName}.md`, "text/markdown");
  };

  const downloadBoth = () => {
    downloadTxt();
    setTimeout(downloadMd, 300);
  };

  function dl(content: string, name: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: name }).click();
  }

  const copyMd = () => navigator.clipboard.writeText(markdown);

  return (
    <div style={{ maxWidth: 1200 }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem", fontWeight: 500 }}>
        TXT → Markdown
      </h1>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
        Convierte texto plano de una FDS a Markdown estructurado. Ambas versiones se descargan juntas.
      </p>

      {/* Barra superior */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <input
          placeholder="Nombre del archivo"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          style={{ width: 200 }}
        />
        <label
          htmlFor="txt-upload"
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
          Subir .txt
        </label>
        <input id="txt-upload" type="file" accept=".txt" onChange={handleFile} style={{ display: "none" }} />
        <button
          onClick={handleConvert}
          disabled={loading || !inputText.trim()}
          style={{
            padding: "0.45rem 0.9rem",
            fontSize: 13,
            background: inputText.trim() ? "#6366f1" : "#d1d5db",
            color: inputText.trim() ? "#fff" : "#9ca3af",
            border: "none",
            borderRadius: "var(--border-radius-md)",
            cursor: inputText.trim() ? "pointer" : "not-allowed",
          }}
        >
          {loading ? "Convirtiendo…" : "Convertir"}
        </button>
        {markdown && (
          <>
            <button
              onClick={downloadBoth}
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
              ↓ Descargar TXT + MD
            </button>
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
            <button
              onClick={copyMd}
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
              Copiar MD
            </button>
          </>
        )}
      </div>

      {/* Layout de tres paneles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: markdown ? "1fr 1fr 1fr" : "1fr",
          gap: 12,
          alignItems: "start",
        }}
      >
        {/* Panel 1: Texto de entrada */}
        <div>
          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>
            Texto de entrada (TXT)
          </p>
          <textarea
            placeholder="Pega aquí el texto de la FDS…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{
              height: 500,
              resize: "vertical",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          />
          {inputText && (
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>
              {inputText.length.toLocaleString()} caracteres
            </p>
          )}
        </div>

        {/* Panel 2: Markdown fuente */}
        {markdown && (
          <div>
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>
              Markdown generado (fuente)
            </p>
            <textarea
              readOnly
              value={markdown}
              style={{
                height: 500,
                resize: "vertical",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                lineHeight: 1.5,
                color: "var(--color-text-primary)",
              }}
            />
            {markdown && (
              <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>
                {markdown.length.toLocaleString()} caracteres
              </p>
            )}
          </div>
        )}

        {/* Panel 3: Vista previa renderizada */}
        {markdown && (
          <div>
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>
              Vista previa renderizada
            </p>
            <div
              style={{
                height: 500,
                overflowY: "auto",
                background: "var(--color-background-primary)",
                border: "0.5px solid var(--color-border-tertiary)",
                borderRadius: "var(--border-radius-lg)",
                padding: "1rem",
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--color-text-primary)",
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}