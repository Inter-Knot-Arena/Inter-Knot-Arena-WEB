import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface DraftImpactProps {
  yourBans: string[];
  bansAgainst: string[];
  winrateDelta: string;
  pickSuccess: string;
}

export function DraftImpact({ yourBans, bansAgainst, winrateDelta, pickSuccess }: DraftImpactProps) {
  const hasYourBans = yourBans.length > 0;
  const hasBansAgainst = bansAgainst.length > 0;
  const pickSuccessLabel = pickSuccess === "-" ? "--" : pickSuccess;
  const winrateDeltaLabel = winrateDelta === "-" ? "--" : winrateDelta;

  return (
    <Card className="border-border bg-ika-800/70">
      <CardHeader>
        <CardTitle className="text-lg font-sans text-ink-900">Draft impact</CardTitle>
        <p className="text-sm text-ink-500">How draft decisions shape match outcomes.</p>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1fr,1fr,0.6fr]">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Your bans</div>
          {hasYourBans ? (
            <ul className="mt-3 space-y-2 text-sm text-ink-900">
              {yourBans.map((ban) => (
                <li key={ban} className="rounded-md border border-border bg-ika-700/40 px-3 py-2">
                  {ban}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-border bg-ika-700/20 p-4 text-sm text-ink-500">
              No bans recorded yet.
            </div>
          )}
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Bans against you</div>
          {hasBansAgainst ? (
            <ul className="mt-3 space-y-2 text-sm text-ink-900">
              {bansAgainst.map((ban) => (
                <li key={ban} className="rounded-md border border-border bg-ika-700/40 px-3 py-2">
                  {ban}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-border bg-ika-700/20 p-4 text-sm text-ink-500">
              No bans against you yet.
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-ika-700/40 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Pick success</div>
            <div className="mt-2 text-2xl font-semibold text-ink-900">{pickSuccessLabel}</div>
          </div>
          <div className="rounded-lg border border-border bg-ika-700/40 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Winrate delta</div>
            <div className="mt-2 text-2xl font-semibold text-ink-900">{winrateDeltaLabel}</div>
            <p className="text-xs text-ink-500">Draft winrate vs match winrate.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
