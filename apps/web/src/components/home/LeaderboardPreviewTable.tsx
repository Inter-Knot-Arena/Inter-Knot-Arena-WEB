import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";

export interface LeaderboardRow {
  rank: number;
  player: string;
  elo: number;
  record: string;
  region: string;
  league: "Standard" | "F2P" | "Unlimited";
}

interface LeaderboardPreviewTableProps {
  rows: LeaderboardRow[];
  variant?: "card" | "plain";
}

const leagues: LeaderboardRow["league"][] = ["Standard", "F2P", "Unlimited"];

const rankChipStyles: Record<number, string> = {
  1: "border-accent-400/60 bg-accent-500/15 text-ink-900",
  2: "border-cool-400/60 bg-cool-500/15 text-ink-900",
  3: "border-amber-400/60 bg-amber-500/15 text-ink-900"
};

export function LeaderboardPreviewTable({ rows, variant = "card" }: LeaderboardPreviewTableProps) {
  const [activeLeague, setActiveLeague] = useState<LeaderboardRow["league"]>("Standard");

  const filteredRows = useMemo(() => {
    return rows.filter((row) => row.league === activeLeague);
  }, [rows, activeLeague]);

  const containerClass =
    variant === "plain"
      ? "overflow-hidden rounded-xl border border-border bg-transparent"
      : "overflow-hidden p-0";

  const Container = variant === "plain" ? "div" : Card;

  return (
    <Container className={cn(containerClass)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Top of the season</div>
          <div className="text-sm text-ink-700">Top 5 snapshot · {activeLeague} league</div>
        </div>
        <div className="flex flex-wrap gap-3">
          {leagues.map((league) => (
            <button
              key={league}
              type="button"
              onClick={() => setActiveLeague(league)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                activeLeague === league
                  ? "border-accent-400 bg-accent-500/20 text-ink-900"
                  : "border-border text-ink-500 hover:border-accent-400"
              }`}
            >
              {league}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-[0.2em] text-ink-500">
            <tr>
              <th className="px-6 py-3">Rank</th>
              <th className="px-6 py-3">Player</th>
              <th className="px-6 py-3">ELO</th>
              <th className="px-6 py-3">W-L</th>
              <th className="px-6 py-3">Region</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredRows.map((row) => {
              const chipClass =
                rankChipStyles[row.rank] ?? "border-border bg-ika-700/40 text-ink-700";
              return (
                <tr
                  key={`${row.league}-${row.rank}`}
                  className="transition hover:bg-ika-700/30"
                >
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                        chipClass
                      )}
                    >
                      {row.rank}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-ink-900">{row.player}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-ink-900">{row.elo}</td>
                  <td className="px-6 py-4 text-ink-500">{row.record}</td>
                  <td className="px-6 py-4 text-ink-500">{row.region}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-6 py-4">
        <div className="text-xs text-ink-500">Previewing {activeLeague} league</div>
        <Button asChild size="sm" variant="outline">
          <Link to="/leaderboards">View full leaderboards</Link>
        </Button>
      </div>
    </Container>
  );
}
