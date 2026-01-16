import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { ProfileSummary, Rating } from "@ika/shared";
import { fetchProfile } from "../api";

const leagueOrder = [
  { id: "league_standard", label: "Standard League" },
  { id: "league_f2p", label: "F2P League" },
  { id: "league_unlimited", label: "Unlimited League" }
];

export default function Profile() {
  const { id } = useParams();
  const userId = id ?? "user_ellen";
  const [profile, setProfile] = useState<ProfileSummary | null>(null);

  useEffect(() => {
    fetchProfile(userId).then(setProfile);
  }, [userId]);

  const ratingMap = useMemo(() => {
    return new Map((profile?.ratings ?? []).map((rating: Rating) => [rating.leagueId, rating]));
  }, [profile]);

  if (!profile) {
    return <div className="card">Loading profile...</div>;
  }

  const { user } = profile;

  return (
    <div className="page">
      <section className="profile-header">
        <div>
          <p className="eyebrow">Player Profile</p>
          <h2>{user.displayName}</h2>
          <p className="lead">
            Region {user.region} - {user.verifiedStatus}
          </p>
        </div>
        <div className="profile-badges">
          <span className="badge">Trust {user.trustScore}</span>
          <span className="badge-outline">Proxy Lv {user.proxyLevel}</span>
        </div>
      </section>

      <section className="grid">
        {leagueOrder.map((league) => {
          const rating = ratingMap.get(league.id);
          return (
            <div key={league.id} className="card">
              <h3>{league.label}</h3>
              <div className="stat-value">{rating ? rating.elo : "Unrated"}</div>
              <p>{rating ? "Ranked" : "No matches yet"}</p>
            </div>
          );
        })}
      </section>

      <section className="section split">
        <div>
          <h3>Account signals</h3>
          <p>Public profile markers used for early trust scoring.</p>
        </div>
        <div className="card">
          <div className="stack">
            <div className="row">
              <span>Roles</span>
              <span className="badge-outline">{user.roles.join(", ")}</span>
            </div>
            <div className="row">
              <span>Verification</span>
              <span className={user.verifiedStatus === "VERIFIED" ? "badge" : "badge-outline"}>
                {user.verifiedStatus}
              </span>
            </div>
            <div className="row">
              <span>Trust score</span>
              <span className="badge">{user.trustScore}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
