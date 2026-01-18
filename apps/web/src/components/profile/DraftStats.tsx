import { Bar, BarChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from "recharts";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface DraftChartItem {
  name: string;
  count: number;
}

interface DraftSequence {
  sequence: string;
  count: number;
}

interface DraftStatsProps {
  banFrequency: string;
  pickFrequency: string;
  draftWinrate: number;
  matchWinrate: number;
  pickSuccess: string;
  bans: DraftChartItem[];
  bansAgainst: DraftChartItem[];
  sequences: DraftSequence[];
}

export function DraftStats({
  banFrequency,
  pickFrequency,
  draftWinrate,
  matchWinrate,
  pickSuccess,
  bans,
  bansAgainst,
  sequences
}: DraftStatsProps) {
  const hasData =
    banFrequency !== "-" ||
    pickFrequency !== "-" ||
    pickSuccess !== "-" ||
    bans.length > 0 ||
    bansAgainst.length > 0 ||
    sequences.length > 0;
  const delta = draftWinrate - matchWinrate;
  const deltaLabel = hasData ? (delta >= 0 ? `+${delta}%` : `${delta}%`) : "--";
  const draftWinrateLabel = hasData ? `${draftWinrate}%` : "--";
  const matchWinrateLabel = hasData ? `${matchWinrate}%` : "--";
  const pickSuccessLabel = pickSuccess === "-" ? "--" : pickSuccess;

  return (
    <Card className="border-border bg-ika-800/70">
      <CardHeader>
        <CardTitle className="text-lg font-sans text-ink-900">Draft statistics</CardTitle>
        <p className="text-sm text-ink-500">Ban and pick trends from the last 60 matches.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-ika-700/40 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Ban frequency</div>
            <div className="mt-2 text-2xl font-semibold text-ink-900">
              {banFrequency === "-" ? "--" : banFrequency}
            </div>
            <p className="text-xs text-ink-500">Average bans per draft.</p>
          </div>
          <div className="rounded-lg border border-border bg-ika-700/40 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Pick frequency</div>
            <div className="mt-2 text-2xl font-semibold text-ink-900">
              {pickFrequency === "-" ? "--" : pickFrequency}
            </div>
            <p className="text-xs text-ink-500">Average picks per draft.</p>
          </div>
          <div className="rounded-lg border border-border bg-ika-700/40 p-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-ink-500">
              Draft winrate
              <Badge
                className={
                  hasData
                    ? "border border-cool-400/30 bg-cool-500/10 text-cool-300"
                    : "border border-border bg-ika-700/60 text-ink-500"
                }
              >
                {deltaLabel}
              </Badge>
            </div>
            <div className="mt-2 text-2xl font-semibold text-ink-900">{draftWinrateLabel}</div>
            <div className="mt-1 text-xs text-ink-500">Match winrate {matchWinrateLabel}</div>
            <div className="mt-3 text-xs text-ink-500">Pick success after draft win: {pickSuccessLabel}</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-ika-700/40 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Your bans</div>
            <div className="mt-3 h-[220px]">
              {bans.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bans} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
                    <XAxis type="number" tick={{ fill: "#8c96a8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: "#c3c8d2", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={90}
                    />
                    <ReTooltip
                      cursor={{ fill: "rgba(242, 166, 90, 0.12)" }}
                      contentStyle={{
                        background: "#111720",
                        border: "1px solid rgba(242, 244, 247, 0.08)",
                        borderRadius: 10,
                        color: "#f2f4f7",
                        fontSize: 12
                      }}
                    />
                    <Bar dataKey="count" fill="#f2a65a" radius={[6, 6, 6, 6]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-ika-800/40 text-sm text-ink-500">
                  No ban data yet.
                </div>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-ika-700/40 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Bans against you</div>
            <div className="mt-3 h-[220px]">
              {bansAgainst.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={bansAgainst}
                    layout="vertical"
                    margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
                  >
                    <XAxis type="number" tick={{ fill: "#8c96a8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: "#c3c8d2", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={90}
                    />
                    <ReTooltip
                      cursor={{ fill: "rgba(58, 149, 169, 0.12)" }}
                      contentStyle={{
                        background: "#111720",
                        border: "1px solid rgba(242, 244, 247, 0.08)",
                        borderRadius: 10,
                        color: "#f2f4f7",
                        fontSize: 12
                      }}
                    />
                    <Bar dataKey="count" fill="#6bb6c5" radius={[6, 6, 6, 6]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-ika-800/40 text-sm text-ink-500">
                  No ban data yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-ika-700/40 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Common ban sequences</div>
          {sequences.length > 0 ? (
            <ul className="mt-3 grid gap-2 text-sm text-ink-900 sm:grid-cols-2">
              {sequences.map((item) => (
                <li
                  key={item.sequence}
                  className="flex items-center justify-between rounded-md border border-border bg-ika-800/60 px-3 py-2"
                >
                  <span>{item.sequence}</span>
                  <span className="text-xs text-ink-500">{item.count}x</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-border bg-ika-800/40 p-4 text-sm text-ink-500">
              No draft sequences recorded yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
