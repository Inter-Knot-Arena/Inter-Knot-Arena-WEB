import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/leaderboards", label: "Leaderboards" },
  { to: "/players", label: "Players" },
  { to: "/agents", label: "Agents" },
  { to: "/rulesets", label: "Rulesets" },
  { to: "/profile/user_ellen", label: "Profile" },
  { to: "/admin", label: "Admin" }
];

interface ShellProps {
  children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">IKA</div>
          <div>
            <div className="brand-title">Inter-Knot Arena</div>
            <div className="brand-subtitle">Competitive ZZZ platform</div>
          </div>
        </div>
        <nav className="nav-links">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-cta">
          <Link className="primary-button" to="/agents">
            Browse Catalog
          </Link>
        </div>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <div>Inter-Knot Arena beta</div>
        <div>Verifier-ready, API-free, proof-driven ranking.</div>
      </footer>
    </div>
  );
}
