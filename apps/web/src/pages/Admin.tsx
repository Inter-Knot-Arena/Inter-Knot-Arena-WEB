const adminSections = [
  {
    title: "Agents Catalog",
    description: "Manage agent icons, tags, and availability.",
    status: "Ready"
  },
  {
    title: "Rulesets",
    description: "Configure league rules, caps, and verifier requirements.",
    status: "Draft"
  },
  {
    title: "Seasons",
    description: "Open, close, and soft reset seasons.",
    status: "Active"
  },
  {
    title: "Rank Bands",
    description: "Tune ELO ranges and leaderboard badges.",
    status: "Draft"
  }
];

export default function Admin() {
  return (
    <div className="page">
      <section className="section-header">
        <h2>Admin Console</h2>
        <p>Operations, configuration, and enforcement tools.</p>
      </section>

      <div className="grid">
        {adminSections.map((section) => (
          <div key={section.title} className="card">
            <div className="card-header">
              <h3>{section.title}</h3>
              <span className={section.status === "Active" ? "badge" : "badge-outline"}>
                {section.status}
              </span>
            </div>
            <p>{section.description}</p>
            <button className="ghost-button">Open module</button>
          </div>
        ))}
      </div>
    </div>
  );
}
