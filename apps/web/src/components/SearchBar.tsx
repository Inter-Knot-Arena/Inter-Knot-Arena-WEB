import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Agent, Ruleset, User } from "@ika/shared";
import { fetchAgents, fetchRulesets, fetchUsers } from "../api";

interface SearchItem {
  id: string;
  label: string;
  meta: string;
  to: string;
}

interface SearchBarProps {
  language: string;
}

const labels = {
  ru: {
    label: "Поиск",
    placeholder: "Поиск...",
    empty: "Ничего не найдено",
    player: "Игрок",
    agent: "Агент",
    ruleset: "Ruleset"
  },
  en: {
    label: "Search",
    placeholder: "Search...",
    empty: "No matches found",
    player: "Player",
    agent: "Agent",
    ruleset: "Ruleset"
  }
};

export default function SearchBar({ language }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchUsers().then(setUsers);
    fetchAgents().then(setAgents);
    fetchRulesets().then(setRulesets);
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const text = labels[language as keyof typeof labels] ?? labels.ru;

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 2) {
      return [] as SearchItem[];
    }

    const userMatches = users
      .filter((user) => user.displayName.toLowerCase().includes(trimmed))
      .map((user) => ({
        id: user.id,
        label: user.displayName,
        meta: `${text.player} · ${user.region}`,
        to: `/profile/${user.id}`
      }));

    const agentMatches = agents
      .filter((agent) => agent.name.toLowerCase().includes(trimmed))
      .map((agent) => ({
        id: agent.id,
        label: agent.name,
        meta: `${text.agent} · ${agent.role}`,
        to: "/agents"
      }));

    const rulesetMatches = rulesets
      .filter((ruleset) => ruleset.name.toLowerCase().includes(trimmed))
      .map((ruleset) => ({
        id: ruleset.id,
        label: ruleset.name,
        meta: `${text.ruleset} · ${ruleset.leagueId.replace("league_", "")}`,
        to: "/rulesets"
      }));

    return [...userMatches, ...agentMatches, ...rulesetMatches].slice(0, 6);
  }, [query, users, agents, rulesets, text]);

  const showResults = open && results.length > 0;
  const showEmpty = open && query.trim().length >= 2 && results.length === 0;

  return (
    <div className="search" ref={wrapperRef}>
      <button
        type="button"
        className="search-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={text.label}
      >
        <span className="search-icon" aria-hidden>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="7" strokeWidth="2" />
            <path d="M16.5 16.5L21 21" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <span className="search-label">{text.label}</span>
      </button>
      {open ? (
        <div className="search-panel">
          <input
            ref={inputRef}
            className="search-input"
            placeholder={text.placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
          />
          {showResults ? (
            <div className="search-results">
              {results.map((result) => (
                <Link
                  key={result.id}
                  className="search-result"
                  to={result.to}
                  onClick={() => setOpen(false)}
                >
                  <div className="search-result-title">{result.label}</div>
                  <div className="search-result-meta">{result.meta}</div>
                </Link>
              ))}
            </div>
          ) : null}
          {showEmpty ? (
            <div className="search-results">
              <div className="search-empty">{text.empty}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
