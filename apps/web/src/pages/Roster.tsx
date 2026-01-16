const rosterAgents = [
  { name: "Ellen", status: "VIDEO", level: 60 },
  { name: "Lycaon", status: "SCREEN", level: 60 },
  { name: "Anby", status: "SCREEN", level: 50 },
  { name: "Nicole", status: "DECLARED", level: 40 },
  { name: "Billy", status: "DECLARED", level: 45 },
  { name: "Zhu Yuan", status: "SCREEN", level: 60 }
];

export default function Roster() {
  return (
    <div className="page">
      <section className="section-header">
        <h2>Roster Management</h2>
        <p>Declared agents become draft-eligible when verified.</p>
      </section>

      <div className="card">
        <div className="card-header">
          <h3>Agent list</h3>
          <button className="ghost-button">Upload roster proof</button>
        </div>
        <div className="roster-table">
          {rosterAgents.map((agent) => (
            <div key={agent.name} className="roster-row">
              <div>
                <div className="roster-name">{agent.name}</div>
                <div className="meta-label">Level {agent.level}</div>
              </div>
              <span className={agent.status === "VIDEO" ? "badge" : "badge-outline"}>
                {agent.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
