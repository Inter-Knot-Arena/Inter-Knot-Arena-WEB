import type {
  Agent,
  Dispute,
  DraftActionType,
  EvidenceResult,
  League,
  Match,
  ProfileSummary,
  QueueConfig,
  Rating,
  Ruleset,
  User
} from "@ika/shared";
import {
  agents,
  demoMatch,
  leagues,
  lobbyStats,
  profiles,
  queues,
  ratings,
  rulesets,
  users
} from "./data/mock";

export interface LobbyStats {
  leagueId: string;
  waiting: number;
  inProgress: number;
}

export interface MatchmakingSearchResponse {
  status: "SEARCHING" | "MATCH_FOUND";
  ticketId: string;
  match?: Match;
}

export interface MatchmakingStatusResponse {
  status: "SEARCHING" | "MATCH_FOUND";
  match?: Match;
}

export interface MatchmakingCancelResponse {
  status: "CANCELED" | "MATCH_FOUND";
  match?: Match;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`);
    if (!response.ok) {
      return fallback;
    }
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

async function postJson<T>(path: string, payload: unknown, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return fallback;
    }
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

async function postJsonWithCredentials<T>(path: string, payload?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: payload ? JSON.stringify(payload) : undefined
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function patchJsonWithCredentials<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchQueues(): Promise<QueueConfig[]> {
  return safeFetch<QueueConfig[]>("/queues", queues);
}

export function fetchLeagues(): Promise<League[]> {
  return safeFetch<League[]>("/leagues", leagues);
}

export function fetchLobbyStats(): Promise<LobbyStats[]> {
  return safeFetch<LobbyStats[]>("/matchmaking/lobbies", lobbyStats);
}

export async function fetchLeaderboard(leagueId: string): Promise<Rating[]> {
  const fallback = ratings
    .filter((item) => item.leagueId === leagueId)
    .slice()
    .sort((a, b) => b.elo - a.elo);
  const data = await safeFetch<{ leagueId: string; ratings: Rating[] }>(
    `/leaderboards/${leagueId}`,
    { leagueId, ratings: fallback }
  );
  return data.ratings;
}

export function fetchMatch(matchId: string): Promise<Match> {
  return safeFetch<Match>(`/matches/${matchId}`, demoMatch);
}

export function fetchAgents(): Promise<Agent[]> {
  return safeFetch<Agent[]>("/agents", agents);
}

export function fetchRulesets(): Promise<Ruleset[]> {
  return safeFetch<Ruleset[]>("/rulesets", rulesets);
}

export function fetchUsers(): Promise<User[]> {
  return safeFetch<User[]>("/users", users);
}

export function fetchProfile(userId: string): Promise<ProfileSummary> {
  const fallback = profiles.find((item) => item.user.id === userId) ?? profiles[0];
  return safeFetch<ProfileSummary>(`/profiles/${userId}`, fallback);
}

export function joinMatchmaking(userId: string, queueId: string): Promise<Match> {
  return postJson<Match>("/matchmaking/join", { userId, queueId }, demoMatch);
}

export function startMatchSearch(
  userId: string,
  queueId: string
): Promise<MatchmakingSearchResponse> {
  return postJson<MatchmakingSearchResponse>(
    "/matchmaking/search",
    { userId, queueId },
    { status: "MATCH_FOUND", ticketId: "ticket_demo", match: demoMatch }
  );
}

export function fetchMatchmakingStatus(ticketId: string): Promise<MatchmakingStatusResponse> {
  return safeFetch<MatchmakingStatusResponse>(
    `/matchmaking/status/${ticketId}`,
    { status: "SEARCHING" }
  );
}

export function cancelMatchSearch(ticketId: string): Promise<MatchmakingCancelResponse> {
  return postJson<MatchmakingCancelResponse>(
    "/matchmaking/cancel",
    { ticketId },
    { status: "CANCELED" }
  );
}

export function checkinMatch(matchId: string, userId: string): Promise<Match> {
  return postJson<Match>(`/matches/${matchId}/checkin`, { userId }, demoMatch);
}

export function submitDraftAction(
  matchId: string,
  userId: string,
  type: DraftActionType,
  agentId: string
): Promise<Match> {
  return postJson<Match>(`/matches/${matchId}/draft/action`, { userId, type, agentId }, demoMatch);
}

export function submitPrecheck(
  matchId: string,
  payload: {
    userId: string;
    detectedAgents: string[];
    confidence?: Record<string, number>;
    result: EvidenceResult;
    frameHash?: string;
    cropUrl?: string;
  }
): Promise<Match> {
  return postJson<Match>(`/matches/${matchId}/evidence/precheck`, payload, demoMatch);
}

export function submitInrun(
  matchId: string,
  payload: {
    userId: string;
    detectedAgents: string[];
    confidence?: Record<string, number>;
    result: EvidenceResult;
    frameHash?: string;
    cropUrl?: string;
  }
): Promise<Match> {
  return postJson<Match>(`/matches/${matchId}/evidence/inrun`, payload, demoMatch);
}

export function submitResult(
  matchId: string,
  payload: {
    metricType: "TIME_MS" | "SCORE" | "RANK_TIER";
    value: number | string;
    proofUrl: string;
  }
): Promise<Match> {
  return postJson<Match>(`/matches/${matchId}/result/submit`, payload, demoMatch);
}

export function confirmMatchResult(matchId: string, userId: string): Promise<Match> {
  return postJson<Match>(`/matches/${matchId}/confirm`, { userId }, demoMatch);
}

export function openDispute(
  matchId: string,
  userId: string,
  reason: string
): Promise<Dispute> {
  return postJson<Dispute>(`/matches/${matchId}/dispute/open`, { userId, reason }, {
    id: "dispute_demo",
    matchId,
    openedBy: userId,
    reason,
    status: "OPEN",
    createdAt: Date.now()
  });
}

export function fetchDisputes(): Promise<Dispute[]> {
  return safeFetch<Dispute[]>("/disputes/queue", []);
}

export function resolveDispute(disputeId: string, decision: string): Promise<Dispute> {
  return postJson<Dispute>(`/disputes/${disputeId}/decision`, { decision }, {
    id: disputeId,
    matchId: "match_demo",
    openedBy: "user_ellen",
    reason: "demo",
    status: "RESOLVED",
    decision,
    createdAt: Date.now()
  });
}

export async function fetchAuthMe(): Promise<User | null> {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as User;
  } catch {
    return null;
  }
}

export async function startGoogleAuth(redirect?: string): Promise<{ url: string }> {
  const url = new URL(`${API_BASE}/auth/google/start`, window.location.origin);
  if (redirect) {
    url.searchParams.set("redirect", redirect);
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to start Google auth");
  }
  return (await response.json()) as { url: string };
}

export async function logout(): Promise<void> {
  await postJsonWithCredentials("/auth/logout");
}

export async function loginWithEmail(payload: { email: string; password: string }): Promise<User> {
  return postJsonWithCredentials<User>("/auth/login", payload);
}

export async function registerWithEmail(payload: {
  email: string;
  password: string;
  displayName?: string;
  region?: string;
}): Promise<User> {
  return postJsonWithCredentials<User>("/auth/register", payload);
}

export async function updateMe(payload: {
  displayName?: string;
  region?: string;
  avatarUrl?: string | null;
  privacy?: { showUidPublicly?: boolean; showMatchHistoryPublicly?: boolean };
}): Promise<User> {
  return patchJsonWithCredentials<User>("/users/me", payload);
}
