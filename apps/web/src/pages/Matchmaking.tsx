import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { League, ProfileSummary, QueueConfig } from "@ika/shared";
import { fetchLeagues, fetchProfile, fetchQueues, joinMatchmaking } from "../api";

type LobbyCounters = {
  waiting: number;
  inProgress: number;
};

const leagueOrder = ["league_f2p", "league_standard", "league_unlimited"];

const defaultCounters: Record<string, LobbyCounters> = {
  league_f2p: { waiting: 3, inProgress: 1 },
  league_standard: { waiting: 6, inProgress: 2 },
  league_unlimited: { waiting: 2, inProgress: 1 }
};

function readCurrentUserId(): string {
  if (typeof window === "undefined") {
    return "user_ellen";
  }
  return window.localStorage.getItem("ika:userId") ?? "user_ellen";
}

function loadCounters(): Record<string, LobbyCounters> {
  if (typeof window === "undefined") {
    return { ...defaultCounters };
  }
  const stored = window.localStorage.getItem("ika:lobbyCounters");
  if (!stored) {
    return { ...defaultCounters };
  }
  try {
    return { ...defaultCounters, ...(JSON.parse(stored) as Record<string, LobbyCounters>) };
  } catch {
    return { ...defaultCounters };
  }
}

export default function Matchmaking() {
  const [queues, setQueues] = useState<QueueConfig[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [lobbyCounters, setLobbyCounters] = useState<Record<string, LobbyCounters>>(loadCounters);
  const navigate = useNavigate();
  const currentUserId = useMemo(readCurrentUserId, []);
  const searchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    fetchQueues().then(setQueues);
    fetchLeagues().then(setLeagues);
    fetchProfile(currentUserId).then(setProfile);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ika:userId", currentUserId);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ika:lobbyCounters", JSON.stringify(lobbyCounters));
    }
  }, [lobbyCounters]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  const sortedLeagues = useMemo(() => {
    return leagues.slice().sort((a, b) => {
      const aIndex = leagueOrder.indexOf(a.id);
      const bIndex = leagueOrder.indexOf(b.id);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    });
  }, [leagues]);

  const selectedLeague = leagues.find((league) => league.id === selectedLeagueId) ?? null;
  const leagueQueue = queues.find((queue) => queue.leagueId === selectedLeagueId) ?? null;
  const leagueRating =
    profile?.ratings.find((rating) => rating.leagueId === selectedLeagueId) ?? null;
  const counters = selectedLeagueId
    ? lobbyCounters[selectedLeagueId] ?? { waiting: 0, inProgress: 0 }
    : { waiting: 0, inProgress: 0 };

  const updateCounters = (leagueId: string, updater: (prev: LobbyCounters) => LobbyCounters) => {
    setLobbyCounters((prev) => {
      const current = prev[leagueId] ?? { waiting: 0, inProgress: 0 };
      return { ...prev, [leagueId]: updater(current) };
    });
  };

  const handleFindMatch = async () => {
    if (!leagueQueue || !selectedLeagueId) {
      setStatus("Queue is not available yet.");
      return;
    }
    setStatus("Looking for opponent...");
    setIsSearching(true);
    updateCounters(selectedLeagueId, (current) => ({
      waiting: current.waiting + 1,
      inProgress: current.inProgress
    }));

    searchTimerRef.current = window.setTimeout(async () => {
      try {
        const match = await joinMatchmaking(currentUserId, leagueQueue.id);
        updateCounters(selectedLeagueId, (current) => ({
          waiting: Math.max(0, current.waiting - 1),
          inProgress: current.inProgress + 1
        }));
        setStatus(null);
        setIsSearching(false);
        navigate(`/match/${match.id}`);
      } catch {
        updateCounters(selectedLeagueId, (current) => ({
          waiting: Math.max(0, current.waiting - 1),
          inProgress: current.inProgress
        }));
        setStatus("Failed to join queue.");
        setIsSearching(false);
      }
    }, 1800);
  };

  return (
    <div className="page">
      {selectedLeagueId ? (
        <>
          <section className="section-header">
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setSelectedLeagueId(null);
                setStatus(null);
                setIsSearching(false);
              }}
            >
              Back to leagues
            </button>
            <h2>{selectedLeague?.name ?? "League"} lobby</h2>
            <p>Queue status and match search for this league.</p>
          </section>

          <section className="grid">
            <div className="card">
              <div className="card-header">
                <h3>Player card</h3>
                <span className="badge-outline">{profile?.user.verifiedStatus ?? "PENDING"}</span>
              </div>
              <div className="stack">
                <div className="row">
                  <span>{profile?.user.displayName ?? "Player"}</span>
                  <span className="badge-outline">{profile?.user.region ?? "NA"}</span>
                </div>
                <div className="row">
                  <span>Proxy level</span>
                  <span className="badge-outline">{profile?.user.proxyLevel ?? 0} / 60</span>
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

            <div className="card">
              <div className="card-header">
                <h3>League activity</h3>
                <span className="badge-outline">{selectedLeague?.type ?? "STANDARD"}</span>
              </div>
              <div className="meta-row">
                <div>
                  <div className="meta-label">Waiting</div>
                  <div className="stat-value">{counters.waiting}</div>
                </div>
                <div>
                  <div className="meta-label">Matches live</div>
                  <div className="stat-value">{counters.inProgress}</div>
                </div>
              </div>
              <p>{selectedLeague?.description ?? "Queue status per league."}</p>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Find a match</h3>
                <span className="badge">{leagueQueue?.requireVerifier ? "Verifier" : "Open"}</span>
              </div>
              <p>Start searching for an opponent in this league lobby.</p>
              <div className="card-actions">
                <button className="primary-button" onClick={handleFindMatch} disabled={isSearching}>
                  {isSearching ? "Searching..." : "Find match"}
                </button>
                {status ? <span className="meta-label">{status}</span> : null}
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="section-header">
            <h2>Choose a league</h2>
            <p>Select the ruleset tier to open its matchmaking lobby.</p>
          </section>

          <div className="grid">
            {sortedLeagues.map((league) => (
              <button
                key={league.id}
                className="card card-button"
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
