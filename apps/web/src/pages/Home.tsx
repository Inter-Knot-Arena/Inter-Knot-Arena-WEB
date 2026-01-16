import { useEffect, useState } from "react";
import type { QueueConfig } from "@ika/shared";
import { fetchQueues } from "../api";

export default function Home() {
  const [queues, setQueues] = useState<QueueConfig[]>([]);

  useEffect(() => {
    fetchQueues().then(setQueues);
  }, []);

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-content fade-up">
          <p className="eyebrow">Inter-Knot Arena</p>
          <h1>Compete on your client. Prove it on the platform.</h1>
          <p className="lead">
            Structured drafts, verifier-backed checks, and visible ELO across
            F2P, Standard, and Unlimited leagues. Build trust with evidence,
            climb with clean wins.
          </p>
          <div className="hero-actions">
            <button className="primary-button">Enter Matchmaking</button>
            <button className="ghost-button">See Rulesets</button>
          </div>
          <div className="hero-metrics">
            <div>
              <div className="metric-value">3</div>
              <div className="metric-label">Leagues</div>
            </div>
            <div>
              <div className="metric-value">12</div>
              <div className="metric-label">Live Challenges</div>
            </div>
            <div>
              <div className="metric-value">90s</div>
              <div className="metric-label">Draft Window</div>
            </div>
          </div>
        </div>
        <div className="hero-panel fade-up">
          <div className="panel-card">
            <div className="panel-title">Current Season</div>
            <div className="panel-value">Season 01</div>
            <div className="panel-sub">Active · 60 days left</div>
            <div className="panel-list">
              <div>
                <span className="tag">Verifier</span>
                <span className="tag">Draft</span>
                <span className="tag">ELO</span>
              </div>
              <p>
                Ranked queues require UID verification and verifier pre-checks.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Queues ready for deployment</h2>
          <p>Structured by league and ruleset for clean competition.</p>
        </div>
        <div className="grid stagger">
          {queues.map((queue) => (
            <div key={queue.id} className="card">
              <div className="card-header">
                <h3>{queue.name}</h3>
                <span className={queue.requireVerifier ? "badge" : "badge-outline"}>
                  {queue.requireVerifier ? "Verifier" : "Open"}
                </span>
              </div>
              <p>{queue.description}</p>
              <div className="card-footer">
                <div>
                  <div className="meta-label">League</div>
                  <div className="meta-value">{queue.leagueId.replace("league_", "")}</div>
                </div>
                <div>
                  <div className="meta-label">Ruleset</div>
                  <div className="meta-value">{queue.rulesetId.replace("ruleset_", "")}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section split">
        <div>
          <h2>How a ranked match is validated</h2>
          <p>
            No API access. No memory hooks. Only screen evidence and strict match
            states.
          </p>
        </div>
        <div className="steps">
          <div className="step">
            <div className="step-index">01</div>
            <div>
              <h4>Draft on the platform</h4>
              <p>Bans and picks are locked before the run begins.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-index">02</div>
            <div>
              <h4>Verifier pre-check</h4>
              <p>Screen capture confirms the drafted agents.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-index">03</div>
            <div>
              <h4>Result proof</h4>
              <p>Submit result screens or video for final confirmation.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
