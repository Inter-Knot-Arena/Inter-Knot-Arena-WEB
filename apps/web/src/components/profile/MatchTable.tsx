import { Fragment, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  FileCheck,
  FileWarning,
  ShieldAlert
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { cn } from "../../lib/utils";

export type MatchResult = "W" | "L";
export type EvidenceStatus = "Verified" | "Pending" | "Missing";
export type DisputeStatus = "None" | "Open" | "Resolved";

export interface MatchItem {
  id: string;
  date: string;
  opponent: string;
  league: string;
  challenge: string;
  result: MatchResult;
  eloDelta: number;
  evidenceStatus: EvidenceStatus;
  disputeStatus: DisputeStatus;
  draftSummary: string;
  evidenceLinks: string[];
}

interface MatchTableProps {
  matches: MatchItem[];
  isLoading?: boolean;
}

const evidenceStyles: Record<EvidenceStatus, string> = {
  Verified: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  Pending: "border border-amber-500/30 bg-amber-500/10 text-amber-200",
  Missing: "border border-rose-500/30 bg-rose-500/10 text-rose-300"
};

const disputeStyles: Record<DisputeStatus, string> = {
  None: "border border-border bg-ika-700/60 text-ink-500",
  Open: "border border-rose-500/30 bg-rose-500/10 text-rose-300",
  Resolved: "border border-cool-400/30 bg-cool-500/10 text-cool-300"
};

export function MatchTable({ matches, isLoading = false }: MatchTableProps) {
  const [league, setLeague] = useState("all");
  const [result, setResult] = useState("all");
  const [evidence, setEvidence] = useState("all");
  const [challenge, setChallenge] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const leagueOptions = useMemo(() => {
    return Array.from(new Set(matches.map((match) => match.league)));
  }, [matches]);

  const challengeOptions = useMemo(() => {
    return Array.from(new Set(matches.map((match) => match.challenge)));
  }, [matches]);

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      if (league !== "all" && match.league !== league) {
        return false;
      }
      if (result !== "all" && match.result !== result) {
        return false;
      }
      if (evidence !== "all" && match.evidenceStatus !== evidence) {
        return false;
      }
      if (challenge !== "all" && match.challenge !== challenge) {
        return false;
      }
      if (startDate) {
        const start = new Date(startDate);
        const matchDate = new Date(match.date);
        if (matchDate < start) {
          return false;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        const matchDate = new Date(match.date);
        if (matchDate > end) {
          return false;
        }
      }
      return true;
    });
  }, [matches, league, result, evidence, challenge, startDate, endDate]);

  const selectClass =
    "h-10 w-full rounded-md border border-border bg-ika-800/70 px-3 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500";

  return (
    <Card className="border-border bg-ika-800/70">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-sans text-ink-900">Matches</CardTitle>
            <p className="text-sm text-ink-500">Dense match history with filters and evidence.</p>
          </div>
          <div className="text-xs text-ink-500">Showing {filteredMatches.length} matches</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(280px,1.35fr)]">
          <div className="min-w-0">
            <label className="text-xs uppercase tracking-[0.2em] text-ink-500">League</label>
            <select className={selectClass} value={league} onChange={(event) => setLeague(event.target.value)}>
              <option value="all">All leagues</option>
              {leagueOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="text-xs uppercase tracking-[0.2em] text-ink-500">Result</label>
            <select className={selectClass} value={result} onChange={(event) => setResult(event.target.value)}>
              <option value="all">All results</option>
              <option value="W">Win</option>
              <option value="L">Loss</option>
            </select>
          </div>
          <div className="min-w-0">
            <label className="text-xs uppercase tracking-[0.2em] text-ink-500">Challenge</label>
            <select
              className={selectClass}
              value={challenge}
              onChange={(event) => setChallenge(event.target.value)}
            >
              <option value="all">All challenges</option>
              {challengeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="text-xs uppercase tracking-[0.2em] text-ink-500">Evidence</label>
            <select
              className={selectClass}
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
            >
              <option value="all">All evidence</option>
              <option value="Verified">Verified</option>
              <option value="Pending">Pending</option>
              <option value="Missing">Missing</option>
            </select>
          </div>
          <div className="min-w-0">
            <label className="text-xs uppercase tracking-[0.2em] text-ink-500">Date range</label>
            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-ika-700/20 p-6 text-sm text-ink-500">
            No matches found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-ink-500">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Opponent</th>
                  <th className="px-3 py-2 text-left">League</th>
                  <th className="px-3 py-2 text-left">Challenge</th>
                  <th className="px-3 py-2 text-left">Result</th>
                  <th className="px-3 py-2 text-left">ELO delta</th>
                  <th className="px-3 py-2 text-left">Evidence</th>
                  <th className="px-3 py-2 text-left">Dispute</th>
                </tr>
              </thead>
              <tbody>
                {filteredMatches.map((match) => {
                  const isExpanded = expandedId === match.id;
                  return (
                    <Fragment key={match.id}>
                      <tr className="border-t border-border">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-ink-500 hover:text-ink-900"
                              onClick={() => setExpandedId(isExpanded ? null : match.id)}
                              aria-expanded={isExpanded}
                              aria-label="Toggle match details"
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                            <span>{match.date}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-semibold text-ink-900">{match.opponent}</td>
                        <td className="px-3 py-3 text-ink-700">{match.league}</td>
                        <td className="px-3 py-3 text-ink-700">{match.challenge}</td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "font-semibold",
                              match.result === "W" ? "text-cool-400" : "text-accent-400"
                            )}
                          >
                            {match.result}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "font-semibold",
                              match.eloDelta >= 0 ? "text-cool-400" : "text-accent-400"
                            )}
                          >
                            {match.eloDelta >= 0 ? "+" : ""}
                            {match.eloDelta}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <Badge className={evidenceStyles[match.evidenceStatus]}>
                            {match.evidenceStatus === "Verified" && <FileCheck className="mr-1 h-3 w-3" />}
                            {match.evidenceStatus === "Pending" && <Clock className="mr-1 h-3 w-3" />}
                            {match.evidenceStatus === "Missing" && <FileWarning className="mr-1 h-3 w-3" />}
                            {match.evidenceStatus}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <Badge className={disputeStyles[match.disputeStatus]}>
                            {match.disputeStatus === "Open" && <ShieldAlert className="mr-1 h-3 w-3" />}
                            {match.disputeStatus}
                          </Badge>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-t border-border">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid gap-4 lg:grid-cols-[1.3fr,0.7fr]">
                              <div>
                                <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Draft summary</div>
                                <div className="mt-2 text-sm text-ink-900">{match.draftSummary}</div>
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Evidence</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {match.evidenceLinks.map((link) => (
                                    <Button key={link} type="button" variant="outline" size="sm">
                                      {link}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
