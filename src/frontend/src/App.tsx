import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Audit from "./pages/Audit";
import Convert from "./pages/Convert";
import "./index.css";

const NAV_ITEMS = [
  { to: "/", label: "Documentos", exact: true },
  { to: "/search", label: "Búsqueda" },
  { to: "/audit", label: "Auditoría" },
  { to: "/convert", label: "TXT → MD" },
];

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar */}
        <nav
          style={{
            width: 200,
            background: "var(--surface)",
            borderRight: "1px solid var(--border)",
            padding: "1.5rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--text-muted)",
              letterSpacing: "0.1em",
              marginBottom: "1rem",
              paddingLeft: "0.5rem",
            }}
          >
            RAG FDS / SGA
          </div>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              style={({ isActive }) => ({
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius)",
                fontSize: "0.9rem",
                color: isActive ? "#fff" : "var(--text-muted)",
                background: isActive ? "var(--accent)" : "transparent",
                fontWeight: isActive ? 600 : 400,
                textDecoration: "none",
                transition: "all 0.15s",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Contenido */}
        <main style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/convert" element={<Convert />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}