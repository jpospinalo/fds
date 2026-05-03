import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  fetchDocuments,
  fetchSectionContent,
  runAudit,
  getAuditResults,
  checkAuditExists,
  AuditResponse,
  AuditChanges,
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

const ITEM_EXPECTATIONS: Record<string, string> = {
  "1_1": "Debe incluir el nombre comercial del producto y al menos un identificador único: número CAS, número CE o código de artículo del fabricante.",
  "1_2": "Sinónimos reconocidos, nombres alternativos o códigos internos del producto.",
  "1_3": "Descripción del uso previsto (ej. adhesivo industrial, recubrimiento) y cualquier restricción de uso conocida.",
  "1_4": "Nombre completo, dirección física, país, teléfono y correo electrónico del fabricante o distribuidor responsable.",
  "1_5": "Número de teléfono de emergencias disponible 24/7, preferiblemente de un centro toxicológico o servicio de emergencia nacional.",
  "2_1": "Clasificación SGA del producto: clase de peligro, categoría y código H correspondiente.",
  "2_2_1": "Uno o más pictogramas GHS aplicables (llama, calavera, exclamación, corrosión, etc.).",
  "2_2_2": "Palabra de advertencia: 'Peligro' para categorías más graves o 'Atención' para las menos graves.",
  "2_2_3": "Frases H (indicaciones de peligro) aplicables con su descripción completa.",
  "2_2_4": "Frases P (consejos de prudencia) de prevención, respuesta, almacenamiento y eliminación.",
  "2_3": "Peligros no clasificados por SGA: efectos en la salud no categorizados, polvo combustible u otros.",
  "3_1_1": "Identidad química de la sustancia pura: nombre IUPAC o nombre químico reconocido.",
  "3_1_1_1": "Nombre común o sinónimos aceptados internacionalmente para la sustancia.",
  "3_1_1_2": "Número CAS y/o número CE (EINECS/ELINCS) de la sustancia.",
  "3_1_1_3": "Impurezas relevantes, aditivos estabilizadores o contaminantes que afecten la clasificación.",
  "3_2_1": "Nombre de la mezcla y descripción de los componentes peligrosos identificados.",
  "3_2_1_1": "Nombre comercial de la mezcla y denominación química de sus componentes principales.",
  "3_2_1_2": "Número CAS y número CE de cada componente peligroso de la mezcla.",
  "3_2_1_3": "Concentración o rango de concentración (%) de cada componente peligroso.",
  "4_1": "Instrucciones por vía de exposición: inhalación, contacto ocular, contacto dérmico e ingestión.",
  "4_2": "Síntomas y efectos esperados, diferenciando entre efectos agudos (inmediatos) y retardados.",
  "4_3": "Indicación de si se requiere atención médica urgente y si existe antídoto o tratamiento específico.",
  "5_1": "Agentes extintores recomendados (CO₂, polvo seco, espuma, agua nebulizada) e inadecuados.",
  "5_2": "Peligros específicos durante un incendio: gases tóxicos, explosividad o reactividad térmica.",
  "5_3": "EPP para bomberos: equipo autónomo de respiración y traje de protección química.",
  "6_1": "Precauciones personales: EPP requerido y procedimiento de evacuación ante un derrame.",
  "6_2": "Medidas para prevenir la contaminación de suelos, aguas superficiales y alcantarillado.",
  "6_3": "Métodos de contención (diques, absorbentes) y materiales adecuados para la limpieza.",
  "7_1": "Precauciones para la manipulación segura: ventilación, evitar fuentes de ignición y EPP básico.",
  "7_2": "Condiciones de almacenamiento: temperatura límite, humedad, incompatibilidades y tipo de recipiente.",
  "7_3": "Usos finales específicos del producto y condiciones técnicas particulares asociadas.",
  "8_1": "Valores límite de exposición ocupacional (TLV-TWA, TLV-STEL) establecidos por autoridades competentes.",
  "8_2": "Controles de ingeniería: ventilación local o general para mantener la exposición por debajo de los límites.",
  "8_3": "EPP completo con especificaciones técnicas: tipo de respirador, gafas, guantes y ropa de protección.",
  "9_1": "Estado físico, color, olor, pH, punto de fusión/ebullición, punto de inflamación, densidad y solubilidad en agua.",
  "10_1": "Condiciones en las que el producto puede reaccionar de forma peligrosa (oxidantes, ácidos, etc.).",
  "10_2": "Declaración de estabilidad química bajo condiciones normales de uso y almacenamiento.",
  "10_3": "Reacciones peligrosas posibles: polimerización incontrolada, descomposición exotérmica.",
  "10_4": "Condiciones a evitar: calor excesivo, humedad, luz UV o impactos mecánicos.",
  "10_5": "Sustancias con las que no debe mezclarse ni almacenarse por riesgo de reacción.",
  "10_6": "Productos de descomposición térmica u oxidativa que puedan generarse durante un incidente.",
  "11_1": "Toxicidad aguda (LD₅₀/LC₅₀), efectos de irritación, corrosión, sensibilización y toxicidad repetida.",
  "11_2": "Vías relevantes de exposición: inhalación, ingestión, contacto dérmico y ocular.",
  "11_3": "Síntomas relacionados con las propiedades físico-químicas del producto (ej. narcosis, irritación).",
  "11_4": "Efectos inmediatos, subcrónicos y crónicos por exposición repetida o prolongada.",
  "11_5": "Valores cuantitativos de toxicidad: DL₅₀ oral o dérmico y CL₅₀ por inhalación.",
  "12_1": "Toxicidad acuática: EC₅₀ o CL₅₀ para peces, dafnia o algas (aguda o crónica).",
  "12_2": "Biodegradabilidad (DBO/DQO) y persistencia en el ambiente.",
  "12_3": "Factor de bioconcentración (FBC) o coeficiente de partición octanol/agua (log Kow).",
  "12_4": "Potencial de lixiviación al suelo y aguas subterráneas.",
  "12_5": "Efectos sobre la capa de ozono o potencial de calentamiento global si aplica.",
  "13_1": "Métodos de eliminación conformes a la normativa: disposición como residuo peligroso, incineración controlada o reciclaje.",
  "14_1": "Número ONU (UN XXXX) asignado por el Comité de Expertos de la ONU para el transporte.",
  "14_2": "Denominación oficial de transporte establecida en las Recomendaciones de la ONU (naranja book).",
  "14_3": "Clase de peligro para transporte (ADR/IMDG/IATA) y subclase si corresponde.",
  "14_4": "Grupo de embalaje I, II o III según el grado de peligro para el transporte.",
  "14_5": "Indicación de si el producto es peligroso para el medio ambiente marino (Marine Pollutant).",
  "14_6": "Precauciones especiales del usuario durante carga, transporte y descarga.",
  "15_1": "Referencias a reglamentaciones nacionales e internacionales: inventarios de sustancias, restricciones o autorizaciones aplicables.",
  "16_1": "Fecha de elaboración o última revisión de la FDS, fuentes consultadas y lista de cambios respecto a la versión anterior.",
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

// ── Snippet helpers ──────────────────────────────────────────────────────────
const ES_STOP = new Set([
  "de","del","la","el","los","las","y","o","en","a","con","por","para","que",
  "se","no","un","una","su","al","sus","es","lo","le","les","este","esta","esto",
  "como","también","donde","cuando","entre","sobre","bajo","sin","ser","han",
  "sido","fue","son","hay","pero","todo","todos","toda","todas","ante","más",
]);

function getKeywords(description: string): string[] {
  return description
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !ES_STOP.has(w));
}

function extractSnippet(
  fullText: string,
  description: string
): { lines: string[]; keywords: string[] } {
  const keywords = getKeywords(description);
  const allLines = fullText.split("\n").filter((l) => l.trim());
  if (!keywords.length || !allLines.length) return { lines: allLines.slice(0, 8), keywords: [] };

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let bestScore = 0;
  let bestIdx = 0;
  allLines.forEach((line, idx) => {
    const n = norm(line);
    const score = keywords.reduce((s, kw) => s + (n.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; bestIdx = idx; }
  });

  const start = Math.max(0, bestIdx - 2);
  const end = Math.min(allLines.length - 1, bestIdx + 5);
  return { lines: allLines.slice(start, end + 1), keywords };
}

function HighlightLine({ text, keywords }: { text: string; keywords: string[] }) {
  if (!keywords.length) return <>{text}</>;
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const normText = norm(text);
  const raw: { start: number; end: number }[] = [];
  keywords.forEach((kw) => {
    let pos = 0;
    while (true) {
      const idx = normText.indexOf(kw, pos);
      if (idx === -1) break;
      raw.push({ start: idx, end: idx + kw.length });
      pos = idx + 1;
    }
  });
  if (!raw.length) return <>{text}</>;
  raw.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const m of raw) {
    if (merged.length && m.start <= merged[merged.length - 1].end)
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, m.end);
    else merged.push({ ...m });
  }
  const parts: React.ReactNode[] = [];
  let pos = 0;
  merged.forEach(({ start, end }, i) => {
    if (pos < start) parts.push(<span key={`t${i}`}>{text.slice(pos, start)}</span>);
    parts.push(
      <mark key={`m${i}`} style={{ background: "rgba(16,185,129,0.28)", color: "#6ee7b7", borderRadius: 2, padding: "0 2px", fontWeight: 600 }}>
        {text.slice(start, end)}
      </mark>
    );
    pos = end;
  });
  if (pos < text.length) parts.push(<span key="tail">{text.slice(pos)}</span>);
  return <>{parts}</>;
}

// ── Single checklist row ─────────────────────────────────────────────────────
function CheckRow({
  label,
  present,
  isFirst,
  onPresenteClick,
}: {
  label: string;
  present: boolean;
  isFirst: boolean;
  onPresenteClick?: (label: string) => void;
}) {
  const [pulseKey, setPulseKey] = useState(0);
  const [pulsing, setPulsing] = useState(false);
  const [showExpected, setShowExpected] = useState(false);

  const handlePillClick = () => {
    if (present) {
      setPulseKey((k) => k + 1);
      setPulsing(true);
      setTimeout(() => setPulsing(false), 650);
      onPresenteClick?.(label);
    } else {
      setShowExpected((v) => !v);
    }
  };

  const key = getItemKey(label);
  const description = getItemDescription(label);
  const level = getIndentLevel(key);
  const isSectionTitle = key.endsWith("_0");
  const expectedText = !present && !isSectionTitle
    ? (ITEM_EXPECTATIONS[key] ?? `Este ítem (${key}) debe estar presente en la sección según la normativa SGA. Revisar el documento original para verificar su ausencia.`)
    : null;

  return (
    <>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 14px 7px 0",
        paddingLeft: `${14 + level * 22}px`,
        borderTop: isFirst ? "none" : "1px solid var(--border)",
        background: showExpected ? "rgba(245,158,11,0.03)" : "transparent",
        transition: "background 0.2s",
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
      <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
        <span
          onClick={(present || expectedText) ? handlePillClick : undefined}
          title={present ? "Ver en contexto" : expectedText ? "Ver qué se espera" : undefined}
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 10px",
            borderRadius: 20,
            whiteSpace: "nowrap",
            background: present
              ? "rgba(16,185,129,0.1)"
              : showExpected
              ? "rgba(245,158,11,0.15)"
              : "rgba(239,68,68,0.07)",
            color: present ? "#10b981" : showExpected ? "#f59e0b" : "#ef4444",
            border: `1px solid ${
              present
                ? "rgba(16,185,129,0.25)"
                : showExpected
                ? "rgba(245,158,11,0.4)"
                : "rgba(239,68,68,0.18)"
            }`,
            cursor: (present || expectedText) ? "pointer" : "default",
            transition: "background 0.15s, color 0.15s, border-color 0.15s",
            userSelect: "none",
          }}
        >
          {present ? "Presente" : "No presente"}
        </span>
        {pulsing && (
          <span
            key={pulseKey}
            style={{
              position: "absolute",
              inset: -2,
              borderRadius: 20,
              border: "2px solid #10b981",
              animation: "rippleOut 0.65s ease-out forwards",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    </div>

    {/* Panel de expectativa (No presente) */}
    {showExpected && expectedText && (
      <div
        style={{
          margin: "0 12px 4px",
          marginLeft: `${38 + level * 22}px`,
          padding: "7px 10px",
          borderLeft: "3px solid #f59e0b",
          background: "rgba(245,158,11,0.06)",
          borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", flexShrink: 0, paddingTop: 1 }}>
          Se espera
        </span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          {expectedText}
        </span>
      </div>
    )}
    </>
  );
}

// ── Section accordion card ───────────────────────────────────────────────────
function SectionChecklist({ sec, docId, year }: { sec: AuditSectionResult; docId: string; year?: number }) {
  const [open, setOpen] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [sectionText, setSectionText] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState("");
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [snippetKey, setSnippetKey] = useState(0);

  const loadContent = async () => {
    if (sectionText !== null) return;
    setContentLoading(true);
    setContentError("");
    try {
      const res = await fetchSectionContent(docId, sec.seccion, year);
      setSectionText(res.contenido || "(Sección sin contenido)");
    } catch {
      setContentError("No se pudo cargar el contenido de esta sección.");
    } finally {
      setContentLoading(false);
    }
  };

  const handleToggleContent = async () => {
    if (showContent) { setShowContent(false); return; }
    setShowContent(true);
    await loadContent();
  };

  const handlePresenteClick = async (label: string) => {
    if (activeItem === label) { setActiveItem(null); return; }
    setActiveItem(label);
    setSnippetKey((k) => k + 1);
    if (sectionText === null && !contentLoading) await loadContent();
  };

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

      {/* Botón ver contenido */}
      <button
        onClick={(e) => { e.stopPropagation(); handleToggleContent(); }}
        style={{
          margin: "0 10px 8px auto",
          display: "block",
          fontSize: 11,
          padding: "3px 10px",
          background: showContent ? "rgba(99,102,241,0.12)" : "var(--surface-2)",
          border: `1px solid ${showContent ? "rgba(99,102,241,0.4)" : "var(--border)"}`,
          borderRadius: "var(--radius-sm)",
          color: showContent ? "#6366f1" : "var(--text-secondary)",
          cursor: "pointer",
        }}
      >
        {showContent ? "Ocultar contenido" : "Ver contenido §" + sec.seccion}
      </button>

      {/* Panel de contenido completo de la sección */}
      {showContent && (
        <div
          style={{
            margin: "0 10px 10px",
            padding: "10px 16px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: 12,
            lineHeight: 1.7,
            color: "var(--text-secondary)",
            maxHeight: 380,
            overflowY: "auto",
          }}
        >
          {contentLoading && <span style={{ color: "var(--text-muted)" }}>Cargando…</span>}
          {contentError && <span style={{ color: "var(--error)" }}>{contentError}</span>}
          {!contentLoading && !contentError && sectionText && (
            <div className="prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{sectionText}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* Checklist body */}
      {open && items.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {items.map((item, idx) => {
            const isActive = activeItem === item.item;
            const snippet =
              isActive && sectionText
                ? extractSnippet(sectionText, getItemDescription(item.item))
                : null;

            return (
              <React.Fragment key={idx}>
                <CheckRow
                  label={item.item}
                  present={item.presencia === "Presente"}
                  isFirst={idx === 0}
                  onPresenteClick={handlePresenteClick}
                />
                {isActive && (
                  <div
                    style={{
                      margin: "0 12px 6px 38px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid rgba(16,185,129,0.35)",
                      background: "rgba(16,185,129,0.04)",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Scan line animation */}
                    <div
                      key={snippetKey}
                      style={{
                        position: "absolute",
                        top: 0, left: 0, right: 0,
                        height: 2,
                        background: "linear-gradient(90deg, transparent, #10b981 30%, #6ee7b7 50%, #10b981 70%, transparent)",
                        boxShadow: "0 0 10px 3px rgba(16,185,129,0.5)",
                        animation: "scanDown 0.9s ease-in-out forwards",
                        pointerEvents: "none",
                        zIndex: 2,
                      }}
                    />
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 10px 4px", borderBottom: "1px solid rgba(16,185,129,0.15)" }}>
                      <span style={{ fontSize: 10, color: "#10b981", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        Extracto del documento
                      </span>
                      <button
                        onClick={() => setActiveItem(null)}
                        style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, padding: "0 2px", lineHeight: 1, cursor: "pointer" }}
                      >
                        ✕
                      </button>
                    </div>
                    {/* Content */}
                    <div style={{ padding: "7px 10px 8px", fontSize: 11.5, lineHeight: 1.65, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                      {contentLoading && <span style={{ color: "var(--text-muted)" }}>Cargando…</span>}
                      {contentError && <span style={{ color: "var(--error)" }}>{contentError}</span>}
                      {snippet && snippet.lines.map((line, li) => (
                        <div key={li} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          <HighlightLine text={line} keywords={snippet.keywords} />
                        </div>
                      ))}
                      {!contentLoading && !contentError && !snippet && sectionText === null && (
                        <span style={{ color: "var(--text-muted)" }}>Cargando contenido…</span>
                      )}
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
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
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [existingMeta, setExistingMeta] = useState<{ created_at: string | null; updated_at: string | null } | null>(null);

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

  const doRunAudit = async (force: boolean) => {
    setResult(null);
    await runAudit(selectedDoc, force);
    setPollingId(selectedDoc);
  };

  const handleRun = async () => {
    if (!selectedDoc) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const meta = await checkAuditExists(selectedDoc);
      if (meta.exists) {
        setExistingMeta({ created_at: meta.created_at, updated_at: meta.updated_at });
        setShowConfirm(true);
        return;
      }
      await doRunAudit(false);
    } catch {
      setErrorMsg("Error al iniciar la auditoría. Verifica que la API esté activa.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRerun = async () => {
    setShowConfirm(false);
    setExistingMeta(null);
    setLoading(true);
    setErrorMsg("");
    try {
      await doRunAudit(true);
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
    Object.assign(document.createElement("a"), { href: url, download: filename }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Filas ordenadas: sección asc, luego por ID numérico de ítem
  const buildRows = () =>
    (result?.secciones ?? [])
      .slice()
      .sort((a, b) => a.seccion - b.seccion)
      .flatMap((s) =>
        (s.items ?? []).map((it) => ({
          seccion: s.seccion,
          nombreSeccion: SECTION_NAMES[s.seccion] ?? `Sección ${s.seccion}`,
          id: getItemKey(it.item),
          descripcion: getItemDescription(it.item),
          presente: it.presencia === "Presente",
        }))
      );

  const downloadTxt = () => {
    if (!result) return;
    const rows = buildRows();
    const COL = [6, 36, 10, 46, 12] as const;
    const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
    const sep = COL.map((n) => "-".repeat(n)).join("-+-") + "-+";
    const header =
      pad("§", COL[0]) + " | " +
      pad("Sección", COL[1]) + " | " +
      pad("ID", COL[2]) + " | " +
      pad("Descripción", COL[3]) + " | " +
      pad("Presencia", COL[4]) + " |";
    const lines = [
      `AUDITORÍA SGA — ${result.doc_id}`,
      `Generado: ${new Date().toLocaleString("es-CO")}`,
      "",
      header,
      sep,
      ...rows.map((r) =>
        pad(String(r.seccion), COL[0]) + " | " +
        pad(r.nombreSeccion, COL[1]) + " | " +
        pad(r.id, COL[2]) + " | " +
        pad(r.descripcion, COL[3]) + " | " +
        pad(r.presente ? "Presente" : "No presente", COL[4]) + " |"
      ),
    ];
    dl(lines.join("\n"), `Auditoria_SGA_${selectedDoc}.txt`, "text/plain;charset=utf-8;");
  };

  const downloadCsv = () => {
    if (!result) return;
    const rows = buildRows();
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [
      ["Sección", "Nombre sección", "ID", "Descripción", "Presencia"].map(esc).join(","),
      ...rows.map((r) =>
        [String(r.seccion), r.nombreSeccion, r.id, r.descripcion,
          r.presente ? "Presente" : "No presente"].map(esc).join(",")
      ),
    ];
    dl(lines.join("\n"), `Auditoria_SGA_${selectedDoc}.csv`, "text/csv;charset=utf-8;");
  };

  const downloadMd = () => {
    if (!result) return;
    const rows = buildRows();
    // Agrupar por sección para generar una tabla por sección
    const porSeccion = new Map<number, typeof rows>();
    rows.forEach((r) => {
      if (!porSeccion.has(r.seccion)) porSeccion.set(r.seccion, []);
      porSeccion.get(r.seccion)!.push(r);
    });
    const bloques = [...porSeccion.entries()].map(([num, items]) => {
      const nombre = SECTION_NAMES[num] ?? `Sección ${num}`;
      const filas = items
        .map((r) => `| ${r.id} | ${r.descripcion} | ${r.presente ? "✅ Presente" : "❌ No presente"} |`)
        .join("\n");
      return `## Sección ${num} — ${nombre}\n\n| ID | Descripción | Presencia |\n|---|---|---|\n${filas || "| — | Sin datos | — |"}`;
    });
    const md = `# Auditoría SGA — ${result.doc_id}\n\n_Generado: ${new Date().toLocaleString("es-CO")}_\n\n---\n\n${bloques.join("\n\n---\n\n")}`;
    dl(md, `Auditoria_SGA_${selectedDoc}.md`, "text/markdown;charset=utf-8;");
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
    <div style={{ width: "100%" }}>
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
            const docId = e.target.value;
            setSelectedDoc(docId);
            setSelectedYear(docs.find((d) => d.doc_id === docId)?.year ?? null);
            setResult(null);
            setErrorMsg("");
            setShowConfirm(false);
            setExistingMeta(null);
          }}
          style={{ flex: 1, minWidth: 220 }}
        >
          <option value="">— Seleccionar documento —</option>
          {docs.map((d) => (
            <option key={d.doc_id} value={d.doc_id}>
              {d.year ? `[${d.year}] ${d.doc_id}` : d.doc_id}
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

      {/* Confirmación re-auditar */}
      {showConfirm && existingMeta && (
        <div
          style={{
            padding: "0.85rem 1rem",
            background: "rgba(245,158,11,0.07)",
            border: "1px solid rgba(245,158,11,0.35)",
            borderRadius: "var(--radius)",
            fontSize: 13,
            color: "var(--text)",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ flex: 1 }}>
            Este documento ya tiene una auditoría
            {existingMeta.created_at && (
              <>
                {" "}del{" "}
                <strong>
                  {new Date(existingMeta.created_at).toLocaleDateString("es-CO", {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </strong>
              </>
            )}
            . ¿Desea realizarla de nuevo?
          </span>
          <button
            onClick={() => { setShowConfirm(false); setExistingMeta(null); }}
            style={btnBase}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmRerun}
            style={{ ...btnPrimary, background: "#f59e0b" }}
          >
            Re-auditar
          </button>
        </div>
      )}

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

          {/* Banner de cambios detectados */}
          {result.changes && (() => {
            const ch = result.changes as AuditChanges;
            const total = ch.added.length + ch.removed.length + ch.status_changed.length;
            if (ch.note && total === 0) return (
              <div style={{
                padding: "0.7rem 1rem", marginBottom: "1rem", fontSize: 12,
                background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.25)",
                borderRadius: "var(--radius)", color: "var(--text-secondary)",
              }}>
                {ch.note}
              </div>
            );
            if (total === 0) return null;
            return (
              <div style={{
                padding: "0.7rem 1rem", marginBottom: "1rem", fontSize: 12,
                background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: "var(--radius)", color: "var(--text)",
                display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center",
              }}>
                <span style={{ fontWeight: 500 }}>
                  {total} cambio{total !== 1 ? "s" : ""} respecto a la auditoría anterior
                </span>
                {ch.status_changed.length > 0 && (
                  <span style={{ color: "var(--text-secondary)" }}>
                    {ch.status_changed.length} ítem{ch.status_changed.length !== 1 ? "s" : ""} con estado diferente
                  </span>
                )}
                {ch.added.length > 0 && (
                  <span style={{ color: "#10b981" }}>+{ch.added.length} nuevo{ch.added.length !== 1 ? "s" : ""}</span>
                )}
                {ch.removed.length > 0 && (
                  <span style={{ color: "#ef4444" }}>−{ch.removed.length} eliminado{ch.removed.length !== 1 ? "s" : ""}</span>
                )}
              </div>
            );
          })()}

          {/* Per-section checklists */}
          {secciones.map((s) => (
            <SectionChecklist key={s.seccion} sec={s} docId={selectedDoc} year={selectedYear ?? undefined} />
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