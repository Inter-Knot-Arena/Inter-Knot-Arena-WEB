import { useEffect, useMemo, useState } from "react";
import type { Rating, User } from "@ika/shared";
import { fetchLeaderboard, fetchUsers } from "../api";

const leagueOptions = [
  { id: "league_f2p", label: "F2P" },
  { id: "league_standard", label: "Standard" },
  { id: "league_unlimited", label: "Unlimited" }
];

export default function Leaderboards() {
  const [leagueId, setLeagueId] = useState("league_standard");
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetchLeaderboard(leagueId).then(setRatings);
  }, [leagueId]);

  useEffect(() => {
    fetchUsers().then(setUsers);
  }, []);

  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user.displayName])), [users]);

  return (
    <div className="page">
      <section className="section-header">
        <h2>Leaderboards</h2>
        <p>Visible ELO per league, with provisional badges.</p>
      </section>
      <div className="card">
        <div className="card-header">
          <h3>Current standings</h3>
          <div className="segmented">
            {leagueOptions.map((option) => (
              <button
                key={option.id}
                className={
                  leagueId === option.id ? "segment active" : "segment"
                }
                onClick={() => setLeagueId(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Agent</th>
              <th>ELO</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ratings.map((rating, index) => (
              <tr key={`${rating.userId}-${index}`}>
                <td>{index + 1}</td>
                <td>{userMap.get(rating.userId) ?? rating.userId}</td>
                <td>{rating.elo}</td>
                <td>
                  {rating.provisionalMatches < 10 ? (
                    <span className="badge-outline">Provisional</span>
                  ) : (
                    <span className="badge">Ranked</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
