import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from "recharts";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface SeriesPoint {
  day: string;
  elo: number;
}

interface SeasonSeriesMeta {
  series: SeriesPoint[];
  kFactor: number | null;
  provisional: string;
  expectedWinrate: string;
}

interface SeasonPerformanceProps {
  standard: SeasonSeriesMeta;
  f2p: SeasonSeriesMeta;
}

export function SeasonPerformance({ standard, f2p }: SeasonPerformanceProps) {
  const [active, setActive] = useState<"standard" | "f2p">("standard");

  const meta = useMemo(() => (active === "standard" ? standard : f2p), [active, standard, f2p]);
  const hasSeries = meta.series.length > 0;
  const kFactorLabel = meta.kFactor ?? "--";

  return (
    <Card className="border-border bg-ika-800/70">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg font-sans text-ink-900">Season performance</CardTitle>
          <p className="text-sm text-ink-500">ELO movement over the last 30 days.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={active === "standard" ? "default" : "outline"}
            size="sm"
            onClick={() => setActive("standard")}
          >
            Standard
          </Button>
          <Button
            variant={active === "f2p" ? "default" : "outline"}
            size="sm"
            onClick={() => setActive("f2p")}
          >
            F2P
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1.4fr,0.6fr]">
        <div className="h-[260px] w-full">
          {hasSeries ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={meta.series} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#8c96a8", fontSize: 11 }} />
                <YAxis
                  width={38}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#8c96a8", fontSize: 11 }}
                />
                <ReTooltip
                  cursor={{ stroke: "#6bb6c5", strokeDasharray: "3 3" }}
                  contentStyle={{
                    background: "#111720",
                    border: "1px solid rgba(242, 244, 247, 0.08)",
                    borderRadius: 10,
                    color: "#f2f4f7",
                    fontSize: 12
                  }}
                />
                <Line type="monotone" dataKey="elo" stroke="#6bb6c5" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-ika-700/20 text-sm text-ink-500">
              No ELO history yet.
            </div>
          )}
        </div>
        <div className="grid gap-4">
          <div className="rounded-lg border border-border bg-ika-700/40 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink-500">K-factor</div>
            <div className="mt-2 text-2xl font-semibold text-ink-900">{kFactorLabel}</div>
            <p className="text-xs text-ink-500">Adjusted by rank and provisional status.</p>
          </div>
          <div className="rounded-lg border border-border bg-ika-700/40 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Status</div>
            <div className="mt-2 text-lg font-semibold text-ink-900">{meta.provisional}</div>
            <Badge className="mt-2 bg-ika-700/70 text-ink-700">Season 01</Badge>
          </div>
          <div className="rounded-lg border border-border bg-ika-700/40 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Expected winrate</div>
            <div className="mt-2 text-2xl font-semibold text-ink-900">{meta.expectedWinrate}</div>
            <p className="text-xs text-ink-500">Based on current ELO vs queue average.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
