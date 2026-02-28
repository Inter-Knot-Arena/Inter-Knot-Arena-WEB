import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useState } from "react";
import { FileText, Menu, Settings, Swords, Trophy, Users, X } from "lucide-react";
import SearchBar from "./SearchBar";
import UserMenu from "./UserMenu";
import { useAuth } from "../auth/AuthProvider";

const navItems = [
  { to: "/matchmaking", label: "Matchmaking", icon: Swords },
  { to: "/leaderboards", label: "Leaderboards", icon: Trophy },
  { to: "/agents", label: "Agents", icon: Users },
  { to: "/rulesets", label: "Rulesets", icon: FileText },
  { to: "/admin", label: "Admin", icon: Settings }
];

interface ShellProps {
  children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const language =
    typeof window === "undefined" ? "ru" : window.localStorage.getItem("ika:lang") ?? "ru";

  const canSeeAdmin = user?.roles?.some((role) => ["ADMIN", "STAFF", "MODER"].includes(role));

  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-white/[0.08] bg-black/60 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <img src="/logoIKA.png" alt="Logo" className="h-8 w-8 object-contain" />
            <span className="hidden font-display text-xl tracking-wide text-white sm:block">
              INTER-KNOT ARENA
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems
              .filter((item) => (item.to === "/admin" ? canSeeAdmin : true))
              .map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-white/10 text-white"
                          : "text-ink-500 hover:bg-white/5 hover:text-ink-900"
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 opacity-70 transition-colors group-hover:text-accent-400 group-hover:opacity-100" />
                    {item.label}
                  </NavLink>
                );
              })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:block">
            <SearchBar language={language} />
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-ink-500 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-500 shadow-[0_0_8px_rgba(247,155,79,0.8)]" />
            Season 01
          </div>

          <UserMenu />

          <button
            type="button"
            className="text-ink-500 transition-colors hover:text-white md:hidden"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div className="border-b border-white/10 bg-black/80 p-4 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-1">
            {navItems
              .filter((item) => (item.to === "/admin" ? canSeeAdmin : true))
              .map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive ? "bg-white/10 text-white" : "text-ink-500 hover:bg-white/5 hover:text-ink-900"
                      }`
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
          </nav>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-7xl flex-1 p-6 md:p-8">{children}</main>
    </div>
  );
}
