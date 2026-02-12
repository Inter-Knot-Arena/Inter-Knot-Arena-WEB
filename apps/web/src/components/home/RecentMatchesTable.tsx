import { Card } from "../ui/card";

export interface RecentMatchRow {
  id: string;
  opponent: string;
  league: string;
  result: "W" | "L";
  eloDelta: number;
  evidence: "OK" | "PENDING" | "MISSING";
}

interface RecentMatchesTableProps {
  matches: RecentMatchRow[];
}

const evidenceTone: Record<RecentMatchRow["evidence"], string> = {
  OK: "text-emerald-300",
  PENDING: "text-amber-300",
  MISSING: "text-rose-300"
};

export function RecentMatchesTable({ matches }: RecentMatchesTableProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Recent matches</div>
          <div className="text-sm text-ink-700">Last 5 ranked games</div>
        </div>
        <div className="text-xs text-ink-500">Season 01</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-[0.2em] text-ink-500">
            <tr>
              <th className="px-6 py-3">Opponent</th>
              <th className="px-6 py-3">League</th>
              <th className="px-6 py-3">Result</th>
              <th className="px-6 py-3">ELO delta</th>
              <th className="px-6 py-3">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {matches.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-sm text-ink-500">
                  No matches played yet.
                </td>
              </tr>
            ) : (
              matches.map((match) => (
                <tr key={match.id} className="border-b border-border last:border-0">
                  <td className="px-6 py-4 font-medium text-ink-900">{match.opponent}</td>
                  <td className="px-6 py-4 text-ink-500">{match.league}</td>
                  <td className="px-6 py-4">
                    <span
                      className={
                        match.result === "W" ? "text-emerald-300" : "text-rose-300"
                      }
                    >
                      {match.result === "W" ? "Win" : "Loss"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-ink-700">
                    {match.eloDelta > 0 ? `+${match.eloDelta}` : match.eloDelta}
                  </td>
                  <td className={`px-6 py-4 font-medium ${evidenceTone[match.evidence]}`}>
                    {match.evidence}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

