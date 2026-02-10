import type {
  Agent,
  AgentCatalog,
  Dispute,
  DraftActionType,
  EvidenceResult,
  League,
  Match,
  PlayerRosterImportSummary,
  PlayerRosterView,
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
    const response = await fetch(`${API_BASE}${path}`, { credentials: "include" });
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
      credentials: "include",
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
  const fallbackUser: User = users[0] ?? {
    id: "user_demo",
    email: "demo@interknot.dev",
    displayName: "Demo User",
    avatarUrl: null,
    region: "NA",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    roles: ["USER"],
    trustScore: 100,
    proxyLevel: { level: 1, xp: 0, nextXp: 100 },
    verification: { status: "UNVERIFIED" },
    privacy: { showUidPublicly: false, showMatchHistoryPublicly: true }
  };
  const defaultProfile: ProfileSummary = profiles[0] ?? { user: fallbackUser, ratings: [] };
  const fallback = profiles.find((item) => item.user.id === userId) ?? defaultProfile;
  return safeFetch<ProfileSummary>(`/profiles/${userId}`, fallback);
}

export function joinMatchmaking(userId: string, queueId: string): Promise<Match> {
  return postJson<Match>("/matchmaking/join", { queueId }, demoMatch);
}

export function startMatchSearch(
  userId: string,
  queueId: string
): Promise<MatchmakingSearchResponse> {
  return postJson<MatchmakingSearchResponse>(
    "/matchmaking/search",
    { queueId },
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
  return postJson<Match>(`/matches/${matchId}/checkin`, {}, demoMatch);
}

export function submitDraftAction(
  matchId: string,
  userId: string,
  type: DraftActionType,
  agentId: string
): Promise<Match> {
  return postJson<Match>(`/matches/${matchId}/draft/action`, { type, agentId }, demoMatch);
}

export function submitPrecheck(
  matchId: string,
  payload: {
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
  return postJson<Match>(`/matches/${matchId}/confirm`, {}, demoMatch);
}

export function openDispute(
  matchId: string,
  userId: string,
  reason: string,
  evidenceUrls?: string[]
): Promise<Dispute> {
  return postJson<Dispute>(`/matches/${matchId}/dispute/open`, { reason, evidenceUrls }, {
    id: "dispute_demo",
    matchId,
    openedBy: userId || "user_demo",
    reason,
    status: "OPEN",
    evidenceUrls,
    createdAt: Date.now()
  });
}

export function fetchDisputes(): Promise<Dispute[]> {
  return safeFetch<Dispute[]>("/disputes/queue", []);
}

export function resolveDispute(
  disputeId: string,
  decision: string,
  winnerUserId?: string
): Promise<Dispute> {
  return postJson<Dispute>(`/disputes/${disputeId}/decision`, { decision, winnerUserId }, {
    id: disputeId,
    matchId: "match_demo",
    openedBy: "user_ellen",
    reason: "demo",
    status: "RESOLVED",
    decision,
    winnerUserId,
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

export async function submitUidVerification(payload: {
  uid: string;
  region: string;
}): Promise<{ code: string; status: string }> {
  return postJsonWithCredentials<{ code: string; status: string }>("/identity/uid/submit", payload);
}

export async function verifyUidProof(payload: {
  uid: string;
  region: string;
  code: string;
  proofUrl?: string;
}): Promise<User> {
  return postJsonWithCredentials<User>("/identity/uid/verify-proof", payload);
}

export function fetchAgentCatalog(): Promise<AgentCatalog> {
  return safeFetch<AgentCatalog>("/catalog/agents", { catalogVersion: "unknown", agents: [] });
}

export async function fetchPlayerRoster(options: {
  uid: string;
  region?: string;
  rulesetId?: string;
}): Promise<PlayerRosterView> {
  const url = new URL(`${API_BASE}/players/${options.uid}/roster`, window.location.origin);
  if (options.region) {
    url.searchParams.set("region", options.region);
  }
  if (options.rulesetId) {
    url.searchParams.set("rulesetId", options.rulesetId);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Roster fetch failed (${response.status})`);
  }
  return (await response.json()) as PlayerRosterView;
}

export async function importRosterFromEnka(payload: {
  uid: string;
  region: string;
  force?: boolean;
}): Promise<PlayerRosterImportSummary> {
  const response = await fetch(`${API_BASE}/players/${payload.uid}/import/enka`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ region: payload.region, force: payload.force })
  });
  if (!response.ok) {
    let message = `Enka import failed (${response.status})`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data?.error) {
        message = data.error;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }
  return (await response.json()) as PlayerRosterImportSummary;
}

export async function upsertManualRosterAgents(payload: {
  uid: string;
  region: string;
  agentIds: string[];
}): Promise<{ updatedCount: number; updatedAt: string }> {
  return postJsonWithCredentials<{ updatedCount: number; updatedAt: string }>(
    `/players/${payload.uid}/roster/manual`,
    { region: payload.region, agents: payload.agentIds.map((agentId) => ({ agentId })) }
  );
}
