import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Calendar, ShieldCheck } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export type UserState = "guest" | "unverified" | "verified";

interface SeasonInfo {
  name: string;
  daysLeft: number;
  valueProp: string;
}

interface HeaderAction {
  label: string;
  to: string;
  variant?: "default" | "secondary" | "outline";
  icon?: "arrow" | "verify";
  disabled?: boolean;
  helper?: string;
}

interface HomeHeaderProps {
  state: UserState;
  season: SeasonInfo;
  primaryAction: HeaderAction;
  secondaryAction: HeaderAction;
}

function ActionButton({ action }: { action: HeaderAction }) {
  const icon =
    action.icon === "verify" ? (
      <ShieldCheck className="mr-2 h-4 w-4" />
    ) : action.icon === "arrow" ? (
      <ArrowRight className="mr-2 h-4 w-4" />
    ) : null;

  if (action.disabled) {
    return (
      <Button variant={action.variant ?? "default"} disabled type="button">
        {icon}
        {action.label}
      </Button>
    );
  }

  return (
    <Button asChild variant={action.variant ?? "default"}>
      <Link to={action.to}>
        {icon}
        {action.label}
      </Link>
    </Button>
  );
}

export function HomeHeader({ state, season, primaryAction, secondaryAction }: HomeHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-ika-700 via-ika-800 to-ika-900 p-8 shadow-none">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-500/10 blur-3xl" />
      <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
        <div>
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-ink-500">
            <span>Inter-Knot Arena</span>
            <span className="h-1 w-1 rounded-full bg-ink-500/60" />
            <span>Season Hub</span>
          </div>
          <h1 className="mt-3 bg-gradient-to-br from-ink-900 via-ink-700 to-ink-500 bg-clip-text text-4xl font-display font-bold uppercase tracking-wide text-transparent drop-shadow-md md:text-5xl">
            {season.name}
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            {season.daysLeft} days left · {season.valueProp}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ActionButton action={primaryAction} />
            <ActionButton action={secondaryAction} />
          </div>
          {state === "guest" ? (
            <div className="mt-3 text-xs text-ink-500">
              Create your competitive profile to unlock ranked queues.
            </div>
          ) : null}
        </div>
        <Card className="flex h-full flex-col justify-between bg-ika-800/60 p-6">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-500">
              <Calendar className="h-4 w-4" />
              Season context
            </div>
            <div className="mt-3 text-lg font-semibold text-ink-900">Rulesets are versioned</div>
            <p className="mt-2 text-sm text-ink-500">
              Standard and F2P ranked require strict pre-check proofs before the run.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge className="border border-border bg-ika-700/70 text-ink-700">
              <BadgeCheck className="mr-1 h-3.5 w-3.5" />
              Strict proof
            </Badge>
            <Badge className="border border-border bg-ika-700/70 text-ink-700">v1.0 rulesets</Badge>
            <Button asChild size="sm" variant="outline" className="ml-auto">
              <Link to="/rulesets">View season</Link>
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}

