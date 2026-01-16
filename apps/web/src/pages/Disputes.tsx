const disputes = [
  {
    id: "dispute_001",
    matchId: "match_2",
    reason: "Low confidence on in-run capture.",
    status: "OPEN"
  },
  {
    id: "dispute_002",
    matchId: "match_4",
    reason: "Result screen mismatch.",
    status: "OPEN"
  }
];

export default function Disputes() {
  return (
    <div className="page">
      <section className="section-header">
        <h2>Judge Queue</h2>
        <p>Review verifier logs and issue decisions.</p>
      </section>

      <div className="grid">
        {disputes.map((dispute) => (
          <div key={dispute.id} className="card">
            <div className="card-header">
              <h3>{dispute.id}</h3>
              <span className="badge">{dispute.status}</span>
            </div>
            <p>Match: {dispute.matchId}</p>
            <p>{dispute.reason}</p>
            <div className="card-actions">
              <button className="ghost-button">Open evidence</button>
              <button className="primary-button">Resolve</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
