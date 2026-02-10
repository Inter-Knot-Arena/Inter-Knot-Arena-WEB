import { useEffect, useState } from "react";
import type { Dispute } from "@ika/shared";
import { fetchDisputes, resolveDispute } from "../api";

export default function Disputes() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [winners, setWinners] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetchDisputes()
      .then(setDisputes)
      .catch(() => setError("Failed to load disputes."));
  };

  useEffect(() => {
    load();
  }, []);

  const handleResolve = async (disputeId: string) => {
    const decision = decisions[disputeId];
    if (!decision) {
      return;
    }
    const winnerUserId = winners[disputeId]?.trim() || undefined;
    try {
      await resolveDispute(disputeId, decision, winnerUserId);
      load();
    } catch {
      setError("Failed to resolve dispute.");
    }
  };

  return (
    <div className="page">
      <section className="section-header">
        <h2>Moderation Queue</h2>
        <p>Review demos/proofs and issue decisions.</p>
      </section>

      {error ? <div className="card">{error}</div> : null}

      <div className="grid">
        {disputes.length === 0 ? (
          <div className="card">No open disputes.</div>
        ) : (
          disputes.map((dispute) => (
            <div key={dispute.id} className="card">
              <div className="card-header">
                <h3>{dispute.id}</h3>
                <span className="badge">{dispute.status}</span>
              </div>
              <p>Match: {dispute.matchId}</p>
              <p>{dispute.reason}</p>
              <label>
                Decision
                <input
                  value={decisions[dispute.id] ?? ""}
                  onChange={(event) =>
                    setDecisions((prev) => ({ ...prev, [dispute.id]: event.target.value }))
                  }
                  placeholder="Decision summary"
                />
              </label>
              <label>
                Winner user ID (optional)
                <input
                  value={winners[dispute.id] ?? ""}
                  onChange={(event) =>
                    setWinners((prev) => ({ ...prev, [dispute.id]: event.target.value }))
                  }
                  placeholder="user_..."
                />
              </label>
              <div className="card-actions">
                <button className="primary-button" onClick={() => handleResolve(dispute.id)}>
                  Resolve
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
