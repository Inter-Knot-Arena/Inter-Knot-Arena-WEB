import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { Agent, DraftAction, DraftActionType, EvidenceResult, Match } from "@ika/shared";
import {
  checkinMatch,
  confirmMatchResult,
  fetchAgents,
  fetchMatch,
  openDispute,
  submitDraftAction,
  submitInrun,
  submitPrecheck,
  submitResult
} from "../api";
import { useAuth } from "../auth/AuthProvider";

function readCurrentUserId(): string {
  if (typeof window === "undefined") {
    return "user_ellen";
  }
  return window.localStorage.getItem("ika:userId") ?? "user_ellen";
}

function nextDraftAction(match: Match): DraftActionType | null {
  return match.draft.sequence[match.draft.actions.length] ?? null;
}

function getUserSide(match: Match, userId: string): "A" | "B" | null {
  return match.players.find((player) => player.userId === userId)?.side ?? null;
}

function isUserTurn(match: Match, userId: string): boolean {
  const nextAction = nextDraftAction(match);
  const side = getUserSide(match, userId);
  if (!nextAction || !side) {
    return false;
  }
  return (nextAction.endsWith("_A") && side === "A") || (nextAction.endsWith("_B") && side === "B");
}

function draftedAgentSet(actions: DraftAction[]): Set<string> {
  return new Set(actions.map((action) => action.agentId));
}

function userDraftedAgents(match: Match, userId: string): string[] {
  const side = getUserSide(match, userId);
  if (!side) {
    return [];
  }
  return match.draft.actions
    .filter((action) => action.type.startsWith("PICK") && action.type.endsWith(`_${side}`))
    .map((action) => action.agentId);
}

export default function MatchRoom() {
  const { id } = useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [fallbackUserId] = useState(readCurrentUserId);
  const currentUserId = user?.id ?? fallbackUserId;
  const [resultType, setResultType] = useState<"TIME_MS" | "SCORE" | "RANK_TIER">("TIME_MS");
  const [resultValue, setResultValue] = useState<string>("");
  const [proofUrl, setProofUrl] = useState<string>("");
  const [disputeReason, setDisputeReason] = useState<string>("");

  useEffect(() => {
    if (id) {
      fetchMatch(id).then(setMatch);
      fetchAgents().then(setAgents);
    }
  }, [id]);

  const draftedAgents = useMemo(() => (match ? draftedAgentSet(match.draft.actions) : new Set()), [match]);

  if (!match) {
    return <div className="card">Loading match...</div>;
  }

  const nextAction = nextDraftAction(match);
  const canAct = match.state === "DRAFTING" && isUserTurn(match, currentUserId);
  const side = getUserSide(match, currentUserId);
  const userPicks = userDraftedAgents(match, currentUserId);
  const evidenceAgents = userPicks.length ? userPicks.slice(0, 3) : agents.slice(0, 3).map((agent) => agent.id);

  const handleCheckin = async () => {
    try {
      setError(null);
      const updated = await checkinMatch(match.id, currentUserId);
      setMatch(updated);
    } catch {
      setError("Check-in failed.");
    }
  };

  const handleDraftSelect = async (agentId: string) => {
    if (!nextAction) {
      return;
    }
    try {
      setError(null);
      const updated = await submitDraftAction(match.id, currentUserId, nextAction, agentId);
      setMatch(updated);
    } catch {
      setError("Draft action failed.");
    }
  };

  const handlePrecheck = async (result: EvidenceResult) => {
    try {
      setError(null);
      const updated = await submitPrecheck(match.id, {
        detectedAgents: evidenceAgents,
        result,
        confidence: Object.fromEntries(evidenceAgents.map((agentId) => [agentId, 0.92]))
      });
      setMatch(updated);
    } catch {
      setError("Precheck upload failed.");
    }
  };

  const handleInrun = async (result: EvidenceResult) => {
    try {
      setError(null);
      const updated = await submitInrun(match.id, {
        detectedAgents: evidenceAgents,
        result,
        confidence: Object.fromEntries(evidenceAgents.map((agentId) => [agentId, 0.88]))
      });
      setMatch(updated);
    } catch {
      setError("In-run upload failed.");
    }
  };

  const handleResultSubmit = async () => {
    try {
      setError(null);
      const updated = await submitResult(match.id, {
        metricType: resultType,
        value: resultValue || "0",
        proofUrl: proofUrl || "proof://placeholder"
      });
      setMatch(updated);
    } catch {
      setError("Result submission failed.");
    }
  };

  const handleConfirm = async () => {
    try {
      setError(null);
      const updated = await confirmMatchResult(match.id, currentUserId);
      setMatch(updated);
    } catch {
      setError("Confirm failed.");
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) {
      setError("Add a dispute reason first.");
      return;
    }
    try {
      setError(null);
      await openDispute(match.id, currentUserId, disputeReason);
      const updated = await fetchMatch(match.id);
      setMatch(updated);
      setDisputeReason("");
    } catch {
      setError("Dispute submission failed.");
    }
  };

  return (
    <div className="page">
      <section className="section-header">
        <h2>Match Room</h2>
        <p>Queue matchmaking, draft flow, proofs, and disputes.</p>
      </section>

      {error ? <div className="card">{error}</div> : null}

      <section className="grid">
        <div className="card">
          <h3>Match State</h3>
          <div className="state-pill">{match.state}</div>
          <p>Queue: {match.queueId ?? "custom"}</p>
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
          {match.state === "CHECKIN" &&
          !match.players.find((player) => player.userId === currentUserId)?.checkin ? (
            <button className="primary-button" onClick={handleCheckin}>
              Check in
            </button>
          ) : null}
        </div>
      </section>

      <section className="section split">
        <div>
          <h3>Draft controls</h3>
          <p>Current action: {nextAction ?? "Complete"}</p>
          <p>{side ? `Your side: ${side}` : "User not assigned"}</p>
          <p>{canAct ? "You can act now." : "Waiting for opponent."}</p>
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

      <section className="section">
        <div className="section-header">
          <h2>Draft selection</h2>
          <p>Select an agent for the current action.</p>
        </div>
        <div className="grid">
          {agents.map((agent) => {
            const disabled = draftedAgents.has(agent.id) || !canAct || !nextAction;
            return (
              <button
                key={agent.id}
                className="card card-button"
                onClick={() => handleDraftSelect(agent.id)}
                disabled={disabled}
              >
                <div className="card-header">
                  <h3>{agent.name}</h3>
                  <span className="badge-outline">{agent.role}</span>
                </div>
                <div className="chip-row">
                  <span className="tag">{agent.element}</span>
                  <span className="tag">{agent.faction}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid">
        <div className="card">
          <h3>Pre-check evidence</h3>
          <p>{match.evidence.precheck.length} submissions</p>
          <div className="card-actions">
            <button className="ghost-button" onClick={() => handlePrecheck("LOW_CONF")}>
              Submit low-conf
            </button>
            <button className="primary-button" onClick={() => handlePrecheck("PASS")}>
              Submit pass
            </button>
          </div>
        </div>
        <div className="card">
          <h3>In-run checks</h3>
          <p>{match.evidence.inrun.length} captures</p>
          <div className="card-actions">
            <button className="ghost-button" onClick={() => handleInrun("LOW_CONF")}>
              Submit low-conf
            </button>
            <button className="primary-button" onClick={() => handleInrun("PASS")}>
              Submit pass
            </button>
          </div>
        </div>
        <div className="card">
          <h3>Result proof</h3>
          <div className="form-grid">
            <label>
              Metric
              <select value={resultType} onChange={(event) => setResultType(event.target.value as typeof resultType)}>
                <option value="TIME_MS">TIME_MS</option>
                <option value="SCORE">SCORE</option>
                <option value="RANK_TIER">RANK_TIER</option>
              </select>
            </label>
            <label>
              Value
              <input value={resultValue} onChange={(event) => setResultValue(event.target.value)} placeholder="12345" />
            </label>
          </div>
          <label>
            Proof URL
            <input value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} placeholder="proof://..." />
          </label>
          <div className="card-actions">
            <button className="primary-button" onClick={handleResultSubmit}>
              Submit result
            </button>
            {match.state === "AWAITING_CONFIRMATION" ? (
              <button className="ghost-button" onClick={handleConfirm}>
                Confirm
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section split">
        <div>
          <h3>Disputes</h3>
          <p>Open a dispute if proofs or demo evidence are contested.</p>
        </div>
        <div className="card">
          <label>
            Reason
            <input
              value={disputeReason}
              onChange={(event) => setDisputeReason(event.target.value)}
              placeholder="Describe the issue"
            />
          </label>
          <button className="primary-button" onClick={handleDispute}>
            Open dispute
          </button>
        </div>
      </section>
    </div>
  );
}
