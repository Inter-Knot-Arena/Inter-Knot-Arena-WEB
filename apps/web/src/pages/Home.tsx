import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Skeleton } from "../components/ui/skeleton";
import { TooltipProvider } from "../components/ui/tooltip";
import { HomeHeader, type UserState } from "../components/home/HomeHeader";
import { LeaderboardPreviewTable, type LeaderboardRow } from "../components/home/LeaderboardPreviewTable";
import { UpdatesFeed, type UpdateItem } from "../components/home/UpdatesFeed";
import { isUidVerified } from "../lib/verification";
import {
  fetchAnalyticsSeasonReportStrict,
  fetchCurrentSeasonStrict,
  fetchLeaderboardStrict,
  fetchLeaguesStrict,
  fetchUsersStrict
} from "../api";

const unavailableSeasonInfo = {
  name: "Season data unavailable",
  daysLeft: 0,
  valueProp: "Live service data is currently unavailable."
};

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
  const selectedSafe = selected ?? { id: "unrated", label: "Unrated", elo: null };
  const eloLabel = selectedSafe.elo ? `${selectedSafe.elo} ELO` : "Unrated";

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
        <span className="text-xs text-ink-500">{selectedSafe.label}</span>
        <ChevronDown className="h-4 w-4 text-ink-500" />
      </button>
      {open && !disabled ? (
        <div className="w-56 rounded-xl border border-border bg-ika-900/95 p-2 shadow-card">
          {options.map((option) => {
            const optionLabel = option.elo ? `${option.elo} ELO` : "Unrated";
            const isActive = option.id === selectedSafe.id;
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
    : isUidVerified(user.verification.status)
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
  const [seasonInfo, setSeasonInfo] = useState(unavailableSeasonInfo);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([]);
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);

  const toErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return fallback;
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      setHomeLoading(true);
      setHomeError(null);

      const errors: string[] = [];
      const [leaguesResult, usersResult, seasonReportResult, seasonResult] = await Promise.allSettled([
        fetchLeaguesStrict(),
        fetchUsersStrict(),
        fetchAnalyticsSeasonReportStrict(),
        fetchCurrentSeasonStrict()
      ]);

      if (!active) {
        return;
      }

      const leagues = leaguesResult.status === "fulfilled" ? leaguesResult.value : [];
      const users = usersResult.status === "fulfilled" ? usersResult.value : [];
      const seasonReport = seasonReportResult.status === "fulfilled" ? seasonReportResult.value : null;
      const season = seasonResult.status === "fulfilled" ? seasonResult.value : null;

      if (leaguesResult.status === "rejected") {
        errors.push(toErrorMessage(leaguesResult.reason, "Failed to load leagues."));
      }
      if (usersResult.status === "rejected") {
        errors.push(toErrorMessage(usersResult.reason, "Failed to load users."));
      }
      if (seasonReportResult.status === "rejected") {
        errors.push(toErrorMessage(seasonReportResult.reason, "Failed to load season report."));
      }
      if (seasonResult.status === "rejected") {
        errors.push(toErrorMessage(seasonResult.reason, "Failed to load current season."));
      }

      if (season) {
        const daysLeft = Math.max(
          0,
          Math.ceil((season.endsAt - Date.now()) / (1000 * 60 * 60 * 24))
        );
        setSeasonInfo({
          name: season.name,
          daysLeft,
          valueProp: "Queues, drafts, and proofs aligned for ranked play."
        });
      } else {
        setSeasonInfo(unavailableSeasonInfo);
      }

      if (seasonReport) {
        setUpdates([
          {
            id: "season_report",
            title: `Season ${seasonReport.seasonId}`,
            summary: `Resolved matches: ${seasonReport.totalMatches}. Moderation resolves: ${seasonReport.resolvedWithModeration}.`,
            type: "season",
            date: "Live"
          },
          {
            id: "disputes_open",
            title: "Open dispute load",
            summary: `${seasonReport.disputedOpen} active disputes in queue.`,
            type: "moderation",
            date: "Live"
          },
          {
            id: "ruleset_status",
            title: "Ruleset status",
            summary: "Ranked queues enforce verified roster eligibility in draft.",
            type: "ruleset",
            date: "Live"
          }
        ]);
      } else {
        setUpdates([]);
      }

      const userMap = new Map(users.map((item) => [item.id, item]));
      const selectedLeagues = leagues.slice(0, 3);
      if (selectedLeagues.length > 0) {
        const perLeague = await Promise.allSettled(
          selectedLeagues.map(async (league) => ({
            league,
            ratings: await fetchLeaderboardStrict(league.id)
          }))
        );

        if (!active) {
          return;
        }

        const rows: LeaderboardRow[] = [];
        perLeague.forEach((result) => {
          if (result.status !== "fulfilled") {
            errors.push(toErrorMessage(result.reason, "Failed to load leaderboard."));
            return;
          }
          const { league, ratings } = result.value;
          const leagueLabel: "F2P" | "Standard" | "Unlimited" =
            league.type === "F2P"
              ? "F2P"
              : league.type === "UNLIMITED"
                ? "Unlimited"
                : "Standard";
          ratings.slice(0, 5).forEach((rating, index) => {
            const profile = userMap.get(rating.userId);
            rows.push({
              rank: index + 1,
              player: profile?.displayName ?? rating.userId,
              elo: rating.elo,
              record: `${rating.provisionalMatches}-${Math.max(0, rating.provisionalMatches - 1)}`,
              region: profile?.region ?? "OTHER",
              league: leagueLabel
            });
          });
        });

        setLeaderboardRows(rows);
      } else {
        setLeaderboardRows([]);
      }

      setHomeError(errors.length > 0 ? errors[0] ?? "Failed to load home data." : null);
      setHomeLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  if (isLoading || homeLoading) {
    return <HomeSkeleton />;
  }

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-[1280px] px-6 pb-20 pt-10">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12">
            {homeError ? (
              <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-ink-900">
                Home data is degraded: {homeError}
              </div>
            ) : null}
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
