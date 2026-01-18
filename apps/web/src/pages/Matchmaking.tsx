import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { League, ProfileSummary, QueueConfig } from "@ika/shared";
import {
  cancelMatchSearch,
  fetchLeagues,
  fetchLobbyStats,
  fetchMatchmakingStatus,
  fetchProfile,
  fetchQueues,
  startMatchSearch
} from "../api";
import { useAuth } from "../auth/AuthProvider";

type LobbyCounters = {
  waiting: number;
  inProgress: number;
};

const leagueOrder = ["league_f2p", "league_standard", "league_unlimited"];

function readCurrentUserId(): string {
  if (typeof window === "undefined") {
    return "user_ellen";
  }
  return window.localStorage.getItem("ika:userId") ?? "user_ellen";
}

function toLobbyMap(stats: { leagueId: string; waiting: number; inProgress: number }[]) {
  return stats.reduce<Record<string, LobbyCounters>>((acc, stat) => {
    acc[stat.leagueId] = { waiting: stat.waiting, inProgress: stat.inProgress };
    return acc;
  }, {});
}

export default function Matchmaking() {
  const [queues, setQueues] = useState<QueueConfig[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [lobbyCounters, setLobbyCounters] = useState<Record<string, LobbyCounters>>({});
  const navigate = useNavigate();
  const { user } = useAuth();
  const fallbackUserId = useMemo(readCurrentUserId, []);
  const currentUserId = user?.id ?? fallbackUserId;
  const isAuthed = Boolean(user);
  const pollRef = useRef<number | null>(null);

  const refreshLobbyStats = useCallback(() => {
    fetchLobbyStats().then((stats) => setLobbyCounters(toLobbyMap(stats)));
  }, []);

  useEffect(() => {
    fetchQueues().then(setQueues);
    fetchLeagues().then(setLeagues);
    fetchProfile(currentUserId).then(setProfile);
    refreshLobbyStats();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ika:userId", currentUserId);
    }
  }, [currentUserId]);

  useEffect(() => {
    const interval = window.setInterval(refreshLobbyStats, 4000);
    return () => window.clearInterval(interval);
  }, [refreshLobbyStats]);

  useEffect(() => {
    if (!ticketId || !isSearching) {
      return;
    }
    pollRef.current = window.setInterval(async () => {
      const result = await fetchMatchmakingStatus(ticketId);
      if (result.status === "MATCH_FOUND" && result.match) {
        setStatus(null);
        setIsSearching(false);
        setTicketId(null);
        refreshLobbyStats();
        navigate(`/match/${result.match.id}`);
      }
    }, 2000);

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, [ticketId, isSearching, navigate, refreshLobbyStats]);

  const sortedLeagues = useMemo(() => {
    return leagues.slice().sort((a, b) => {
      const aIndex = leagueOrder.indexOf(a.id);
      const bIndex = leagueOrder.indexOf(b.id);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    });
  }, [leagues]);

  const selectedLeague = leagues.find((league) => league.id === selectedLeagueId) ?? null;
  const leagueQueue = queues.find((queue) => queue.leagueId === selectedLeagueId) ?? null;
  const leagueRating = profile?.ratings.find((rating) => rating.leagueId === selectedLeagueId) ?? null;
  const isVerified = profile?.user.verification.status === "VERIFIED";
  const isQueueLocked = Boolean(leagueQueue?.requireVerifier && !isVerified);
  const counters = selectedLeagueId
    ? lobbyCounters[selectedLeagueId] ?? { waiting: 0, inProgress: 0 }
    : { waiting: 0, inProgress: 0 };

  const handleFindMatch = async () => {
    if (!leagueQueue || !selectedLeagueId) {
      setStatus("Queue is not available yet.");
      return;
    }
    if (!isAuthed) {
      setStatus("Sign in to join ranked matchmaking.");
      return;
    }
    if (isQueueLocked) {
      setStatus("Verifier and UID verification are required for this league.");
      return;
    }
    setStatus("Waiting for opponent...");
    setIsSearching(true);
    const result = await startMatchSearch(currentUserId, leagueQueue.id);
    setTicketId(result.ticketId);
    if (result.status === "MATCH_FOUND" && result.match) {
      setStatus(null);
      setIsSearching(false);
      setTicketId(null);
      refreshLobbyStats();
      navigate(`/match/${result.match.id}`);
      return;
    }
    refreshLobbyStats();
  };

  const handleCancelSearch = async () => {
    if (!ticketId) {
      return;
    }
    const result = await cancelMatchSearch(ticketId);
    if (result.status === "MATCH_FOUND" && result.match) {
      setStatus(null);
      setIsSearching(false);
      setTicketId(null);
      refreshLobbyStats();
      navigate(`/match/${result.match.id}`);
      return;
    }
    setStatus(null);
    setIsSearching(false);
    setTicketId(null);
    refreshLobbyStats();
  };

  const handleBack = () => {
    if (isSearching && ticketId) {
      handleCancelSearch();
    }
    setSelectedLeagueId(null);
    setStatus(null);
  };

  return (
    <div className="page">
      {selectedLeagueId ? (
        <>
          <section className="section-header">
            <button className="ghost-button" type="button" onClick={handleBack}>
              Back to leagues
            </button>
            <h2>{selectedLeague?.name ?? "League"} lobby</h2>
            <p>Queue status and matchmaking for the selected league.</p>
          </section>

          <section className="lobby-hero">
            <div className="card lobby-info">
              <div className="card-header">
                <h3>{selectedLeague?.name ?? "League"}</h3>
                <span className="badge-outline">{selectedLeague?.type ?? "STANDARD"}</span>
              </div>
              <p>{selectedLeague?.description ?? "Competitive queue overview."}</p>
              <div className="chip-row">
                <span className={leagueQueue?.requireVerifier ? "badge" : "badge-outline"}>
                  {leagueQueue?.requireVerifier ? "Verifier required" : "Open queue"}
                </span>
              </div>
              <div className="meta-row">
                <div>
                  <div className="meta-label">Queue</div>
                  <div className="meta-value">{leagueQueue?.name ?? "TBD"}</div>
                </div>
                <div>
                  <div className="meta-label">Ruleset</div>
                  <div className="meta-value">{leagueQueue?.rulesetId ?? "TBD"}</div>
                </div>
              </div>
              <div className="lobby-actions">
                <button
                  className="primary-button"
                  onClick={handleFindMatch}
                  disabled={isSearching || !isAuthed || isQueueLocked}
                >
                  {isSearching ? "Searching..." : "Find match"}
                </button>
                {isSearching ? (
                  <button className="ghost-button" onClick={handleCancelSearch}>
                    Cancel search
                  </button>
                ) : null}
                {status ? <span className="lobby-status">{status}</span> : null}
                {!isAuthed && !status ? (
                  <span className="lobby-status">Sign in required for ranked matchmaking.</span>
                ) : null}
                {isQueueLocked && !status ? (
                  <span className="lobby-status">UID verification required for this league.</span>
                ) : null}
              </div>
            </div>

            <div className="card lobby-profile">
              <div className="card-header">
                <h3>Player card</h3>
                <span className="badge-outline">{profile?.user.verification.status ?? "PENDING"}</span>
              </div>
              <div className="stack">
                <div className="row">
                  <span>{profile?.user.displayName ?? "Player"}</span>
                  <span className="badge-outline">{profile?.user.region ?? "NA"}</span>
                </div>
                <div className="row">
                  <span>Proxy level</span>
                  <span className="badge-outline">{profile?.user.proxyLevel.level ?? 0} / 60</span>
                </div>
                <div className="row">
                  <span>Trust</span>
                  <span className="badge">{profile?.user.trustScore ?? 0}</span>
                </div>
              </div>
              <div className="meta-row">
                <div>
                  <div className="meta-label">ELO</div>
                  <div className="stat-value">{leagueRating?.elo ?? "Unrated"}</div>
                </div>
                <div>
                  <div className="meta-label">Queue</div>
                  <div className="meta-value">{leagueQueue?.name ?? "TBD"}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="lobby-stats">
            <div className="card lobby-stat">
              <div className="meta-label">Waiting players</div>
              <div className="stat-value">{counters.waiting}</div>
              <p>Players currently searching in this league.</p>
            </div>
            <div className="card lobby-stat">
              <div className="meta-label">Matches live</div>
              <div className="stat-value">{counters.inProgress}</div>
              <p>Active matches running in this league.</p>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="section-header">
            <h2>Choose a league</h2>
            <p>Select the ruleset tier to open its matchmaking lobby.</p>
          </section>

          <div className="grid matchmaking-leagues">
            {sortedLeagues.map((league) => (
              <button
                key={league.id}
                className="card card-button league-card"
                onClick={() => setSelectedLeagueId(league.id)}
              >
                <div className="card-header">
                  <h3>{league.name}</h3>
                  <span className="badge-outline">{league.type}</span>
                </div>
                <p>{league.description}</p>
                <div className="card-footer">
                  <div>
                    <div className="meta-label">Waiting</div>
                    <div className="meta-value">
                      {lobbyCounters[league.id]?.waiting ?? 0}
                    </div>
                  </div>
                  <div>
                    <div className="meta-label">Matches live</div>
                    <div className="meta-value">
                      {lobbyCounters[league.id]?.inProgress ?? 0}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
