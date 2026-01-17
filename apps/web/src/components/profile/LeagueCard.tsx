import { Line, LineChart, ResponsiveContainer } from "recharts";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "../../lib/utils";

export interface LeagueCardData {
  name: string;
  elo: number | null;
  rank: string;
  delta10: number;
  wins: number;
  losses: number;
  winrate: number;
  streak: string;
  trend: Array<{ day: number; elo: number }>;
  tone?: "accent" | "cool" | "neutral";
}

interface LeagueCardProps {
  data: LeagueCardData;
}

const toneMap = {
  accent: "text-accent-400",
  cool: "text-cool-400",
  neutral: "text-ink-500"
} as const;

export function LeagueCard({ data }: LeagueCardProps) {
  const eloLabel = data.elo !== null ? data.elo.toString() : "Unrated";
  const deltaLabel = data.delta10 >= 0 ? `+${data.delta10}` : `${data.delta10}`;
  const tone = data.tone ?? "accent";
  const deltaValue = data.elo === null ? "--" : deltaLabel;

  return (
    <Card className="flex h-full flex-col gap-4 border-border bg-ika-800/70">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-sans text-ink-900">{data.name}</CardTitle>
          <Badge className="border border-border bg-ika-700/60 text-ink-700">{data.rank}</Badge>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-4xl font-semibold text-ink-900">{eloLabel}</div>
            <div className={cn("text-xs font-semibold", toneMap[tone])}>
              ELO delta last 10: {deltaValue}
            </div>
          </div>
          <div className="h-14 w-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                <Line
                  type="monotone"
                  dataKey="elo"
                  stroke={tone === "cool" ? "#6bb6c5" : tone === "neutral" ? "#8c96a8" : "#f2a65a"}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardHeader>
      <CardContent className="mt-auto">
        <div className="grid grid-cols-3 gap-4 text-xs text-ink-500">
          <div>
            <div className="text-ink-500">Record</div>
            <div className="text-sm font-semibold text-ink-900">
              {data.wins}W - {data.losses}L
            </div>
          </div>
          <div>
            <div className="text-ink-500">Winrate</div>
            <div className="text-sm font-semibold text-ink-900">{data.winrate}%</div>
          </div>
          <div>
            <div className="text-ink-500">Streak</div>
            <div className="text-sm font-semibold text-ink-900">{data.streak}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
