import { Calendar, Trophy } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export interface TournamentItem {
  id: string;
  name: string;
  league: string;
  date: string;
  status: "Check-in" | "Bracket" | "Completed";
  result?: string;
}

interface TournamentsPanelProps {
  upcoming: TournamentItem[];
  past: TournamentItem[];
}

export function TournamentsPanel({ upcoming, past }: TournamentsPanelProps) {
  return (
    <Card className="border-border bg-ika-800/70">
      <CardHeader>
        <CardTitle className="text-lg font-sans text-ink-900">Tournaments</CardTitle>
        <p className="text-sm text-ink-500">Seasonal cups and bracket play.</p>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-ika-700/40 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-500">
            <Calendar className="h-4 w-4" />
            Upcoming
          </div>
          {upcoming.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border bg-ika-800/40 p-4 text-sm text-ink-500">
              No upcoming tournaments scheduled.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {upcoming.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-ika-800/60 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-ink-900">{item.name}</div>
                      <div className="text-xs text-ink-500">{item.league} - {item.date}</div>
                    </div>
                    <Badge className="border border-amber-500/30 bg-amber-500/10 text-amber-200">
                      {item.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-ika-700/40 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-500">
            <Trophy className="h-4 w-4" />
            Past
          </div>
          {past.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border bg-ika-800/40 p-4 text-sm text-ink-500">
              No tournament history yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {past.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-ika-800/60 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-ink-900">{item.name}</div>
                      <div className="text-xs text-ink-500">{item.league} - {item.date}</div>
                    </div>
                    <Badge className="border border-cool-400/30 bg-cool-500/10 text-cool-300">
                      {item.status}
                    </Badge>
                  </div>
                  {item.result && <div className="mt-2 text-xs text-ink-500">Result: {item.result}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
