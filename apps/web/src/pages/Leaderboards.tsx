import { useEffect, useMemo, useState } from "react";
import type { Rating, User } from "@ika/shared";
import { fetchLeaderboard, fetchUsers } from "../api";
import { Badge } from "../components/ui/badge";
import { LeaderboardTable, type LeaderboardEntry } from "../components/leaderboards/LeaderboardTable";

const leagueOptions = [
  { id: "league_f2p", label: "F2P" },
  { id: "league_standard", label: "Standard" },
  { id: "league_unlimited", label: "Unlimited" }
];

export default function Leaderboards() {
  const [leagueId, setLeagueId] = useState("league_standard");
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetchLeaderboard(leagueId)
      .then(setRatings)
      .finally(() => setIsLoading(false));
  }, [leagueId]);

  useEffect(() => {
    fetchUsers().then(setUsers);
  }, []);

  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const entries = useMemo<LeaderboardEntry[]>(() => {
    return ratings.map((rating, index) => {
      const user = userMap.get(rating.userId);
      return {
        rank: index + 1,
        player: user?.displayName ?? rating.userId,
        elo: rating.elo,
        provisional: rating.provisionalMatches < 10,
        region: user?.region ?? "—"
      };
    });
  }, [ratings, userMap]);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 pb-16 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Leaderboards</div>
          <h1 className="mt-2 text-3xl font-display text-ink-900">Season standings</h1>
          <p className="mt-2 text-sm text-ink-500">
            Visible ELO per league, with provisional badges.
          </p>
        </div>
        <Badge className="border border-border bg-ika-700/70 text-ink-700">
          Season 01 · Active
        </Badge>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          {leagueOptions.map((option) => (
            <button
              key={option.id}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                leagueId === option.id
                  ? "border-accent-400 bg-accent-500/20 text-ink-900"
                  : "border-border text-ink-500 hover:border-accent-400"
              }`}
              onClick={() => setLeagueId(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-ink-500">
          Provisional if fewer than 10 matches.
        </div>
      </div>

      <div className="mt-4">
        <LeaderboardTable entries={entries} isLoading={isLoading} />
      </div>
    </div>
  );
}
