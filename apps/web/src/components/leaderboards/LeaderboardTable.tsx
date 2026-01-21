import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { cn } from "../../lib/utils";

export interface LeaderboardEntry {
  rank: number;
  player: string;
  elo: number;
  provisional: boolean;
  region: string;
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  isLoading: boolean;
}

const rankChipStyles: Record<number, string> = {
  1: "border-accent-400/60 bg-accent-500/15 text-ink-900",
  2: "border-cool-400/60 bg-cool-500/15 text-ink-900",
  3: "border-amber-400/60 bg-amber-500/15 text-ink-900"
};

export function LeaderboardTable({ entries, isLoading }: LeaderboardTableProps) {
  if (isLoading) {
    return (
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-6 py-4">
          <Skeleton className="h-4 w-40" />
          <div className="mt-2">
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="space-y-3 px-6 py-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (!entries.length) {
    return (
      <Card className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink-900">No ratings yet</div>
          <div className="text-sm text-ink-500">Play ranked matches to appear here.</div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-[0.2em] text-ink-500">
            <tr>
              <th className="px-6 py-3">Rank</th>
              <th className="px-6 py-3">Player</th>
              <th className="px-6 py-3">ELO</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Region</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry) => {
              const chipClass =
                rankChipStyles[entry.rank] ?? "border-border bg-ika-700/40 text-ink-700";
              return (
                <tr key={entry.rank} className="transition hover:bg-ika-700/30">
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                        chipClass
                      )}
                    >
                      {entry.rank}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-ink-900">{entry.player}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-ink-900">{entry.elo}</td>
                  <td className="px-6 py-4">
                    {entry.provisional ? (
                      <Badge className="border border-amber-500/40 bg-amber-500/10 text-amber-200">
                        Provisional
                      </Badge>
                    ) : (
                      <Badge className="border border-emerald-500/40 bg-emerald-500/10 text-emerald-200">
                        Ranked
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-ink-500">{entry.region}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
