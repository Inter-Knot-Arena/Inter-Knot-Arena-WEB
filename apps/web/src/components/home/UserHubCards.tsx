import { Link } from "react-router-dom";
import { CheckCircle2, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Progress } from "../ui/progress";

interface SparklinePoint {
  value: number;
}

interface EloSummaryItem {
  league: string;
  elo: number | null;
  trend: SparklinePoint[];
  tone: "accent" | "cool" | "neutral";
}

interface TrustData {
  score: number;
  tier: "Trusted" | "Neutral" | "At risk";
}

interface ProxyData {
  level: number;
  cap: number;
  progress: number;
  nextUnlock: string;
}

interface VerificationData {
  status: "VERIFIED" | "UNVERIFIED" | "PENDING";
  proofStatus: string;
}

interface UserHubCardsProps {
  state: "guest" | "unverified" | "verified";
  eloSummary?: EloSummaryItem[];
  trust?: TrustData;
  proxy?: ProxyData;
  verification?: VerificationData;
}

const toneColor: Record<EloSummaryItem["tone"], string> = {
  accent: "#e98a4f",
  cool: "#6bb6c5",
  neutral: "#8c96a8"
};

function Sparkline({ data, tone }: { data: SparklinePoint[]; tone: EloSummaryItem["tone"] }) {
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="value" stroke={toneColor[tone]} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const trustTierStyle: Record<TrustData["tier"], string> = {
  Trusted: "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  Neutral: "border border-ika-700 bg-ika-700/70 text-ink-700",
  "At risk": "border border-rose-500/40 bg-rose-500/10 text-rose-200"
};

export function UserHubCards({ state, eloSummary, trust, proxy, verification }: UserHubCardsProps) {
  if (state === "guest") {
    return (
      <Card className="flex flex-col items-start gap-4 p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Your hub</div>
        <div className="text-lg font-semibold text-ink-900">Create your competitive profile</div>
        <p className="text-sm text-ink-500">
          Track your ELO, proofs, and ranked eligibility across all queues.
        </p>
        <Button asChild size="sm">
          <Link to="/signin">Sign in to start</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Your ELO</div>
        <div className="mt-2 space-y-3">
          {eloSummary?.map((item) => (
            <div key={item.league} className="rounded-lg border border-border bg-ika-700/30 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-ink-900">{item.league}</div>
                <span className="text-sm text-ink-700">
                  {item.elo ? `${item.elo} ELO` : "Unrated"}
                </span>
              </div>
              <Sparkline data={item.trend} tone={item.tone} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Trust & Progress</div>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-ink-500">Trust score</div>
            <div className="mt-1 text-2xl font-semibold text-ink-900">{trust?.score ?? 0}</div>
          </div>
          {trust ? <Badge className={trustTierStyle[trust.tier]}>{trust.tier}</Badge> : null}
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-ink-500">
            <span>Proxy level</span>
            <span className="text-ink-700">
              {proxy?.level ?? 0}/{proxy?.cap ?? 60}
            </span>
          </div>
          <div className="mt-2">
            <Progress value={proxy?.progress ?? 0} />
          </div>
          <div className="mt-2 text-xs text-ink-500">Next unlock: {proxy?.nextUnlock}</div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Verification</div>
        <div className="mt-3 flex items-center gap-2 text-lg font-semibold text-ink-900">
          {verification?.status === "VERIFIED" ? (
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
          ) : verification?.status === "PENDING" ? (
            <Shield className="h-5 w-5 text-amber-300" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-rose-300" />
          )}
          {verification?.status ?? "UNVERIFIED"}
        </div>
        <div className="mt-2 text-sm text-ink-500">
          Proof status: <span className="text-ink-700">{verification?.proofStatus ?? "Not linked"}</span>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Button asChild size="sm" variant="outline">
            <Link to="/uid-verify">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {verification?.status === "VERIFIED" ? "View UID status" : "Verify UID"}
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to="/settings">Settings</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
