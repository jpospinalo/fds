import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Audit from "./pages/Audit";
import Convert from "./pages/Convert";
import Upload from "./pages/Upload";
import "./index.css";

const NAV = [
  { to: "/", label: "Documentos", exact: true },
  { to: "/search", label: "Búsqueda" },
  { to: "/audit", label: "Auditoría" },
  { to: "/convert", label: "TXT → MD" },
  { to: "/upload", label: "Subir PDF" },
];

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* ── Sidebar de navegación ── */}
        <nav
          style={{
            width: 210,
            background: "var(--surface)",
            borderRight: "1px solid var(--border)",
            padding: "1.5rem 0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            flexShrink: 0,
            position: "sticky",
            top: 0,
            height: "100vh",
            overflowY: "auto",
          }}
        >
          {/* Logo / título */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-secondary)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: "1.25rem",
              paddingLeft: "0.75rem",
            }}
          >
            RAG FDS / SGA
          </div>

          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              style={({ isActive }) => ({
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius)",
                fontSize: 13,
                color: isActive ? "var(--text)" : "var(--text-secondary)",
                background: isActive ? "var(--surface-2)" : "transparent",
                fontWeight: isActive ? 600 : 400,
                textDecoration: "none",
                border: isActive
                  ? "1px solid var(--border)"
                  : "1px solid transparent",
                transition: "all 0.12s",
                display: "block",
              })}
            >
              {item.label}
            </NavLink>
          ))}

          {/* Footer del sidebar */}
          <div
            style={{
              marginTop: "auto",
              paddingTop: "1rem",
              paddingLeft: "0.75rem",
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            v1.0.0
          </div>
        </nav>

        {/* ── Contenido principal ── */}
        <main
          style={{
            flex: 1,
            padding: "2rem 2.5rem",
            overflowY: "auto",
            background: "var(--bg)",
            minWidth: 0,
          }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/convert" element={<Convert />} />
            <Route path="/upload" element={<Upload />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}