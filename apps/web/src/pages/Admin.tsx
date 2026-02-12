import { useEffect, useMemo, useState } from "react";
import type { RankBand, Ruleset, Sanction, Season } from "@ika/shared";
import { useAuth } from "../auth/AuthProvider";
import {
  createSanction,
  fetchAdminRulesets,
  fetchAdminSeasons,
  fetchAuditLogs,
  fetchDisputes,
  fetchLobbyStats,
  fetchQueues,
  fetchRankBands,
  fetchSanctions,
  saveAdminRuleset,
  saveAdminSeason,
  saveRankBands,
  updateSanction,
  type AuditEvent
} from "../api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";

function nextSeasonStatus(status: Season["status"]): Season["status"] {
  if (status === "PLANNED") {
    return "ACTIVE";
  }
  if (status === "ACTIVE") {
    return "ENDED";
  }
  return "PLANNED";
}

function canAdmin(roles: string[] | undefined): boolean {
  return Boolean(roles?.includes("ADMIN") || roles?.includes("STAFF"));
}

export default function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [rankBands, setRankBands] = useState<RankBand[]>([]);
  const [queuesCount, setQueuesCount] = useState(0);
  const [waitingCount, setWaitingCount] = useState(0);
  const [openDisputes, setOpenDisputes] = useState(0);
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [auditRows, setAuditRows] = useState<AuditEvent[]>([]);
  const [rankBandsJson, setRankBandsJson] = useState("");
  const [newSanctionUserId, setNewSanctionUserId] = useState("");
  const [newSanctionReason, setNewSanctionReason] = useState("");
  const [newSanctionType, setNewSanctionType] = useState<Sanction["type"]>("WARNING");

  const isAdmin = useMemo(() => canAdmin(user?.roles), [user?.roles]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        rulesetsData,
        seasonsData,
        rankBandsData,
        queues,
        lobbies,
        disputes,
        sanctionsData,
        auditData
      ] = await Promise.all([
        fetchAdminRulesets(),
        fetchAdminSeasons(),
        fetchRankBands(),
        fetchQueues(),
        fetchLobbyStats(),
        fetchDisputes(),
        fetchSanctions(50),
        fetchAuditLogs({ limit: 50 })
      ]);
      setRulesets(rulesetsData);
      setSeasons(seasonsData);
      setRankBands(rankBandsData);
      setRankBandsJson(JSON.stringify(rankBandsData, null, 2));
      setQueuesCount(queues.length);
      setWaitingCount(lobbies.reduce((sum, item) => sum + item.waiting, 0));
      setOpenDisputes(disputes.length);
      setSanctions(sanctionsData);
      setAuditRows(auditData);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load admin data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }
    void load();
  }, [authLoading, user?.id]);

  const handleToggleRulesetVerifier = async (ruleset: Ruleset) => {
    try {
      const updated = await saveAdminRuleset(ruleset.id, {
        requireVerifier: !ruleset.requireVerifier
      });
      setRulesets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Failed to update ruleset.";
      setError(message);
    }
  };

  const handleCycleSeasonStatus = async (season: Season) => {
    try {
      const updated = await saveAdminSeason(season.id, {
        status: nextSeasonStatus(season.status)
      });
      setSeasons((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to update season.";
      setError(message);
    }
  };

  const handleSaveRankBands = async () => {
    try {
      const parsed = JSON.parse(rankBandsJson) as RankBand[];
      const updated = await saveRankBands(parsed);
      setRankBands(updated);
      setRankBandsJson(JSON.stringify(updated, null, 2));
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to save rank bands.";
      setError(message);
    }
  };

  const handleCreateSanction = async () => {
    try {
      if (!newSanctionUserId.trim() || !newSanctionReason.trim()) {
        setError("User ID and reason are required for a sanction.");
        return;
      }
      const created = await createSanction({
        userId: newSanctionUserId.trim(),
        reason: newSanctionReason.trim(),
        type: newSanctionType
      });
      setSanctions((prev) => [created, ...prev].slice(0, 50));
      setNewSanctionReason("");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to create sanction.";
      setError(message);
    }
  };

  const handleUpdateSanction = async (sanctionId: string, status: Sanction["status"]) => {
    try {
      const updated = await updateSanction(sanctionId, { status });
      setSanctions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to update sanction.";
      setError(message);
    }
  };

  if (authLoading) {
    return <div className="card">Loading admin console...</div>;
  }

  if (!user) {
    return <div className="card">Sign in required.</div>;
  }

  if (!user.roles.some((role) => role === "ADMIN" || role === "STAFF" || role === "MODER")) {
    return <div className="card">Access denied.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] space-y-6 px-6 pb-16 pt-8">
      <section className="section-header">
        <h2>Admin Console</h2>
        <p>Rulesets, seasons, sanctions, and audit logs for moderation workflow.</p>
      </section>

      {error ? <div className="card">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="meta-label">Queues configured</div>
          <div className="stat-value">{queuesCount}</div>
        </Card>
        <Card className="p-4">
          <div className="meta-label">Players waiting</div>
          <div className="stat-value">{waitingCount}</div>
        </Card>
        <Card className="p-4">
          <div className="meta-label">Open disputes</div>
          <div className="stat-value">{openDisputes}</div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <div className="card-header">
            <h3>Rulesets</h3>
            <Badge>{rulesets.length}</Badge>
          </div>
          <div className="space-y-3">
            {rulesets.map((ruleset) => (
              <div key={ruleset.id} className="rounded-lg border border-border bg-ika-900/40 p-3">
                <div className="row">
                  <div className="font-semibold text-ink-900">{ruleset.name}</div>
                  <Badge>{ruleset.leagueId}</Badge>
                </div>
                <div className="text-xs text-ink-500">{ruleset.id}</div>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={ruleset.requireVerifier ? "default" : "outline"}
                    onClick={() => handleToggleRulesetVerifier(ruleset)}
                    disabled={!isAdmin || loading}
                  >
                    {ruleset.requireVerifier ? "Verifier required" : "Verifier optional"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="card-header">
            <h3>Seasons</h3>
            <Badge>{seasons.length}</Badge>
          </div>
          <div className="space-y-3">
            {seasons.map((season) => (
              <div key={season.id} className="rounded-lg border border-border bg-ika-900/40 p-3">
                <div className="row">
                  <div className="font-semibold text-ink-900">{season.name}</div>
                  <Badge>{season.status}</Badge>
                </div>
                <div className="text-xs text-ink-500">{season.id}</div>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCycleSeasonStatus(season)}
                    disabled={!isAdmin || loading}
                  >
                    Cycle status
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <div className="card-header">
            <h3>Rank Bands</h3>
            <Badge>{rankBands.length}</Badge>
          </div>
          <textarea
            className="h-72 w-full rounded-md border border-border bg-ika-900/50 p-3 text-xs text-ink-900"
            value={rankBandsJson}
            onChange={(event) => setRankBandsJson(event.target.value)}
            spellCheck={false}
          />
          <div className="mt-3">
            <Button onClick={handleSaveRankBands} disabled={!isAdmin || loading}>
              Save rank bands
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="card-header">
            <h3>Issue Sanction</h3>
            <Badge>{sanctions.length} recent</Badge>
          </div>
          <div className="space-y-3">
            <Input
              value={newSanctionUserId}
              onChange={(event) => setNewSanctionUserId(event.target.value)}
              placeholder="Target user ID"
            />
            <Input
              value={newSanctionReason}
              onChange={(event) => setNewSanctionReason(event.target.value)}
              placeholder="Reason"
            />
            <select
              className="h-10 w-full rounded-md border border-border bg-ika-900/50 px-3 text-sm text-ink-900"
              value={newSanctionType}
              onChange={(event) => setNewSanctionType(event.target.value as Sanction["type"])}
            >
              <option value="WARNING">WARNING</option>
              <option value="TIME_BAN">TIME_BAN</option>
              <option value="SEASON_BAN">SEASON_BAN</option>
              <option value="ELO_ROLLBACK">ELO_ROLLBACK</option>
            </select>
            <Button onClick={handleCreateSanction} disabled={loading}>
              Create sanction
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {sanctions.slice(0, 6).map((sanction) => (
              <div key={sanction.id} className="rounded-lg border border-border bg-ika-900/40 p-2 text-xs">
                <div className="row">
                  <span>{sanction.userId}</span>
                  <div className="flex items-center gap-2">
                    <Badge>{sanction.type}</Badge>
                    <Badge>{sanction.status}</Badge>
                  </div>
                </div>
                <div className="text-ink-500">{sanction.reason}</div>
                {sanction.status === "ACTIVE" ? (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateSanction(sanction.id, "REVOKED")}
                    >
                      Revoke
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateSanction(sanction.id, "EXPIRED")}
                    >
                      Mark expired
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <Card className="p-4">
          <div className="card-header">
            <h3>Audit Log</h3>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {auditRows.slice(0, 20).map((event) => (
              <div key={event.id} className="rounded-lg border border-border bg-ika-900/40 p-3 text-xs">
                <div className="row">
                  <span className="font-semibold text-ink-900">{event.action}</span>
                  <Badge>{event.entityType}</Badge>
                </div>
                <div className="text-ink-500">
                  {event.actorUserId ?? "system"} - {new Date(event.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

