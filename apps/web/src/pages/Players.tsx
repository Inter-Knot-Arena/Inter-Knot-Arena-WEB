import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Rating, User } from "@ika/shared";
import { fetchLeaderboard, fetchUsers } from "../api";

export default function Players() {
  const [users, setUsers] = useState<User[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);

  useEffect(() => {
    fetchUsers().then(setUsers);
    fetchLeaderboard("league_standard").then(setRatings);
  }, []);

  const ratingMap = useMemo(() => {
    return new Map(ratings.map((rating) => [rating.userId, rating]));
  }, [ratings]);

  return (
    <div className="page">
      <section className="section-header">
        <h2>Player Directory</h2>
        <p>Public profiles and verified account status.</p>
      </section>

      <div className="card">
        <div className="card-header">
          <h3>Accounts</h3>
          <span className="badge-outline">Standard league</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Region</th>
              <th>Trust</th>
              <th>Honor Lv</th>
              <th>ELO</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const rating = ratingMap.get(user.id);
              return (
                <tr key={user.id}>
                  <td>
                    <Link className="table-link" to={`/profile/${user.id}`}>
                      {user.displayName}
                    </Link>
                  </td>
                  <td>{user.region}</td>
                  <td>{user.trustScore}</td>
                  <td>{user.proxyLevel}</td>
                  <td>{rating ? rating.elo : "-"}</td>
                  <td>
                    {user.verifiedStatus === "VERIFIED" ? (
                      <span className="badge">Verified</span>
                    ) : (
                      <span className="badge-outline">{user.verifiedStatus}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
