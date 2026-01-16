import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Agent, Rating, Ruleset, User } from "@ika/shared";
import { fetchAgents, fetchLeaderboard, fetchRulesets, fetchUsers } from "../api";

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [leaders, setLeaders] = useState<Rating[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetchAgents().then(setAgents);
    fetchRulesets().then(setRulesets);
    fetchLeaderboard("league_standard").then((ratings) => setLeaders(ratings.slice(0, 3)));
    fetchUsers().then(setUsers);
  }, []);

  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user.displayName])), [users]);

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-content fade-up">
          <p className="eyebrow">Inter-Knot Arena</p>
          <h1>Profiles, leaderboards, and catalogs for competitive ZZZ.</h1>
          <p className="lead">
            MVP-0 delivers public player profiles, league tables, and a shared
            agent and ruleset catalog. Ranked match flow arrives in the next
            milestone.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" to="/leaderboards">
              Browse leaderboards
            </Link>
            <Link className="ghost-button" to="/agents">
              Open catalog
            </Link>
          </div>
          <div className="hero-metrics">
            <div>
              <div className="metric-value">{users.length}</div>
              <div className="metric-label">Profiles</div>
            </div>
            <div>
              <div className="metric-value">{agents.length}</div>
              <div className="metric-label">Agents</div>
            </div>
            <div>
              <div className="metric-value">{rulesets.length}</div>
              <div className="metric-label">Rulesets</div>
            </div>
          </div>
        </div>
        <div className="hero-panel fade-up">
          <div className="panel-card">
            <div className="panel-title">Season status</div>
            <div className="panel-value">Season 01</div>
            <div className="panel-sub">Active - 60 days left</div>
            <div className="panel-list">
              <div>
                <span className="tag">Profiles</span>
                <span className="tag">Leaderboards</span>
                <span className="tag">Catalog</span>
              </div>
              <p>Rulesets remain data-driven and versioned.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Leaderboard snapshot</h2>
          <p>Top standard league standings from the current season.</p>
        </div>
        <div className="grid">
          {leaders.map((leader, index) => (
            <div key={leader.userId} className="card">
              <div className="card-header">
                <h3>#{index + 1}</h3>
                <span className="badge">{leader.elo} ELO</span>
              </div>
              <p>{userMap.get(leader.userId) ?? leader.userId}</p>
              <div className="meta-label">Standard league</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Agents catalog</h2>
          <p>Core roster available for drafts and ruleset checks.</p>
        </div>
        <div className="grid">
          {agents.slice(0, 4).map((agent) => (
            <div key={agent.id} className="card">
              <div className="card-header">
                <h3>{agent.name}</h3>
                <span className="badge-outline">{agent.role}</span>
              </div>
              <div className="chip-row">
                <span className="tag">{agent.element}</span>
                <span className="tag">{agent.faction}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Ruleset cards</h2>
          <p>League enforcement policy, versioned and visible.</p>
        </div>
        <div className="grid">
          {rulesets.map((ruleset) => (
            <div key={ruleset.id} className="card">
              <div className="card-header">
                <h3>{ruleset.name}</h3>
                <span className={ruleset.requireVerifier ? "badge" : "badge-outline"}>
                  {ruleset.requireVerifier ? "Verifier" : "Open"}
                </span>
              </div>
              <p>{ruleset.description}</p>
              <div className="chip-row">
                <span className="tag">{ruleset.leagueId.replace("league_", "")}</span>
                <span className="tag">{ruleset.version}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
