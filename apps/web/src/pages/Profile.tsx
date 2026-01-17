import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Flag,
  Globe,
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
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";

const standardSeries = Array.from({ length: 30 }, (_, index) => {
  const base = 1620;
  const wave = Math.sin(index / 4) * 14;
  const drift = index * 1.6;
  return { day: `${index + 1}`, elo: Math.round(base + wave + drift) };
});

const f2pSeries = Array.from({ length: 30 }, (_, index) => {
  const base = 1360;
  const wave = Math.sin(index / 5) * 10;
  const drift = index * 1.1;
  return { day: `${index + 1}`, elo: Math.round(base + wave + drift) };
});

const leagueCards: LeagueCardData[] = [
  {
    name: "Standard League",
    elo: 1684,
    rank: "Elite Operative",
    delta10: 48,
    wins: 42,
    losses: 18,
    winrate: 70,
    streak: "W3",
    trend: standardSeries.slice(-10).map((point, index) => ({ day: index + 1, elo: point.elo })),
    tone: "accent"
  },
  {
    name: "F2P League",
    elo: 1402,
    rank: "Field Agent",
    delta10: -12,
    wins: 19,
    losses: 16,
    winrate: 54,
    streak: "L1",
    trend: f2pSeries.slice(-10).map((point, index) => ({ day: index + 1, elo: point.elo })),
    tone: "cool"
  },
  {
    name: "Unlimited League",
    elo: null,
    rank: "Unrated",
    delta10: 0,
    wins: 0,
    losses: 0,
    winrate: 0,
    streak: "-",
    trend: Array.from({ length: 10 }, (_, index) => ({ day: index + 1, elo: 1200 })),
    tone: "neutral"
  }
];

const topAgents: AgentUsage[] = [
  { name: "Ellen", matches: 31, winrate: 71, role: "DPS", share: 31 },
  { name: "Lycaon", matches: 22, winrate: 64, role: "Breaker", share: 22 },
  { name: "Nicole", matches: 15, winrate: 53, role: "Support", share: 15 }
];

const matchHistory: MatchItem[] = [
  {
    id: "match-1041",
    date: "2026-01-16",
    opponent: "Nova",
    league: "Standard League",
    challenge: "Weekly Challenge #12",
    result: "W",
    eloDelta: 18,
    evidenceStatus: "Verified",
    disputeStatus: "None",
    draftSummary: "Bans: Ellen, Lycaon. Picks: Ellen, Lycaon, Nicole.",
    evidenceLinks: ["Pre-check crop", "In-run crop", "Result proof"]
  },
  {
    id: "match-1037",
    date: "2026-01-14",
    opponent: "Kite",
    league: "Standard League",
    challenge: "Shiyu Defense",
    result: "W",
    eloDelta: 14,
    evidenceStatus: "Verified",
    disputeStatus: "None",
    draftSummary: "Bans: Nicole, Anby. Picks: Ellen, Lycaon, Nicole.",
    evidenceLinks: ["Pre-check crop", "Result proof"]
  },
  {
    id: "match-1032",
    date: "2026-01-13",
    opponent: "Rin",
    league: "F2P League",
    challenge: "Hollow Zero Sprint",
    result: "L",
    eloDelta: -12,
    evidenceStatus: "Pending",
    disputeStatus: "None",
    draftSummary: "Bans: Ellen, Grace. Picks: Nicole, Anby, Soukaku.",
    evidenceLinks: ["Pre-check crop", "Result proof"]
  },
  {
    id: "match-1026",
    date: "2026-01-12",
    opponent: "Juno",
    league: "Standard League",
    challenge: "Simulation Gauntlet",
    result: "W",
    eloDelta: 22,
    evidenceStatus: "Verified",
    disputeStatus: "None",
    draftSummary: "Bans: Lycaon, Nicole. Picks: Ellen, Billy, Nicole.",
    evidenceLinks: ["Pre-check crop", "In-run crop", "Result proof"]
  },
  {
    id: "match-1021",
    date: "2026-01-11",
    opponent: "Mira",
    league: "Standard League",
    challenge: "Weekly Challenge #11",
    result: "L",
    eloDelta: -18,
    evidenceStatus: "Missing",
    disputeStatus: "Open",
    draftSummary: "Bans: Ellen, Lycaon. Picks: Grace, Nicole, Anby.",
    evidenceLinks: ["Result proof"]
  },
  {
    id: "match-1017",
    date: "2026-01-10",
    opponent: "Echo",
    league: "F2P League",
    challenge: "Hollow Zero Sprint",
    result: "W",
    eloDelta: 11,
    evidenceStatus: "Verified",
    disputeStatus: "None",
    draftSummary: "Bans: Ellen, Anby. Picks: Nicole, Soukaku, Billy.",
    evidenceLinks: ["Pre-check crop", "Result proof"]
  },
  {
    id: "match-1012",
    date: "2026-01-08",
    opponent: "Sable",
    league: "Standard League",
    challenge: "Shiyu Defense",
    result: "W",
    eloDelta: 16,
    evidenceStatus: "Verified",
    disputeStatus: "None",
    draftSummary: "Bans: Nicole, Lycaon. Picks: Ellen, Grace, Nicole.",
    evidenceLinks: ["Pre-check crop", "In-run crop", "Result proof"]
  },
  {
    id: "match-1006",
    date: "2026-01-06",
    opponent: "Vex",
    league: "F2P League",
    challenge: "Supply Run Alpha",
    result: "L",
    eloDelta: -9,
    evidenceStatus: "Pending",
    disputeStatus: "None",
    draftSummary: "Bans: Ellen, Lycaon. Picks: Nicole, Soukaku, Billy.",
    evidenceLinks: ["Pre-check crop", "Result proof"]
  },
  {
    id: "match-1001",
    date: "2026-01-04",
    opponent: "Onyx",
    league: "Standard League",
    challenge: "Weekly Challenge #10",
    result: "W",
    eloDelta: 19,
    evidenceStatus: "Verified",
    disputeStatus: "Resolved",
    draftSummary: "Bans: Ellen, Nicole. Picks: Ellen, Lycaon, Grace.",
    evidenceLinks: ["Pre-check crop", "In-run crop", "Result proof"]
  },
  {
    id: "match-997",
    date: "2026-01-02",
    opponent: "Lyra",
    league: "F2P League",
    challenge: "Simulation Gauntlet",
    result: "W",
    eloDelta: 7,
    evidenceStatus: "Verified",
    disputeStatus: "None",
    draftSummary: "Bans: Ellen, Anby. Picks: Nicole, Billy, Soukaku.",
    evidenceLinks: ["Pre-check crop", "Result proof"]
  }
];

const rosterAgents: AgentItem[] = [
  {
    id: "agent-ellen",
    name: "Ellen",
    element: "Ice",
    faction: "Victoria Housekeeping",
    role: "DPS",
    owned: true,
    verified: true,
    draftEligible: true,
    rankedUsage: 31
  },
  {
    id: "agent-lycaon",
    name: "Lycaon",
    element: "Ice",
    faction: "Victoria Housekeeping",
    role: "Breaker",
    owned: true,
    verified: true,
    draftEligible: true,
    rankedUsage: 22
  },
  {
    id: "agent-nicole",
    name: "Nicole",
    element: "Ether",
    faction: "Cunning Hares",
    role: "Support",
    owned: true,
    verified: true,
    draftEligible: true,
    rankedUsage: 15
  },
  {
    id: "agent-anby",
    name: "Anby",
    element: "Electric",
    faction: "Cunning Hares",
    role: "Breaker",
    owned: true,
    verified: false,
    draftEligible: true,
    rankedUsage: 9
  },
  {
    id: "agent-grace",
    name: "Grace",
    element: "Electric",
    faction: "Belobog",
    role: "DPS",
    owned: true,
    verified: false,
    draftEligible: true,
    rankedUsage: 8
  },
  {
    id: "agent-billy",
    name: "Billy",
    element: "Physical",
    faction: "Cunning Hares",
    role: "DPS",
    owned: true,
    verified: false,
    draftEligible: true,
    rankedUsage: 6
  },
  {
    id: "agent-koleda",
    name: "Koleda",
    element: "Fire",
    faction: "Belobog",
    role: "Tank",
    owned: false,
    verified: false,
    draftEligible: false,
    rankedUsage: 0
  },
  {
    id: "agent-nekomata",
    name: "Nekomata",
    element: "Physical",
    faction: "Cunning Hares",
    role: "DPS",
    owned: true,
    verified: false,
    draftEligible: true,
    rankedUsage: 4
  },
  {
    id: "agent-soukaku",
    name: "Soukaku",
    element: "Ice",
    faction: "Section 6",
    role: "Support",
    owned: true,
    verified: false,
    draftEligible: true,
    rankedUsage: 5
  }
];

const evidenceItems: EvidenceItem[] = [
  {
    id: "ev-01",
    match: "Match vs Nova",
    type: "Pre-check crop",
    date: "2026-01-16",
    status: "Stored",
    retention: "14 days"
  },
  {
    id: "ev-02",
    match: "Match vs Nova",
    type: "In-run crop",
    date: "2026-01-16",
    status: "Stored",
    retention: "14 days"
  },
  {
    id: "ev-03",
    match: "Match vs Mira",
    type: "Result proof",
    date: "2026-01-11",
    status: "Expiring",
    retention: "3 days"
  },
  {
    id: "ev-04",
    match: "Match vs Onyx",
    type: "Result proof",
    date: "2026-01-04",
    status: "Requested",
    retention: "Pending"
  }
];

const pastTournaments: TournamentItem[] = [
  {
    id: "tour-01",
    name: "Inter-Knot Open #1",
    league: "Standard League",
    date: "2025-12-20",
    status: "Completed",
    result: "Top 8"
  },
  {
    id: "tour-02",
    name: "Proxy Clash Cup",
    league: "F2P League",
    date: "2025-11-02",
    status: "Completed",
    result: "3rd place"
  }
];

export default function Profile() {
  const [tab, setTab] = useState("overview");
  const proxyLevel = 12;
  const proxyCap = 60;
  const proxyProgress = Math.round((proxyLevel / proxyCap) * 100);
  const trustScore = 128;
  const isLoading = false;

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

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-8">
        <section className="rounded-2xl border border-border bg-gradient-to-br from-[#141b24] via-[#0f141b] to-[#0b0f14] p-6 shadow-none">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar className="h-20 w-20 border border-border">
                <AvatarFallback className="bg-gradient-to-br from-accent-500/30 via-ika-700 to-cool-500/30 text-ink-900">
                  EL
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-display text-ink-900">Ellen</h1>
                  <Badge className="border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                    Verified
                  </Badge>
                  <Badge className="border border-border bg-ika-700/70 text-ink-700">UID verified</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    NA
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4" />
                    UID verified
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    Region NA
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className="border border-border bg-ika-700/70 text-ink-700">USER</Badge>
                  <Badge className="border border-border bg-ika-700/70 text-ink-700">VERIFIED</Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 xl:items-end">
              <Badge className="border border-border bg-ika-700/70 text-ink-700">
                <Calendar className="mr-2 h-4 w-4" />
                Season 01 - 60 days left
              </Badge>
              <div className="flex flex-wrap gap-2">
                <Button size="sm">
                  <Swords className="mr-2 h-4 w-4" />
                  Challenge
                </Button>
                <Button variant="outline" size="sm">
                  <Flag className="mr-2 h-4 w-4" />
                  Report
                </Button>
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
                  className="rounded-xl border border-border bg-ika-800/70 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-500">
                    <Shield className="h-4 w-4" />
                    Trust score
                  </div>
                  <div className="mt-2 text-xl font-semibold text-ink-900">{trustScore}</div>
                  <div className="text-xs text-ink-500">High trust tier</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Trust score reflects verified matches, low dispute rate, and roster proofs.
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="rounded-xl border border-border bg-ika-800/70 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
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
                    <span className="text-xs text-ink-500">Next: 15</span>
                  </div>
                  <div className="mt-2">
                    <Progress value={proxyProgress} />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>Next unlock at level 15: judge eligibility preview.</TooltipContent>
            </Tooltip>

            <div className="rounded-xl border border-border bg-ika-800/70 px-4 py-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-500">
                <CheckCircle2 className="h-4 w-4" />
                Ranked eligibility
              </div>
              <div className="mt-2 text-xl font-semibold text-ink-900">Eligible</div>
              <div className="text-xs text-ink-500">UID verified and verifier ready</div>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="rounded-xl border border-border bg-ika-800/70 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-500">
                    <Swords className="h-4 w-4" />
                    Verifier status
                  </div>
                  <div className="mt-2 text-xl font-semibold text-ink-900">Required</div>
                  <div className="text-xs text-ink-500">Standard and F2P ranked</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>Verifier checks are required before match start in ranked.</TooltipContent>
            </Tooltip>
          </div>
        </section>

        <Tabs value={tab} onValueChange={setTab} className="mt-8">
          <div className="sticky top-24 z-20 bg-ika-900/90 pb-3 pt-3">
            <TabsList className="w-full">
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

          <TabsContent value="overview">
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Rating and leagues</div>
                    <div className="text-lg font-semibold text-ink-900">ELO across queues</div>
                  </div>
                  <div className="text-xs text-ink-500">Season 01</div>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {leagueCards.map((card) => (
                    <LeagueCard key={card.name} data={card} />
                  ))}
                </div>
              </div>

              <div className="col-span-12">
                <SeasonPerformance
                  standard={standardSeries}
                  f2p={f2pSeries}
                  kFactor={25}
                  provisional="Not provisional"
                  expectedWinrate="62%"
                />
              </div>

              <div className="col-span-12 xl:col-span-7">
                <TopAgents agents={topAgents} />
              </div>
              <div className="col-span-12 xl:col-span-5">
                <DraftImpact
                  yourBans={["Ellen", "Lycaon", "Nicole"]}
                  bansAgainst={["Ellen", "Anby", "Nicole"]}
                  pickSuccess="62%"
                  winrateDelta="+6%"
                />
              </div>

              <div className="col-span-12">
                <RecentMatches matches={recentMatches} onViewAll={() => setTab("matches")} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="matches">
            <MatchTable matches={matchHistory} />
          </TabsContent>

          <TabsContent value="draft">
            <DraftStats
              banFrequency="2.4 per match"
              pickFrequency="2.8 per match"
              draftWinrate={62}
              matchWinrate={68}
              pickSuccess="62%"
              bans={[
                { name: "Ellen", count: 18 },
                { name: "Lycaon", count: 14 },
                { name: "Nicole", count: 9 },
                { name: "Anby", count: 7 }
              ]}
              bansAgainst={[
                { name: "Ellen", count: 22 },
                { name: "Anby", count: 13 },
                { name: "Nicole", count: 11 },
                { name: "Grace", count: 6 }
              ]}
              sequences={[
                { sequence: "BAN Ellen -> BAN Lycaon", count: 12 },
                { sequence: "BAN Nicole -> BAN Anby", count: 9 },
                { sequence: "BAN Lycaon -> BAN Nicole", count: 7 },
                { sequence: "BAN Ellen -> BAN Anby", count: 6 }
              ]}
            />
          </TabsContent>

          <TabsContent value="agents">
            <AgentGrid agents={rosterAgents} />
          </TabsContent>

          <TabsContent value="tournaments">
            <TournamentsPanel upcoming={[]} past={pastTournaments} />
          </TabsContent>

          <TabsContent value="evidence">
            <EvidencePanel
              verifierRequired={["Standard", "F2P"]}
              lastPrecheck="2026-01-16 21:42 UTC"
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
    <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-8">
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
