import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "../../lib/utils";

export interface RecentMatchItem {
  id: string;
  date: string;
  opponent: string;
  league: string;
  challenge: string;
  result: "W" | "L";
  eloDelta: number;
  evidence: string;
  dispute: string;
}

interface RecentMatchesProps {
  matches: RecentMatchItem[];
  onViewAll?: () => void;
}

const evidenceClass = (value: string) => {
  if (value === "Verified") {
    return "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (value === "Pending") {
    return "border border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  return "border border-rose-500/30 bg-rose-500/10 text-rose-300";
};

const disputeClass = (value: string) => {
  if (value === "Open") {
    return "border border-rose-500/30 bg-rose-500/10 text-rose-300";
  }
  if (value === "Resolved") {
    return "border border-cool-400/30 bg-cool-500/10 text-cool-300";
  }
  return "border border-border bg-ika-700/60 text-ink-500";
};

export function RecentMatches({ matches, onViewAll }: RecentMatchesProps) {
  return (
    <Card className="border-border bg-ika-800/70">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-sans text-ink-900">Recent matches</CardTitle>
          <p className="text-sm text-ink-500">Latest results with ELO delta.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onViewAll}>
          View all
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {matches.map((match) => (
          <div
            key={match.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-ika-700/40 px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "text-sm font-semibold",
                  match.result === "W" ? "text-cool-400" : "text-accent-400"
                )}
              >
                {match.result}
              </span>
              <div>
                <div className="text-ink-900">{match.opponent}</div>
                <div className="text-xs text-ink-500">
                  {match.league} - {match.challenge} - {match.date}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-right">
              <div
                className={cn(
                  "min-w-[48px] text-right font-semibold",
                  match.eloDelta >= 0 ? "text-cool-400" : "text-accent-400"
                )}
              >
                {match.eloDelta >= 0 ? "+" : ""}
                {match.eloDelta}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={evidenceClass(match.evidence)}>{match.evidence}</Badge>
                <Badge className={disputeClass(match.dispute)}>{match.dispute}</Badge>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
