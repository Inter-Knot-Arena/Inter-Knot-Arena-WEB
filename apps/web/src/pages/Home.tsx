import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Skeleton } from "../components/ui/skeleton";
import { TooltipProvider } from "../components/ui/tooltip";
import { HomeHeader, type UserState } from "../components/home/HomeHeader";
import { LeaderboardPreviewTable, type LeaderboardRow } from "../components/home/LeaderboardPreviewTable";
import { UpdatesFeed, type UpdateItem } from "../components/home/UpdatesFeed";

const seasonInfo = {
  name: "Season 01",
  daysLeft: 60,
  valueProp: "Queues, drafts, and proofs aligned for ranked play."
};

const leaderboardRows: LeaderboardRow[] = [
  { rank: 1, player: "Ellen", elo: 1982, record: "42-18", region: "NA", league: "Standard" },
  { rank: 2, player: "Lycaon", elo: 1910, record: "39-20", region: "EU", league: "Standard" },
  { rank: 3, player: "Nicole", elo: 1884, record: "36-22", region: "SEA", league: "Standard" },
  { rank: 4, player: "Anby", elo: 1801, record: "33-24", region: "ASIA", league: "Standard" },
  { rank: 5, player: "Koleda", elo: 1768, record: "30-26", region: "NA", league: "Standard" },
  { rank: 1, player: "Nekomata", elo: 1622, record: "19-16", region: "EU", league: "F2P" },
  { rank: 2, player: "Billy", elo: 1580, record: "18-17", region: "NA", league: "F2P" },
  { rank: 3, player: "Grace", elo: 1524, record: "16-18", region: "SEA", league: "F2P" },
  { rank: 1, player: "Rina", elo: 1710, record: "12-6", region: "NA", league: "Unlimited" },
  { rank: 2, player: "Ben", elo: 1658, record: "10-7", region: "EU", league: "Unlimited" }
];

const updates: UpdateItem[] = [
  {
    id: "u1",
    title: "Verifier 0.3.2 rollout",
    summary: "Improved pre-check detection and added retry capture shortcuts.",
    type: "verifier",
    date: "2 days ago"
  },
  {
    id: "u2",
    title: "Standard ruleset v1.1",
    summary: "Adjusted roster caps and clarified proof requirements.",
    type: "ruleset",
    date: "5 days ago"
  },
  {
    id: "u3",
    title: "Season 01 mid-split",
    summary: "Soft reset delayed; leaderboard badges updated.",
    type: "season",
    date: "1 week ago"
  }
];

interface EloOption {
  id: string;
  label: string;
  elo: number | null;
}

const eloOptions: EloOption[] = [
  { id: "standard", label: "Standard", elo: 1684 },
  { id: "f2p", label: "F2P", elo: 1402 },
  { id: "unlimited", label: "Unlimited", elo: null }
];

function EloMiniTab({
  options,
  value,
  onChange,
  disabled
}: {
  options: EloOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((option) => option.id === value) ?? options[0];
  const eloLabel = selected.elo ? `${selected.elo} ELO` : "Unrated";

  return (
    <div ref={ref} className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-ika-800/70 px-3 py-1.5 text-sm font-semibold text-ink-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="text-ink-500">ELO</span>
        <span>{disabled ? "Sign in" : eloLabel}</span>
        <span className="text-xs text-ink-500">{selected.label}</span>
        <ChevronDown className="h-4 w-4 text-ink-500" />
      </button>
      {open && !disabled ? (
        <div className="w-56 rounded-xl border border-border bg-ika-900/95 p-2 shadow-card">
          {options.map((option) => {
            const optionLabel = option.elo ? `${option.elo} ELO` : "Unrated";
            const isActive = option.id === selected.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                  isActive ? "bg-accent-500/10 text-ink-900" : "text-ink-700 hover:bg-ika-700/50"
                }`}
                role="option"
                aria-selected={isActive}
              >
                <span>{option.label}</span>
                <span className="text-xs text-ink-500">{optionLabel}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  const { user, isLoading } = useAuth();
  const userState: UserState = !user
    ? "guest"
    : user.verification.status === "VERIFIED"
      ? "verified"
      : "unverified";

  const headerActions = useMemo(() => {
    if (userState === "guest") {
      return {
        primary: { label: "Sign in (Google)", to: "/signin", icon: "arrow" as const },
        secondary: { label: "Browse leaderboards", to: "/leaderboards", variant: "outline" as const }
      };
    }
    if (userState === "unverified") {
      return {
        primary: { label: "Complete profile", to: "/settings", icon: "arrow" as const },
        secondary: { label: "Browse leaderboards", to: "/leaderboards", variant: "outline" as const }
      };
    }
    return {
      primary: { label: "Enter matchmaking", to: "/matchmaking", icon: "arrow" as const },
      secondary: { label: "View profile", to: "/profile", variant: "outline" as const }
    };
  }, [userState]);

  const [selectedLeague, setSelectedLeague] = useState("standard");
  const showElo = userState !== "guest";

  if (isLoading) {
    return <HomeSkeleton />;
  }

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-[1280px] px-6 pb-20 pt-10">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12">
            <HomeHeader
              state={userState}
              season={seasonInfo}
              primaryAction={headerActions.primary}
              secondaryAction={headerActions.secondary}
            />
          </div>

          <section className="col-span-12 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Your ELO</div>
              <div className="mt-1 text-sm text-ink-500">
                {showElo ? "Mini quick-switch" : "Sign in to view your rating."}
              </div>
            </div>
            <EloMiniTab
              options={eloOptions}
              value={selectedLeague}
              onChange={setSelectedLeague}
              disabled={!showElo}
            />
          </section>

          <div className="col-span-12">
            <LeaderboardPreviewTable rows={leaderboardRows} variant="plain" />
          </div>

          <div className="col-span-12">
            <UpdatesFeed items={updates} variant="plain" />
          </div>

        </div>
      </div>
    </TooltipProvider>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-8 px-6 pb-20 pt-10">
      <Skeleton className="h-52 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-60 w-full rounded-xl" />
    </div>
  );
}
