import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Calendar, ShieldCheck } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

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
}

interface HomeHeaderProps {
  state: UserState;
  season: SeasonInfo;
  primaryAction: HeaderAction;
  secondaryAction: HeaderAction;
}

function actionIcon(icon?: HeaderAction["icon"]) {
  if (icon === "verify") {
    return <ShieldCheck className="ml-2 h-4 w-4" />;
  }
  return <ArrowRight className="ml-2 h-4 w-4" />;
}

function PrimaryAction({ action }: { action: HeaderAction }) {
  if (action.disabled) {
    return (
      <Button className="primary-button" disabled type="button">
        {action.label}
      </Button>
    );
  }

  return (
    <Button asChild className="primary-button">
      <Link to={action.to}>
        {action.label}
        {actionIcon(action.icon)}
      </Link>
    </Button>
  );
}

function SecondaryAction({ action }: { action: HeaderAction }) {
  if (action.disabled) {
    return (
      <Button
        type="button"
        variant="outline"
        className="rounded-full border-white/10 bg-white/5 hover:bg-white/10 hover:text-white"
        disabled
      >
        {action.label}
      </Button>
    );
  }

  return (
    <Button
      asChild
      variant="outline"
      className="rounded-full border-white/10 bg-white/5 hover:bg-white/10 hover:text-white transition-colors"
    >
      <Link to={action.to}>{action.label}</Link>
    </Button>
  );
}

export function HomeHeader({ state, season, primaryAction, secondaryAction }: HomeHeaderProps) {
  return (
    <section className="card relative mb-8 border border-white/10 p-8 md:p-12">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-accent-600/10 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-cool-500/10 blur-[100px]" />

      <div className="relative z-10 grid gap-12 lg:grid-cols-[1.3fr,0.7fr]">
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.25em] text-accent-500">
            <span>Inter-Knot Arena</span>
            <span className="h-1 w-1 rounded-full bg-accent-500/50" />
            <span>Season Hub</span>
          </div>

          <h1 className="mt-4 bg-gradient-to-b from-white via-white/80 to-white/30 bg-clip-text pb-2 font-display text-5xl uppercase tracking-wide text-transparent md:text-7xl">
            {season.name}
          </h1>

          <p className="mt-2 max-w-lg text-base leading-relaxed text-ink-500">
            <span className="font-medium text-ink-700">{season.daysLeft} days left</span> · {season.valueProp}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <PrimaryAction action={primaryAction} />
            <SecondaryAction action={secondaryAction} />
          </div>

          {state === "guest" ? (
            <div className="mt-4 text-sm text-ink-600">
              Create your competitive profile to unlock ranked queues.
            </div>
          ) : null}
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-white/5 bg-black/40 p-6 shadow-inner backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-600">
              <Calendar className="h-4 w-4" />
              Season context
            </div>
            <div className="mt-4 text-xl font-semibold tracking-tight text-white">Rulesets are versioned</div>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Standard and F2P ranked require strict pre-check proofs before the run. Ensure your
              roster is synced.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
            <Badge className="border-white/10 bg-accent-500/10 text-accent-400 hover:bg-accent-500/20">
              <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
              Strict proof
            </Badge>
            <Badge className="border-white/10 bg-white/5 text-ink-500">v1.0 rulesets</Badge>
          </div>
        </div>
      </div>
    </section>
  );
}
