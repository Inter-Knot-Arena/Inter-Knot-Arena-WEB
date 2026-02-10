import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import SearchBar from "./SearchBar";
import UserMenu from "./UserMenu";
import { useAuth } from "../auth/AuthProvider";

const navItems = [
  {
    to: "/matchmaking",
    label: "Matchmaking",
    icon: (
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="7" strokeWidth="2" />
        <path d="M12 5v3M12 16v3M5 12h3M16 12h3" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  },
  {
    to: "/leaderboards",
    label: "Leaderboards",
    icon: (
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M5 19V9M12 19V5M19 19v-8" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  },
  {
    to: "/agents",
    label: "Agents",
    icon: (
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="8" r="3" strokeWidth="2" />
        <path
          d="M5 19c1.5-3 4-5 7-5s5.5 2 7 5"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    to: "/rulesets",
    label: "Rulesets",
    icon: (
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M4 6h16M4 12h16M4 18h16" strokeWidth="2" strokeLinecap="round" />
        <circle cx="9" cy="6" r="2" strokeWidth="2" />
        <circle cx="15" cy="12" r="2" strokeWidth="2" />
        <circle cx="7" cy="18" r="2" strokeWidth="2" />
      </svg>
    )
  },
  {
    to: "/admin",
    label: "Admin",
    icon: (
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M12 3l7 3v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-3z"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
];

interface ShellProps {
  children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const { user } = useAuth();
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

  const canSeeAdmin =
    user?.roles?.includes("ADMIN") ||
    user?.roles?.includes("STAFF") ||
    user?.roles?.includes("MODER");

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
          {navItems
            .filter((item) => (item.to === "/admin" ? canSeeAdmin : true))
            .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              <span className="nav-icon" aria-hidden>
                {item.icon}
              </span>
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
          <UserMenu />
        </div>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <div>Inter-Knot Arena beta</div>
        <div>API-free, proof-driven ranking with moderation review.</div>
      </footer>
    </div>
  );
}
