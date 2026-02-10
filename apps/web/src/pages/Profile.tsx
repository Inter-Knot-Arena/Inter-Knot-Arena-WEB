import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  Flag,
  MapPin,
  Share2,
  Shield,
  ShieldCheck,
  Swords
} from "lucide-react";
import { AgentGrid, type AgentItem } from "../components/profile/AgentGrid";
import { DraftImpact } from "../components/profile/DraftImpact";
import { DraftStats } from "../components/profile/DraftStats";
import { EvidencePanel, type EvidenceItem } from "../components/profile/EvidencePanel";
import { LeagueCard, type LeagueCardData } from "../components/profile/LeagueCard";
import { MatchTable, type MatchItem } from "../components/profile/MatchTable";
import { RecentMatches, type RecentMatchItem } from "../components/profile/RecentMatches";
import { SeasonPerformance } from "../components/profile/SeasonPerformance";
import { TopAgents, type AgentUsage } from "../components/profile/TopAgents";
import { TournamentsPanel, type TournamentItem } from "../components/profile/TournamentsPanel";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { fetchLeagues, fetchProfile } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { featureFlags } from "../flags";
import { isUidVerified, normalizedVerificationStatus, uidStatusLabel } from "../lib/verification";
import { defaultEloConfig, resolveK, type League, type LeagueType, type ProfileSummary } from "@ika/shared";

const leagueOrder: LeagueType[] = ["STANDARD", "F2P", "UNLIMITED"];

const leagueFallbacks: Record<LeagueType, League> = {
  STANDARD: {
    id: "league_standard",
    name: "Standard",
    type: "STANDARD",
    description: "Standard ranked queues."
  },
  F2P: {
    id: "league_f2p",
    name: "F2P",
    type: "F2P",
    description: "F2P ranked queues."
  },
  UNLIMITED: {
    id: "league_unlimited",
    name: "Unlimited",
    type: "UNLIMITED",
    description: "Unlimited queues."
  }
};

function buildEloSeries(base: number | null | undefined, days = 30) {
  if (!base) {
    return [];
  }
  return Array.from({ length: days }, (_, index) => {
    const wave = Math.sin(index / 4) * 6;
    const drift = (index - days / 2) * 0.4;
    return { day: `${index + 1}`, elo: Math.round(base + wave + drift) };
  });
}

function inferLeagueType(leagueId: string): LeagueType {
  const lowered = leagueId.toLowerCase();
  if (lowered.includes("f2p")) {
    return "F2P";
  }
  if (lowered.includes("standard")) {
    return "STANDARD";
  }
  return "UNLIMITED";
}

function rankFromElo(elo: number): string {
  if (elo >= 2000) {
    return "New Eridu Legend";
  }
  if (elo >= 1800) {
    return "Section Captain";
  }
  if (elo >= 1600) {
    return "Elite Operative";
  }
  if (elo >= 1400) {
    return "Field Agent";
  }
  if (elo >= 1200) {
    return "Hollow Scout";
  }
  if (elo >= 1000) {
    return "Inter-Knot Runner";
  }
  return "Proxy Rookie";
}

function initialsForName(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim().slice(0, 1))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function roleBadgeClass(role: string) {
  if (role === "ADMIN") {
    return "border border-[#FF3B30]/40 bg-[#FF3B30]/10 text-[#FF3B30]";
  }
  if (role === "STAFF") {
    return "border border-[#FF7A1A]/40 bg-[#FF7A1A]/10 text-[#FF7A1A]";
  }
  if (role === "MODER") {
    return "border border-[#2DD4BF]/40 bg-[#2DD4BF]/10 text-[#2DD4BF]";
  }
  return "border border-border bg-ika-700/70 text-ink-700";
}

function roleLabel(role: string) {
  if (role === "ADMIN") return "Admin";
  if (role === "STAFF") return "Staff";
  if (role === "MODER") return "Moder";
  return role;
}

export default function Profile() {
  const { id } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState("overview");
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const profileId = id ?? user?.id ?? null;
  const profileUser = profile?.user ?? user;
  const ratings = profile?.ratings ?? [];
  const isSelf = Boolean(profileUser?.id && user?.id && profileUser.id === user.id);
  const displayRoles = useMemo(() => {
    const roles = profileUser?.roles ?? [];
    const elevated = roles.filter((role) => role !== "USER");
    return elevated.length ? elevated : roles.length ? roles : ["USER"];
  }, [profileUser?.roles]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!profileId || !user) {
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setLoadError(null);

    Promise.all([fetchProfile(profileId), fetchLeagues()])
      .then(([summary, leagueList]) => {
        if (!active) {
          return;
        }
        setLeagues(leagueList);
        if (summary?.user?.id === profileId) {
          setProfile(summary);
        } else {
          setProfile(null);
          setLoadError("Profile summary is unavailable for this account.");
        }
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setProfile(null);
        setLoadError("Failed to load profile data.");
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, profileId, user]);

  const leagueMap = useMemo(() => {
    return leagues.reduce<Record<string, League>>((acc, league) => {
      acc[league.id] = league;
      return acc;
    }, {});
  }, [leagues]);

  const ratingByType = useMemo(() => {
    const map: Record<LeagueType, typeof ratings[number] | null> = {
      STANDARD: null,
      F2P: null,
      UNLIMITED: null
    };
    ratings.forEach((rating) => {
      const leagueType = leagueMap[rating.leagueId]?.type ?? inferLeagueType(rating.leagueId);
      map[leagueType] = rating;
    });
    return map;
  }, [ratings, leagueMap]);

  const leagueCards = useMemo<LeagueCardData[]>(() => {
    return leagueOrder.map((type) => {
      const league = leagues.find((item) => item.type === type) ?? leagueFallbacks[type];
      const rating = ratingByType[type];
      const elo = rating?.elo ?? null;
      return {
        name: `${league.name} League`,
        elo,
        rank: elo ? rankFromElo(elo) : "Unrated",
        delta10: null,
        wins: null,
        losses: null,
        winrate: null,
        streak: null,
        trend: buildEloSeries(elo, 10),
        tone: type === "STANDARD" ? "accent" : type === "F2P" ? "cool" : "neutral"
      };
    });
  }, [leagues, ratingByType]);

  const standardMeta = useMemo(() => {
    if (!ratingByType.STANDARD) {
      return {
        series: [],
        kFactor: null,
        provisional: "No matches yet",
        expectedWinrate: "-"
      };
    }
    const rating = ratingByType.STANDARD;
    return {
      series: buildEloSeries(rating.elo),
      kFactor: resolveK(rating.elo, rating.provisionalMatches, defaultEloConfig),
      provisional:
        rating.provisionalMatches < defaultEloConfig.provisionalMatches
          ? `Provisional (${rating.provisionalMatches}/${defaultEloConfig.provisionalMatches})`
          : "Not provisional",
      expectedWinrate: "-"
    };
  }, [ratingByType]);

  const f2pMeta = useMemo(() => {
    if (!ratingByType.F2P) {
      return {
        series: [],
        kFactor: null,
        provisional: "No matches yet",
        expectedWinrate: "-"
      };
    }
    const rating = ratingByType.F2P;
    return {
      series: buildEloSeries(rating.elo),
      kFactor: resolveK(rating.elo, rating.provisionalMatches, defaultEloConfig),
      provisional:
        rating.provisionalMatches < defaultEloConfig.provisionalMatches
          ? `Provisional (${rating.provisionalMatches}/${defaultEloConfig.provisionalMatches})`
          : "Not provisional",
      expectedWinrate: "-"
    };
  }, [ratingByType]);

  const proxyLevel = profileUser?.proxyLevel.level ?? 0;
  const proxyCap = 60;
  const proxyProgress = profileUser
    ? Math.min(100, Math.round((profileUser.proxyLevel.xp / profileUser.proxyLevel.nextXp) * 100))
    : 0;
  const trustScore = profileUser?.trustScore ?? 0;

  const matchHistory: MatchItem[] = [];
  const topAgents: AgentUsage[] = [];
  const rosterAgents: AgentItem[] = [];
  const evidenceItems: EvidenceItem[] = [];
  const pastTournaments: TournamentItem[] = [];
  const upcomingTournaments: TournamentItem[] = [];

  if (authLoading) {
    return <ProfileSkeleton />;
  }

  if (!user) {
    return <div className="card">Sign in to view your profile.</div>;
  }

  if (id && user.id !== id) {
    return <div className="card">Profile is private for MVP.</div>;
  }

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  const recentMatches: RecentMatchItem[] = matchHistory.slice(0, 5).map((match) => ({
    id: match.id,
    date: match.date,
    opponent: match.opponent,
    league: match.league,
    challenge: match.challenge,
    result: match.result,
    eloDelta: match.eloDelta,
    evidence: match.evidenceStatus,
    dispute: match.disputeStatus
  }));

  const verificationStatus = normalizedVerificationStatus(profileUser?.verification.status);
  const rankedEligible = isUidVerified(verificationStatus);
  const avatarInitials = profileUser ? initialsForName(profileUser.displayName) : "??";
  const displayName = profileUser?.displayName ?? "Player";
  const regionLabel = profileUser?.region ?? "NA";
  const uidLabel = uidStatusLabel(verificationStatus);
  const rosterUid = profileUser?.verification.uid;

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-[1280px] px-6 pb-16 pt-8">
        {loadError ? (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {loadError}
          </div>
        ) : null}
        <section className="rounded-2xl border border-border bg-gradient-to-br from-[#141b24] via-[#0f141b] to-[#0b0f14] p-6 shadow-none">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar className="h-20 w-20 border border-border">
                {profileUser?.avatarUrl ? (
                  <AvatarImage src={profileUser.avatarUrl} alt={displayName} />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-accent-500/30 via-ika-700 to-cool-500/30 text-ink-900">
                  {avatarInitials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-display text-ink-900">{displayName}</h1>
                  <Badge
                    className={
                      rankedEligible
                        ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border border-rose-500/40 bg-rose-500/10 text-rose-200"
                    }
                  >
                    {verificationStatus}
                  </Badge>
                  <Badge className="border border-border bg-ika-700/70 text-ink-700">{uidLabel}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {regionLabel}
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4" />
                    {uidLabel}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {displayRoles.map((role) => (
                    <Badge key={role} className={roleBadgeClass(role)}>
                      {roleLabel(role)}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 xl:items-end">
              <Badge className="border border-border bg-ika-700/70 text-ink-700">
                <Calendar className="mr-2 h-4 w-4" />
                Season 01 - 60 days left
              </Badge>
              <div className="flex flex-wrap gap-2">
                {!isSelf ? (
                  <Button size="sm">
                    <Swords className="mr-2 h-4 w-4" />
                    Challenge
                  </Button>
                ) : null}
                {!isSelf ? (
                  <Button variant="outline" size="sm">
                    <Flag className="mr-2 h-4 w-4" />
                    Report
                  </Button>
                ) : null}
                <Button variant="outline" size="sm">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share profile
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex h-full min-h-[136px] flex-col rounded-xl border border-border bg-ika-800/70 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-500">
                    <Shield className="h-4 w-4" />
                    Trust score
                  </div>
                  <div className="mt-2 text-xl font-semibold text-ink-900">{trustScore}</div>
                  <div className="mt-auto text-xs text-ink-500">
                    {rankedEligible ? "Verified account" : "Verification pending"}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Trust score reflects verified matches, low dispute rate, and roster proofs.
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex h-full min-h-[136px] flex-col rounded-xl border border-border bg-ika-800/70 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-500">
                    <ShieldCheck className="h-4 w-4" />
                    Proxy level
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm font-semibold text-ink-900">
                    <span>
                      {proxyLevel}/{proxyCap}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Progress value={proxyProgress} />
                  </div>
                  <div className="mt-auto pt-2 text-xs text-ink-500">
                    Next: {profileUser?.proxyLevel.nextXp ?? "--"} XP
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>Next unlock at level 15: moderator eligibility preview.</TooltipContent>
            </Tooltip>

            <div className="flex h-full min-h-[136px] flex-col rounded-xl border border-border bg-ika-800/70 px-4 py-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-500">
                <CheckCircle2 className="h-4 w-4" />
                Ranked eligibility
              </div>
              <div className="mt-2 text-xl font-semibold text-ink-900">
                {rankedEligible ? "Eligible" : "Locked"}
              </div>
              <div className="mt-auto text-xs text-ink-500">
                {rankedEligible ? "UID verified and proof flow ready" : "Verify UID to unlock ranked"}
              </div>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex h-full min-h-[136px] flex-col rounded-xl border border-border bg-ika-800/70 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-500">
                    <Swords className="h-4 w-4" />
                    Proof status
                  </div>
                  <div className="mt-2 text-xl font-semibold text-ink-900">Required</div>
                  <div className="mt-auto text-xs text-ink-500">Standard and F2P ranked</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>Pre-check proof is required before match start in ranked.</TooltipContent>
            </Tooltip>
          </div>
        </section>

        <Tabs value={tab} onValueChange={setTab} className="mt-8">
          <div className="sticky top-24 z-20">
            <div className="rounded-lg border border-border bg-ika-800/70 p-1">
              <TabsList className="w-full border-0 bg-transparent p-0">
              <TabsTrigger value="overview" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
                Overview
              </TabsTrigger>
              <TabsTrigger value="matches" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
                Matches
              </TabsTrigger>
              <TabsTrigger value="draft" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
                Draft
              </TabsTrigger>
              <TabsTrigger value="agents" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
                Agents
              </TabsTrigger>
              <TabsTrigger value="tournaments" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
                Tournaments
              </TabsTrigger>
              <TabsTrigger value="evidence" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
                Evidence
              </TabsTrigger>
            </TabsList>
            </div>
          </div>

          <TabsContent value="overview">
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12">
                <div className="mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Rating and leagues</div>
                    <div className="text-lg font-semibold text-ink-900">ELO across queues</div>
                  </div>
                </div>
                <div className="w-full">
                  <div className="grid gap-4 lg:grid-cols-3">
                    {leagueCards.map((card) => (
                      <LeagueCard key={card.name} data={card} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-span-12 w-full">
                <SeasonPerformance standard={standardMeta} f2p={f2pMeta} />
              </div>

              <div className="col-span-12 grid w-full gap-6 xl:grid-cols-12">
                <div className="xl:col-span-7">
                  <TopAgents agents={topAgents} />
                </div>
                <div className="xl:col-span-5">
                  <DraftImpact yourBans={[]} bansAgainst={[]} pickSuccess="-" winrateDelta="-" />
                </div>
              </div>

              <div className="col-span-12 w-full">
                <RecentMatches matches={recentMatches} onViewAll={() => setTab("matches")} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="matches">
            <MatchTable matches={matchHistory} />
          </TabsContent>

          <TabsContent value="draft">
            <DraftStats
              banFrequency="-"
              pickFrequency="-"
              draftWinrate={0}
              matchWinrate={0}
              pickSuccess="-"
              bans={[]}
              bansAgainst={[]}
              sequences={[]}
            />
          </TabsContent>

          <TabsContent value="agents">
            {featureFlags.enableAgentCatalog ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-5">
                <div className="text-sm text-ink-500">
                  Showcase roster combines catalog data with imported agent states.
                </div>
                {rosterUid ? (
                  <Link className="text-sm text-accent-400" to={`/players/${rosterUid}/roster`}>
                    View roster
                  </Link>
                ) : (
                  <span className="text-xs text-ink-500">UID required for roster view.</span>
                )}
              </div>
            ) : null}
            <AgentGrid agents={rosterAgents} />
          </TabsContent>

          <TabsContent value="tournaments">
            <TournamentsPanel upcoming={upcomingTournaments} past={pastTournaments} />
          </TabsContent>

          <TabsContent value="evidence">
            <EvidencePanel
              strictProofRequired={["Standard", "F2P"]}
              lastPrecheck="No checks yet"
              lastPrecheckStatus="NONE"
              inrunViolations={0}
              evidenceItems={evidenceItems}
              retentionInfo="Crops retained 14 days. Result proof retained 30 days."
            />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 pb-16 pt-8">
      <Card className="space-y-4 border-border bg-ika-800/70 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </Card>
      <div className="mt-6 space-y-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
