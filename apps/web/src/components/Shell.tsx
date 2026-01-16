import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import SearchBar from "./SearchBar";

const navItems = [
  { to: "/matchmaking", label: "Matchmaking" },
  { to: "/leaderboards", label: "Leaderboards" },
  { to: "/agents", label: "Agents" },
  { to: "/rulesets", label: "Rulesets" },
  { to: "/admin", label: "Admin" }
];

interface ShellProps {
  children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const [language, setLanguage] = useState(() => {
    if (typeof window === "undefined") {
      return "ru";
    }
    return window.localStorage.getItem("ika:lang") ?? "ru";
  });
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ika:lang", language);
      document.documentElement.lang = language;
    }
  }, [language]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!langRef.current?.contains(event.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <Link className="brand-mark" to="/" title="Inter-Knot Arena">
            <img className="brand-logo" src="/logoIKA.png" alt="Inter-Knot Arena" />
          </Link>
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
        <div className="header-actions">
          <SearchBar language={language} />
          <div className="lang-menu" ref={langRef}>
            <button
              type="button"
              className="lang-button"
              onClick={() => setLangOpen((prev) => !prev)}
              aria-label="Change language"
              title={`Language: ${language.toUpperCase()}`}
            >
              <span className="lang-icon" aria-hidden>
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="9" strokeWidth="2" />
                  <path d="M3 12h18" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 3a12 12 0 0 0 0 18" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 3a12 12 0 0 1 0 18" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
            </button>
            {langOpen ? (
              <div className="lang-dropdown">
                <button
                  type="button"
                  className={language === "ru" ? "lang-option lang-option-active" : "lang-option"}
                  onClick={() => {
                    setLanguage("ru");
                    setLangOpen(false);
                  }}
                >
                  RU
                </button>
                <button
                  type="button"
                  className={language === "en" ? "lang-option lang-option-active" : "lang-option"}
                  onClick={() => {
                    setLanguage("en");
                    setLangOpen(false);
                  }}
                >
                  EN
                </button>
              </div>
            ) : null}
          </div>
          <div className="status-pill">
            <span className="status-dot" />
            Season 01
          </div>
          <Link className="avatar-button" to="/profile/user_ellen" title="Open profile">
            <span className="avatar-initials">E</span>
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
