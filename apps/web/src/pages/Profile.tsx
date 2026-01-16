import { useParams } from "react-router-dom";

const profileData = {
  user_ellen: {
    handle: "Ellen",
    region: "NA",
    proxyLevel: 12,
    trustScore: 128,
    roles: ["Verified User"],
    elo: {
      league_standard: 1620,
      league_f2p: 1402,
      league_unlimited: 1705
    }
  }
};

export default function Profile() {
  const { id } = useParams();
  const profile = profileData[id as keyof typeof profileData] ?? profileData.user_ellen;

  return (
    <div className="page">
      <section className="profile-header">
        <div>
          <p className="eyebrow">Player Profile</p>
          <h2>{profile.handle}</h2>
          <p className="lead">Region {profile.region} · {profile.roles.join(", ")}</p>
        </div>
        <div className="profile-badges">
          <span className="badge">Trust {profile.trustScore}</span>
          <span className="badge-outline">Proxy Lv {profile.proxyLevel}</span>
        </div>
      </section>

      <section className="grid">
        <div className="card">
          <h3>Standard League ELO</h3>
          <div className="stat-value">{profile.elo.league_standard}</div>
          <p>Ranked · Section Captain track</p>
        </div>
        <div className="card">
          <h3>F2P League ELO</h3>
          <div className="stat-value">{profile.elo.league_f2p}</div>
          <p>Verifier required</p>
        </div>
        <div className="card">
          <h3>Unlimited League ELO</h3>
          <div className="stat-value">{profile.elo.league_unlimited}</div>
          <p>Open queue</p>
        </div>
      </section>

      <section className="section split">
        <div>
          <h3>Roster summary</h3>
          <p>Validated agents available for draft.</p>
        </div>
        <div className="card">
          <div className="roster-grid">
            {[
              "Ellen",
              "Nicole",
              "Anby",
              "Lycaon",
              "Billy",
              "Zhu Yuan"
            ].map((agent) => (
              <div key={agent} className="roster-item">
                <div className="roster-name">{agent}</div>
                <div className="roster-tag">SCREEN</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
