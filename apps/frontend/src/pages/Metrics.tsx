import { useEffect, useState } from "react";
import { fetchMetrics, MetricsData } from "../api/client";

function scoreColor(score: number | null): string {
  if (score === null) return "var(--text-muted)";
  if (score >= 75) return "var(--success)";
  if (score >= 50) return "var(--warning)";
  return "var(--error)";
}

function ScoreBar({ value }: { value: number | null }) {
  const pct = value ?? 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "var(--border)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: scoreColor(value),
            borderRadius: 4,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: scoreColor(value),
          minWidth: 38,
          textAlign: "right",
        }}
      >
        {value !== null ? `${value}%` : "—"}
      </span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "1.25rem 1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <span style={{ fontSize: 28, fontWeight: 700, color: color ?? "var(--text)" }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{sub}</span>}
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Metrics() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ color: "var(--text-secondary)", paddingTop: "2rem" }}>
        Cargando métricas…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div style={{ color: "var(--error)", paddingTop: "2rem" }}>
        Error al cargar métricas: {error}
      </div>
    );
  }

  const { resumen, calidad, por_seccion, documentos_recientes, items_mas_ausentes } = data;
  const sortedSections = [...por_seccion].sort(
    (a, b) => (a.puntaje_promedio ?? -1) - (b.puntaje_promedio ?? -1)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* ── Header ── */}
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Métricas del sistema</h1>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
          Actualizado {formatDate(data.generated_at)}
        </p>
      </div>

      {/* ── KPI Cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
        }}
      >
        <KpiCard
          label="Documentos auditados"
          value={resumen.total_auditados}
          sub={resumen.corriendo > 0 ? `${resumen.corriendo} en curso` : undefined}
        />
        <KpiCard
          label="Puntaje global"
          value={calidad.puntaje_promedio_global !== null ? `${calidad.puntaje_promedio_global}%` : "—"}
          sub="Promedio de todas las secciones"
          color={scoreColor(calidad.puntaje_promedio_global)}
        />
        <KpiCard
          label="Tasa de presencia"
          value={calidad.tasa_presencia_global !== null ? `${calidad.tasa_presencia_global}%` : "—"}
          sub={`${calidad.items_presentes} / ${calidad.total_items} ítems`}
          color={scoreColor(calidad.tasa_presencia_global)}
        />
        <KpiCard
          label="Ítems ausentes"
          value={calidad.items_ausentes}
          sub="En todos los documentos auditados"
          color={calidad.items_ausentes > 0 ? "var(--warning)" : "var(--success)"}
        />
        {resumen.con_error > 0 && (
          <KpiCard
            label="Con error"
            value={resumen.con_error}
            color="var(--error)"
          />
        )}
      </div>

      {/* ── Secciones + Items ausentes ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Secciones */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "1.25rem 1.5rem",
          }}
        >
          <h2 style={{ margin: "0 0 1rem", fontSize: 14, fontWeight: 600 }}>
            Rendimiento por sección SGA
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sortedSections.map((sec) => (
              <div key={sec.seccion} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    minWidth: 20,
                    textAlign: "right",
                  }}
                >
                  {sec.seccion}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    width: 170,
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={sec.nombre}
                >
                  {sec.nombre}
                </span>
                <ScoreBar value={sec.puntaje_promedio} />
              </div>
            ))}
          </div>
        </div>

        {/* Items más ausentes */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "1.25rem 1.5rem",
          }}
        >
          <h2 style={{ margin: "0 0 1rem", fontSize: 14, fontWeight: 600 }}>
            Ítems con mayor ausencia
          </h2>
          {items_mas_ausentes.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Sin datos suficientes.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items_mas_ausentes.map((it) => (
                <div key={it.item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      flex: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={it.item}
                  >
                    {it.item.replace("Item_", "").replace(/_/g, ".")}
                  </span>
                  <div
                    style={{
                      width: 120,
                      height: 6,
                      background: "var(--border)",
                      borderRadius: 4,
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: `${it.tasa_ausencia}%`,
                        height: "100%",
                        background: scoreColor(100 - it.tasa_ausencia),
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: scoreColor(100 - it.tasa_ausencia),
                      minWidth: 42,
                      textAlign: "right",
                    }}
                  >
                    {it.tasa_ausencia}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Documentos recientes ── */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "1.25rem 1.5rem",
        }}
      >
        <h2 style={{ margin: "0 0 1rem", fontSize: 14, fontWeight: 600 }}>
          Auditorías recientes
        </h2>
        {documentos_recientes.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Sin auditorías registradas.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <th style={{ textAlign: "left", padding: "0 0 8px", fontWeight: 600 }}>Documento</th>
                <th style={{ textAlign: "center", padding: "0 0 8px", fontWeight: 600 }}>Puntaje</th>
                <th style={{ textAlign: "right", padding: "0 0 8px", fontWeight: 600 }}>Primera auditoría</th>
                <th style={{ textAlign: "right", padding: "0 0 8px", fontWeight: 600 }}>Última actualización</th>
              </tr>
            </thead>
            <tbody>
              {documentos_recientes.map((doc) => (
                <tr
                  key={doc.doc_id}
                  style={{ borderTop: "1px solid var(--border-soft)" }}
                >
                  <td style={{ padding: "8px 0", color: "var(--text)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.doc_id}
                  </td>
                  <td style={{ padding: "8px 0", textAlign: "center" }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: scoreColor(doc.puntaje_global),
                        background: doc.puntaje_global !== null
                          ? `${scoreColor(doc.puntaje_global)}18`
                          : "transparent",
                        borderRadius: "var(--radius-sm)",
                        padding: "2px 8px",
                        fontSize: 12,
                      }}
                    >
                      {doc.puntaje_global !== null ? `${doc.puntaje_global}%` : "—"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 0", textAlign: "right", color: "var(--text-secondary)" }}>
                    {formatDate(doc.created_at)}
                  </td>
                  <td style={{ padding: "8px 0", textAlign: "right", color: "var(--text-secondary)" }}>
                    {formatDate(doc.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
