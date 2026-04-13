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
        <nav
          style={{
            width: 200,
            background: "var(--color-background-secondary)",
            borderRight: "0.5px solid var(--color-border-tertiary)",
            padding: "1.5rem 0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--color-text-secondary)",
              letterSpacing: "0.08em",
              marginBottom: "1rem",
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
                padding: "0.45rem 0.75rem",
                borderRadius: "var(--border-radius-md)",
                fontSize: 13,
                color: isActive
                  ? "var(--color-text-primary)"
                  : "var(--color-text-secondary)",
                background: isActive
                  ? "var(--color-background-primary)"
                  : "transparent",
                fontWeight: isActive ? 500 : 400,
                textDecoration: "none",
                border: isActive
                  ? "0.5px solid var(--color-border-tertiary)"
                  : "0.5px solid transparent",
                transition: "all 0.1s",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main
          style={{
            flex: 1,
            padding: "2rem",
            overflowY: "auto",
            background: "var(--color-background-tertiary)",
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