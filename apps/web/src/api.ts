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
  ProfileAnalytics,
  ProfileMatchHistoryPage,
  ProfileSummary,
  QueueConfig,
  RankBand,
  Rating,
  Ruleset,
  Sanction,
  Season,
  User
} from "@ika/shared";

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

export interface AuditEvent {
  id: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  payload?: unknown;
  createdAt: number;
}

export interface AgentPickBanAnalytics {
  agentId: string;
  picks: number;
  bans: number;
  wins: number;
  losses: number;
  winrate: number | null;
}

export interface AgentComboAnalytics {
  combo: [string, string];
  matches: number;
  wins: number;
  winrate: number;
}

export interface SeasonReport {
  seasonId: string;
  totalMatches: number;
  disputedOpen: number;
  resolvedWithModeration: number;
  averageMatchDurationSec: number | null;
}

export interface PresignedUpload {
  key: string;
  uploadUrl: string;
  publicUrl?: string;
  expiresIn: number;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (data?.error) {
      return data.error;
    }
  } catch {
    // ignore non-json body
  }
  return `Request failed: ${response.status}`;
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as T;
}

async function requestJsonOr<T>(path: string, fallback: T, options?: RequestInit): Promise<T> {
  try {
    return await requestJson<T>(path, options);
  } catch {
    return fallback;
  }
}

function jsonRequest(body: unknown, method = "POST"): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

export function fetchQueues(): Promise<QueueConfig[]> {
  return requestJsonOr<QueueConfig[]>("/queues", []);
}

export function fetchLeagues(): Promise<League[]> {
  return requestJsonOr<League[]>("/leagues", []);
}

export function fetchLobbyStats(): Promise<LobbyStats[]> {
  return requestJsonOr<LobbyStats[]>("/matchmaking/lobbies", []);
}

export async function fetchLeaderboard(leagueId: string): Promise<Rating[]> {
  const data = await requestJsonOr<{ leagueId: string; ratings: Rating[] }>(
    `/leaderboards/${leagueId}`,
    { leagueId, ratings: [] }
  );
  return data.ratings;
}

export function fetchMatch(matchId: string): Promise<Match> {
  return requestJson<Match>(`/matches/${matchId}`);
}

export function fetchAgents(): Promise<Agent[]> {
  return requestJsonOr<Agent[]>("/agents", []);
}

export function fetchRulesets(): Promise<Ruleset[]> {
  return requestJsonOr<Ruleset[]>("/rulesets", []);
}

export function fetchUsers(): Promise<User[]> {
  return requestJsonOr<User[]>("/users", []);
}

export function fetchProfile(userId: string): Promise<ProfileSummary> {
  return requestJson<ProfileSummary>(`/profiles/${userId}`);
}

export function fetchProfileAnalytics(userId: string): Promise<ProfileAnalytics> {
  return requestJson<ProfileAnalytics>(`/profiles/${userId}/analytics`);
}

export function fetchProfileMatches(
  userId: string,
  params?: {
    leagueId?: string;
    result?: "W" | "L" | "DRAW";
    evidenceStatus?: "Verified" | "Pending" | "Missing";
    challengeId?: string;
    startDateTs?: number;
    endDateTs?: number;
    page?: number;
    pageSize?: number;
  }
): Promise<ProfileMatchHistoryPage> {
  const query = new URLSearchParams();
  if (params?.leagueId) query.set("leagueId", params.leagueId);
  if (params?.result) query.set("result", params.result);
  if (params?.evidenceStatus) query.set("evidenceStatus", params.evidenceStatus);
  if (params?.challengeId) query.set("challengeId", params.challengeId);
  if (Number.isFinite(params?.startDateTs)) query.set("startDateTs", String(params?.startDateTs));
  if (Number.isFinite(params?.endDateTs)) query.set("endDateTs", String(params?.endDateTs));
  if (Number.isFinite(params?.page)) query.set("page", String(params?.page));
  if (Number.isFinite(params?.pageSize)) query.set("pageSize", String(params?.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return requestJson<ProfileMatchHistoryPage>(`/profiles/${userId}/matches${suffix}`);
}

export function joinMatchmaking(_userId: string, queueId: string): Promise<Match> {
  return requestJson<Match>("/matchmaking/join", jsonRequest({ queueId }));
}

export function startMatchSearch(
  _userId: string,
  queueId: string
): Promise<MatchmakingSearchResponse> {
  return requestJson<MatchmakingSearchResponse>("/matchmaking/search", jsonRequest({ queueId }));
}

export function fetchMatchmakingStatus(ticketId: string): Promise<MatchmakingStatusResponse> {
  return requestJson<MatchmakingStatusResponse>(`/matchmaking/status/${ticketId}`);
}

export function cancelMatchSearch(ticketId: string): Promise<MatchmakingCancelResponse> {
  return requestJson<MatchmakingCancelResponse>("/matchmaking/cancel", jsonRequest({ ticketId }));
}

export function checkinMatch(matchId: string, _userId: string): Promise<Match> {
  return requestJson<Match>(`/matches/${matchId}/checkin`, jsonRequest({}));
}

export function submitDraftAction(
  matchId: string,
  _userId: string,
  type: DraftActionType,
  agentId: string
): Promise<Match> {
  return requestJson<Match>(`/matches/${matchId}/draft/action`, jsonRequest({ type, agentId }));
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
  return requestJson<Match>(`/matches/${matchId}/evidence/precheck`, jsonRequest(payload));
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
  return requestJson<Match>(`/matches/${matchId}/evidence/inrun`, jsonRequest(payload));
}

export function submitResult(
  matchId: string,
  payload: {
    metricType: "TIME_MS" | "SCORE" | "RANK_TIER";
    value: number | string;
    proofUrl: string;
    demoUrl?: string;
    notes?: string;
  }
): Promise<Match> {
  return requestJson<Match>(`/matches/${matchId}/result/submit`, jsonRequest(payload));
}

export function confirmMatchResult(matchId: string, _userId: string): Promise<Match> {
  return requestJson<Match>(`/matches/${matchId}/confirm`, jsonRequest({}));
}

export function openDispute(
  matchId: string,
  _userId: string,
  reason: string,
  evidenceUrls?: string[]
): Promise<Dispute> {
  return requestJson<Dispute>(
    `/matches/${matchId}/dispute/open`,
    jsonRequest({ reason, evidenceUrls })
  );
}

export function fetchDisputes(): Promise<Dispute[]> {
  return requestJsonOr<Dispute[]>("/disputes/queue", []);
}

export function resolveDispute(
  disputeId: string,
  decision: string,
  winnerUserId?: string
): Promise<Dispute> {
  return requestJson<Dispute>(
    `/disputes/${disputeId}/decision`,
    jsonRequest({ decision, winnerUserId })
  );
}

export async function fetchAuthMe(): Promise<User | null> {
  try {
    return await requestJson<User>("/auth/me");
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
    throw new Error(await readError(response));
  }
  return (await response.json()) as { url: string };
}

export async function logout(): Promise<void> {
  await requestJson<{ status: string }>("/auth/logout", jsonRequest({}));
}

export function loginWithEmail(payload: { email: string; password: string }): Promise<User> {
  return requestJson<User>("/auth/login", jsonRequest(payload));
}

export function registerWithEmail(payload: {
  email: string;
  password: string;
  displayName?: string;
  region?: string;
}): Promise<User> {
  return requestJson<User>("/auth/register", jsonRequest(payload));
}

export function updateMe(payload: {
  displayName?: string;
  region?: string;
  avatarUrl?: string | null;
  privacy?: { showUidPublicly?: boolean; showMatchHistoryPublicly?: boolean };
}): Promise<User> {
  return requestJson<User>("/users/me", jsonRequest(payload, "PATCH"));
}

export function submitUidVerification(payload: {
  uid: string;
  region: string;
}): Promise<{ code: string; status: string }> {
  return requestJson<{ code: string; status: string }>("/identity/uid/submit", jsonRequest(payload));
}

export function verifyUidProof(payload: {
  uid: string;
  region: string;
  code: string;
  proofUrl?: string;
}): Promise<User> {
  return requestJson<User>("/identity/uid/verify-proof", jsonRequest(payload));
}

export function fetchAgentCatalog(): Promise<AgentCatalog> {
  return requestJsonOr<AgentCatalog>("/catalog/agents", { catalogVersion: "unknown", agents: [] });
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
  const response = await fetch(url.toString(), { credentials: "include" });
  if (!response.ok) {
    throw new Error(await readError(response));
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
    throw new Error(await readError(response));
  }
  return (await response.json()) as PlayerRosterImportSummary;
}

export function upsertManualRosterAgents(payload: {
  uid: string;
  region: string;
  agentIds: string[];
}): Promise<{ updatedCount: number; updatedAt: string }> {
  return requestJson<{ updatedCount: number; updatedAt: string }>(
    `/players/${payload.uid}/roster/manual`,
    jsonRequest({ region: payload.region, agents: payload.agentIds.map((agentId) => ({ agentId })) })
  );
}

export function fetchAdminRulesets(): Promise<Ruleset[]> {
  return requestJson<Ruleset[]>("/admin/rulesets");
}

export function saveAdminRuleset(rulesetId: string, payload: Partial<Ruleset>): Promise<Ruleset> {
  return requestJson<Ruleset>(`/admin/rulesets/${rulesetId}`, jsonRequest(payload, "PUT"));
}

export function fetchAdminSeasons(): Promise<Season[]> {
  return requestJson<Season[]>("/admin/seasons");
}

export function saveAdminSeason(seasonId: string, payload: Partial<Season>): Promise<Season> {
  return requestJson<Season>(`/admin/seasons/${seasonId}`, jsonRequest(payload, "PUT"));
}

export function fetchRankBands(): Promise<RankBand[]> {
  return requestJson<RankBand[]>("/admin/rank-bands");
}

export function saveRankBands(bands: RankBand[]): Promise<RankBand[]> {
  return requestJson<RankBand[]>("/admin/rank-bands", jsonRequest({ bands }, "PUT"));
}

export function fetchSanctions(limit = 100): Promise<Sanction[]> {
  return requestJson<Sanction[]>(`/admin/sanctions?limit=${limit}`);
}

export function createSanction(payload: Partial<Sanction>): Promise<Sanction> {
  return requestJson<Sanction>("/admin/sanctions", jsonRequest(payload));
}

export function updateSanction(
  sanctionId: string,
  payload: Partial<Pick<Sanction, "status" | "reason" | "expiresAt" | "metadata">>
): Promise<Sanction> {
  return requestJson<Sanction>(`/admin/sanctions/${sanctionId}`, jsonRequest(payload, "PATCH"));
}

export function fetchAuditLogs(options?: {
  limit?: number;
  actorUserId?: string;
  action?: string;
  entityType?: string;
}): Promise<AuditEvent[]> {
  const query = new URLSearchParams();
  if (options?.limit) {
    query.set("limit", String(options.limit));
  }
  if (options?.actorUserId) {
    query.set("actorUserId", options.actorUserId);
  }
  if (options?.action) {
    query.set("action", options.action);
  }
  if (options?.entityType) {
    query.set("entityType", options.entityType);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return requestJson<AuditEvent[]>(`/admin/audit${suffix}`);
}

export function fetchAnalyticsPickBan(): Promise<AgentPickBanAnalytics[]> {
  return requestJsonOr<AgentPickBanAnalytics[]>("/analytics/pick-ban", []);
}

export function fetchAnalyticsAgentCombos(): Promise<AgentComboAnalytics[]> {
  return requestJsonOr<AgentComboAnalytics[]>("/analytics/agent-combos", []);
}

export function fetchAnalyticsSeasonReport(): Promise<SeasonReport> {
  return requestJsonOr<SeasonReport>("/analytics/season/report", {
    seasonId: "unknown",
    totalMatches: 0,
    disputedOpen: 0,
    resolvedWithModeration: 0,
    averageMatchDurationSec: null
  });
}

export function requestPresignedUpload(payload: {
  purpose: string;
  contentType: string;
  extension?: string;
}): Promise<PresignedUpload> {
  return requestJson<PresignedUpload>("/uploads/presign", jsonRequest(payload));
}

export async function uploadEvidenceFile(
  file: File,
  purpose = "match-proof"
): Promise<{ url: string; key: string }> {
  const extension = file.name.includes(".") ? file.name.split(".").pop() ?? "" : "";
  const presign = await requestPresignedUpload({
    purpose,
    contentType: file.type || "application/octet-stream",
    extension
  });
  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file
  });
  if (!uploadResponse.ok) {
    throw new Error(`Upload failed (${uploadResponse.status})`);
  }
  return {
    url: presign.publicUrl ?? presign.key,
    key: presign.key
  };
}
