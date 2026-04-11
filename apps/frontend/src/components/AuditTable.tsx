import { AuditSectionResult, AuditItemResult } from "../api/client";
import "../App.css";

const CALIDAD_CLASS: Record<string, string> = {
  Confiable: "badge-ok",
  Conf_CR: "badge-cr",
  NO_Conf: "badge-nc",
};

const PRESENCIA_CLASS: Record<string, string> = {
  Presente: "badge-present",
  No_Presente: "badge-absent",
};

interface AuditTableProps {
  sections: AuditSectionResult[];
  docId: string;
  csvData?: string;
}

interface ParsedRow {
  seccion: number;
  item: string;
  presencia: string;
  calidad: string;
  observaciones?: string;
}

function parseCSV(csv: string): ParsedRow[] {
  if (!csv) return [];
  
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  
  const rows: ParsedRow[] = [];
  
  // Saltar header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Parse CSV respetando comillas
    const regex = /(\d+),"([^"]*(?:""[^"]*)*)","([^"]*(?:""[^"]*)*)","([^"]*(?:""[^"]*)*)","([^"]*(?:""[^"]*)*)"/;
    const match = line.match(regex);
    
    if (match) {
      rows.push({
        seccion: parseInt(match[1]),
        item: match[2].replace(/""/g, '"'),
        presencia: match[3],
        calidad: match[4],
        observaciones: match[5] || undefined,
      });
    }
  }
  
  return rows;
}

function groupBySection(rows: ParsedRow[]): Record<number, ParsedRow[]> {
  return rows.reduce((acc, row) => {
    if (!acc[row.seccion]) {
      acc[row.seccion] = [];
    }
    acc[row.seccion].push(row);
    return acc;
  }, {} as Record<number, ParsedRow[]>);
}

export default function AuditTable({ sections, docId, csvData }: AuditTableProps) {
  // Si hay CSV, úsalo; si no, usa sections
  let dataToUse: ParsedRow[] = [];
  
  if (csvData) {
    dataToUse = parseCSV(csvData);
  } else if (sections && sections.length > 0) {
    // Fallback: convertir sections a ParsedRow
    dataToUse = sections.flatMap((sec) =>
      sec.items.map((item) => ({
        seccion: sec.seccion,
        item: item.item,
        presencia: item.presencia,
        calidad: item.calidad,
        observaciones: item.observaciones,
      }))
    );
  }

  if (!dataToUse || dataToUse.length === 0) {
    return <p style={{ color: "var(--text-muted)" }}>No hay datos de auditoría disponibles</p>;
  }

  const sectionGroups = groupBySection(dataToUse);
  const sectionNumbers = Object.keys(sectionGroups)
    .map(Number)
    .sort((a, b) => a - b);

  // Calcular resumen general
  const totalItems = dataToUse.length;
  const presentesCount = dataToUse.filter((r) => r.presencia === "Presente").length;
  const confiablesCount = dataToUse.filter((r) => r.calidad === "Confiable").length;
  const puntajeGeneral = totalItems > 0 ? ((confiablesCount / totalItems) * 100).toFixed(1) : "0.0";

  return (
    <div style={{ marginTop: "2rem" }}>
      {/* Resumen General */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--bg), var(--surface))",
          border: "2px solid var(--accent)",
          borderRadius: "var(--radius)",
          padding: "1.5rem",
          marginBottom: "2rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1.5rem",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--accent)" }}>
            {puntajeGeneral}%
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Puntuación General
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--success)" }}>
            {confiablesCount}/{totalItems}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Ítems Confiables
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--warning)" }}>
            {presentesCount}/{totalItems}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Ítems Presentes
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)" }}>
            {sectionNumbers.length}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Secciones Auditadas
          </div>
        </div>
      </div>

      {/* Tabla por Sección */}
      <div style={{ display: "grid", gap: "1.5rem" }}>
        {sectionNumbers.map((secNum) => (
          <SectionTableFromRows
            key={secNum}
            seccion={secNum}
            rows={sectionGroups[secNum]}
          />
        ))}
      </div>
    </div>
  );
}

interface SectionTableFromRowsProps {
  seccion: number;
  rows: ParsedRow[];
}

function SectionTableFromRows({ seccion, rows }: SectionTableFromRowsProps) {
  const presentCount = rows.filter((r) => r.presencia === "Presente").length;
  const confCount = rows.filter((r) => r.calidad === "Confiable").length;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1rem",
          background: "linear-gradient(90deg, var(--bg) 0%, var(--surface) 100%)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem", fontWeight: 600 }}>
            Sección {seccion}
          </h3>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {presentCount}/{rows.length} presentes • {confCount}/{rows.length} confiables
          </div>
        </div>
        <div
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color:
              rows.length > 0
                ? (confCount / rows.length) * 100 >= 80
                  ? "var(--success)"
                  : (confCount / rows.length) * 100 >= 50
                  ? "var(--warning)"
                  : "var(--error)"
                : "var(--text-muted)",
            minWidth: "60px",
            textAlign: "right",
          }}
        >
          {rows.length > 0
            ? (((confCount / rows.length) * 100).toFixed(1))
            : "0.0"}
          %
        </div>
      </div>

      {/* Tabla de Items */}
      {rows.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr style={{ background: "var(--bg)", borderBottom: "2px solid var(--border)" }}>
                <th style={{ padding: "0.75rem", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>
                  Ítem
                </th>
                <th style={{ padding: "0.75rem", textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>
                  Presencia
                </th>
                <th style={{ padding: "0.75rem", textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>
                  Calidad
                </th>
                {rows.some((r) => r.observaciones) && (
                  <th style={{ padding: "0.75rem", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>
                    Observaciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)",
                  }}
                >
                  <td style={{ padding: "0.75rem" }}>
                    <span style={{ fontWeight: 500 }}>{row.item}</span>
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "center" }}>
                    <span className={`badge ${PRESENCIA_CLASS[row.presencia] ?? ""}`}>
                      {row.presencia === "Presente" ? "✓ Presente" : "✗ Ausente"}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "center" }}>
                    <span className={`badge ${CALIDAD_CLASS[row.calidad] ?? ""}`}>
                      {row.calidad}
                    </span>
                  </td>
                  {rows.some((r) => r.observaciones) && (
                    <td style={{ padding: "0.75rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      {row.observaciones || "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: "1rem", color: "var(--text-muted)", textAlign: "center" }}>
          Sin datos de auditoría para esta sección
        </div>
      )}
    </div>
  );
}
