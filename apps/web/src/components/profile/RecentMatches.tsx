import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "../../lib/utils";

export interface RecentMatchItem {
  id: string;
  date: string;
  opponent: string;
  league: string;
  result: "W" | "L";
  eloDelta: number;
  evidence: string;
  dispute: string;
}

interface RecentMatchesProps {
  matches: RecentMatchItem[];
  onViewAll?: () => void;
}

export function RecentMatches({ matches, onViewAll }: RecentMatchesProps) {
  return (
    <Card className="border-border bg-ika-800/70">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg text-ink-900">Recent matches</CardTitle>
          <p className="text-sm text-ink-500">Latest results with ELO delta.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onViewAll}>
          View all
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {matches.map((match) => (
          <div key={match.id} className="flex items-center justify-between rounded-lg border border-border bg-ika-700/40 px-3 py-2 text-sm">
            <div className="flex items-center gap-3">
              <span className={cn("font-semibold", match.result === "W" ? "text-cool-400" : "text-accent-400")}>
                {match.result}
              </span>
              <div>
                <div className="text-ink-900">{match.opponent}</div>
                <div className="text-xs text-ink-500">{match.league} · {match.date}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={cn("font-semibold", match.eloDelta >= 0 ? "text-cool-400" : "text-accent-400")}>
                {match.eloDelta >= 0 ? "+" : ""}{match.eloDelta}
              </div>
              <div className="text-xs text-ink-500">{match.evidence} · {match.dispute}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
