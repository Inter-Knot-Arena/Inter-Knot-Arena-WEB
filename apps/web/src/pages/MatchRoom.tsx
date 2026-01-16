import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { Match } from "@ika/shared";
import { fetchMatch } from "../api";

export default function MatchRoom() {
  const { id } = useParams();
  const [match, setMatch] = useState<Match | null>(null);

  useEffect(() => {
    if (id) {
      fetchMatch(id).then(setMatch);
    }
  }, [id]);

  if (!match) {
    return <div className="card">Loading match...</div>;
  }

  return (
    <div className="page">
      <section className="section-header">
        <h2>Match Room</h2>
        <p>State machine, draft, and evidence pipeline.</p>
      </section>

      <section className="grid">
        <div className="card">
          <h3>Match State</h3>
          <div className="state-pill">{match.state}</div>
          <p>Queue: {match.queueId}</p>
          <div className="meta-row">
            <div>
              <div className="meta-label">League</div>
              <div className="meta-value">{match.leagueId}</div>
            </div>
            <div>
              <div className="meta-label">Ruleset</div>
              <div className="meta-value">{match.rulesetId}</div>
            </div>
            <div>
              <div className="meta-label">Challenge</div>
              <div className="meta-value">{match.challengeId}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Check-ins</h3>
          <div className="stack">
            {match.players.map((player) => (
              <div key={player.userId} className="row">
                <span>{player.userId}</span>
                <span className={player.checkin ? "badge" : "badge-outline"}>
                  {player.checkin ? "Ready" : "Waiting"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section split">
        <div>
          <h3>Draft timeline</h3>
          <p>Sequence aligned with the template.</p>
        </div>
        <div className="card">
          <div className="timeline">
            {match.draft.sequence.map((step, index) => {
              const action = match.draft.actions[index];
              return (
                <div key={`${step}-${index}`} className="timeline-item">
                  <div className="timeline-step">{step}</div>
                  <div className="timeline-body">
                    {action ? (
                      <div>
                        <div className="timeline-agent">{action.agentId}</div>
                        <div className="timeline-meta">{action.userId}</div>
                      </div>
                    ) : (
                      <div className="timeline-placeholder">Pending</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid">
        <div className="card">
          <h3>Pre-check evidence</h3>
          <p>{match.evidence.precheck.length} submissions</p>
          <button className="ghost-button">Upload pre-check</button>
        </div>
        <div className="card">
          <h3>In-run checks</h3>
          <p>{match.evidence.inrun.length} captures</p>
          <button className="ghost-button">Send in-run capture</button>
        </div>
        <div className="card">
          <h3>Result proof</h3>
          <p>{match.evidence.result ? "Submitted" : "Pending"}</p>
          <button className="primary-button">Submit result</button>
        </div>
      </section>
    </div>
  );
}
