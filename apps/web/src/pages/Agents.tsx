import { useEffect, useMemo, useState } from "react";
import type { PlayerRosterView, Region } from "@ika/shared";
import { fetchPlayerRoster } from "../api";
import { featureFlags } from "../flags";
import { useAuth } from "../auth/AuthProvider";
import { ImportPanel } from "../components/roster/ImportPanel";
import { RosterGrid } from "../components/roster/RosterGrid";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { TooltipProvider } from "../components/ui/tooltip";

const regionOptions: Region[] = ["NA", "EU", "ASIA", "SEA", "OTHER"];

function normalizeRegion(value: unknown): Region {
  if (typeof value === "string" && regionOptions.includes(value as Region)) {
    return value as Region;
  }
  return "OTHER";
}

export default function Agents() {
  const { user, isLoading: authLoading } = useAuth();
  const uid = user?.verification?.uid;
  const [region, setRegion] = useState<Region>(
    normalizeRegion(user?.verification?.region ?? user?.region ?? "OTHER")
  );
  const [roster, setRoster] = useState<PlayerRosterView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchOwned, setSearchOwned] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!featureFlags.enableAgentCatalog) {
      setLoading(false);
      return;
    }
    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetchPlayerRoster({ uid, region })
      .then((data) => setRoster(data))
      .catch(() => {
        setError("Failed to load your agent roster.");
        setRoster(null);
      })
      .finally(() => setLoading(false));
  }, [uid, region]);

  const ownedAgents = useMemo(() => {
    if (!roster) {
      return [];
    }
    return roster.agents.filter((item) => {
      const owned = item.state?.owned ?? false;
      if (!owned) {
        return false;
      }
      return item.agent.name.toLowerCase().includes(searchOwned.trim().toLowerCase());
    });
  }, [roster, searchOwned]);

  const totalAgentsSaved = useMemo(() => {
    if (!roster) {
      return undefined;
    }
    return roster.agents.filter((item) => item.state?.owned).length;
  }, [roster]);

  const missingNames = useMemo(() => {
    if (!roster) {
      return [];
    }
    return roster.agents
      .filter((item) => !item.state?.owned)
      .map((item) => item.agent.name)
      .sort((a, b) => a.localeCompare(b));
  }, [roster]);

  const handleRefresh = async () => {
    if (!uid) {
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      const updated = await fetchPlayerRoster({ uid, region });
      setRoster(updated);
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : "Refresh failed.";
      setError(message);
    } finally {
      setRefreshing(false);
    }
  };

  if (!featureFlags.enableAgentCatalog) {
    return (
      <div className="card">
        Agent catalog is disabled. Enable `VITE_ENABLE_AGENT_CATALOG=true` to use roster view.
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-6 pb-16 pt-8">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-[1100px] px-6 pb-16 pt-8">
        <div className="rounded-xl border border-border bg-ika-800/70 p-6">
          <div className="text-lg font-semibold text-ink-900">My Agents</div>
          <p className="mt-2 text-sm text-ink-500">
            Sign in to view your Verifier-synced roster.
          </p>
          <Button className="mt-4" asChild>
            <a href="/signin">Sign in</a>
          </Button>
        </div>
      </div>
    );
  }

  if (!uid) {
    return (
      <div className="mx-auto w-full max-w-[1100px] px-6 pb-16 pt-8">
        <div className="rounded-xl border border-border bg-ika-800/70 p-6">
          <div className="text-lg font-semibold text-ink-900">My Agents</div>
          <p className="mt-2 text-sm text-ink-500">
            Complete Verifier OCR full-scan to link UID and roster.
          </p>
          <Button className="mt-4" asChild>
            <a href="/uid-verify">Open Verifier setup</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-[1400px] px-6 pb-16 pt-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-ink-500">My Agents</div>
            <h1 className="text-2xl font-display text-ink-900">UID {uid}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className="border border-border bg-ika-700/60 text-ink-700">
                Catalog {roster?.catalogVersion ?? "v1.0"}
              </Badge>
              <Badge className="border border-border bg-ika-700/60 text-ink-700">Region {region}</Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-ink-500">
            <span>Region</span>
            <select
              className="rounded-md border border-border bg-ika-900/40 px-3 py-2 text-sm text-ink-700"
              value={region}
              onChange={(event) => setRegion(normalizeRegion(event.target.value))}
            >
              {regionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <ImportPanel
          enabled={featureFlags.enableVerifierRosterImport}
          isRefreshing={refreshing}
          region={region}
          lastImport={roster?.lastImport}
          totalAgentsSaved={totalAgentsSaved}
          missingAgents={missingNames}
          onRefresh={handleRefresh}
        />

        <div className="mt-6 rounded-xl border border-border bg-ika-800/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-ink-900">Current roster</div>
              <div className="text-xs text-ink-500">Owned agents: {totalAgentsSaved ?? 0}</div>
            </div>
            <Input
              placeholder="Search by name"
              value={searchOwned}
              onChange={(event) => setSearchOwned(event.target.value)}
              className="w-full md:w-72"
            />
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-36" />
              ))}
            </div>
          ) : ownedAgents.length ? (
            <RosterGrid items={ownedAgents} />
          ) : (
            <div className="rounded-xl border border-border bg-ika-800/70 p-6 text-sm text-ink-500">
              No agents in roster yet. Run Verifier OCR sync and refresh this page.
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

