import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { AgentStatic, PlayerRosterView, Region } from "@ika/shared";
import { fetchAgentCatalog, fetchPlayerRoster } from "../api";
import { featureFlags } from "../flags";
import { useAuth } from "../auth/AuthProvider";
import { ImportPanel } from "../components/roster/ImportPanel";
import { RosterGrid } from "../components/roster/RosterGrid";
import { getFullMindscapeUrl } from "../components/roster/mindscape";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { RarityIcon } from "../components/RarityIcon";
import { Skeleton } from "../components/ui/skeleton";
import { TooltipProvider } from "../components/ui/tooltip";

const regionOptions: Region[] = ["NA", "EU", "ASIA", "SEA", "OTHER"];
const spotlightAgentIds = new Set([
  "agent_ellen",
  "agent_miyabi",
  "agent_zhu_yuan",
  "agent_anby",
  "agent_nicole",
  "agent_lycaon"
]);

const safetyNotes = [
  "No game password required",
  "Read-only visible roster scan",
  "No shop, pull, or currency actions"
];

function normalizeRegion(value: unknown): Region {
  if (typeof value === "string" && regionOptions.includes(value as Region)) {
    return value as Region;
  }
  return "OTHER";
}

function PublicAgentCard({ agent }: { agent: AgentStatic }) {
  const mindscapeUrl = getFullMindscapeUrl(agent.agentId);

  return (
    <article className="agent-dossier-card">
      <div className="agent-dossier-visual">
        {mindscapeUrl ? (
          <img src={mindscapeUrl} alt="" aria-hidden />
        ) : (
          <div className="agent-dossier-fallback">{agent.name.slice(0, 2).toUpperCase()}</div>
        )}
        <div className="agent-dossier-scanline" />
      </div>
      <div className="agent-dossier-body">
        <div className="agent-dossier-topline">
          <span>{agent.attribute}</span>
          <RarityIcon rarity={agent.rarity} className="h-6 w-6 object-contain" />
        </div>
        <h3>{agent.name}</h3>
        <p>{agent.shortDescription ?? `${agent.faction} ${agent.role.toLowerCase()} agent.`}</p>
        <div className="agent-dossier-tags">
          <span>{agent.role}</span>
          <span>{agent.attackType}</span>
          <span>{agent.faction}</span>
        </div>
      </div>
    </article>
  );
}

function PublicAgentCatalog({
  agents,
  loading,
  catalogError,
  userHasUid,
  isSignedIn
}: {
  agents: AgentStatic[];
  loading: boolean;
  catalogError: string | null;
  userHasUid: boolean;
  isSignedIn: boolean;
}) {
  const [search, setSearch] = useState("");
  const [attributeFilter, setAttributeFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const attributes = useMemo(() => {
    return ["ALL", ...Array.from(new Set(agents.map((agent) => agent.attribute))).sort()];
  }, [agents]);

  const roles = useMemo(() => {
    return ["ALL", ...Array.from(new Set(agents.map((agent) => agent.role))).sort()];
  }, [agents]);

  const filteredAgents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return agents.filter((agent) => {
      if (attributeFilter !== "ALL" && agent.attribute !== attributeFilter) {
        return false;
      }
      if (roleFilter !== "ALL" && agent.role !== roleFilter) {
        return false;
      }
      if (query && !agent.name.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [agents, attributeFilter, roleFilter, search]);

  const spotlightAgents = useMemo(() => {
    const preferred = filteredAgents.filter((agent) => spotlightAgentIds.has(agent.agentId));
    return (preferred.length ? preferred : filteredAgents).slice(0, 6);
  }, [filteredAgents]);

  const primaryCta = isSignedIn
    ? { label: "Start verifier sync", to: "/uid-verify" }
    : { label: "Sign in to sync roster", to: "/signin" };

  return (
    <div className="agent-public-page">
      <section className="agent-public-hero">
        <div>
          <div className="eyebrow">Agent dossier // public catalog</div>
          <h1>{userHasUid ? "Roster intelligence" : "Build your verified ZZZ roster"}</h1>
          <p>
            Browse the competitive agent catalog, then connect Verifier to turn this public dossier
            into your owned, match-ready roster.
          </p>
          <div className="agent-public-actions">
            <Button asChild>
              <Link to={primaryCta.to}>{primaryCta.label}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/rulesets">View rulesets</Link>
            </Button>
          </div>
        </div>

        <div className="agent-safety-panel" aria-label="Verifier safety notes">
          <div className="agent-safety-title">Verifier safety lock</div>
          {safetyNotes.map((note) => (
            <div key={note} className="agent-safety-row">
              <span />
              {note}
            </div>
          ))}
        </div>
      </section>

      <section className="agent-catalog-console">
        <div className="agent-console-header">
          <div>
            <div className="eyebrow">Catalog console</div>
            <h2>Draft-ready agents</h2>
            <p>{agents.length} catalog entries available for roster sync and ruleset checks.</p>
          </div>
          <Input
            placeholder="Search agent"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full md:w-72"
          />
        </div>

        <div className="agent-filter-bank">
          <div>
            <span>Attribute</span>
            <div>
              {attributes.map((attribute) => (
                <button
                  key={attribute}
                  type="button"
                  className={attributeFilter === attribute ? "is-active" : undefined}
                  onClick={() => setAttributeFilter(attribute)}
                >
                  {attribute}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span>Role</span>
            <div>
              {roles.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={roleFilter === role ? "is-active" : undefined}
                  onClick={() => setRoleFilter(role)}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>

        {catalogError ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            {catalogError}
          </div>
        ) : null}

        {loading ? (
          <div className="agent-dossier-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-72" />
            ))}
          </div>
        ) : spotlightAgents.length ? (
          <div className="agent-dossier-grid">
            {spotlightAgents.map((agent) => (
              <PublicAgentCard key={agent.agentId} agent={agent} />
            ))}
          </div>
        ) : (
          <div className="agent-empty-state">
            No agents match these filters. Clear search or switch attribute/role filters.
          </div>
        )}
      </section>
    </div>
  );
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
  const [catalogAgents, setCatalogAgents] = useState<AgentStatic[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    if (!featureFlags.enableAgentCatalog) {
      setCatalogLoading(false);
      return;
    }

    setCatalogLoading(true);
    setCatalogError(null);
    fetchAgentCatalog()
      .then((catalog) => setCatalogAgents(catalog.agents))
      .catch(() => {
        setCatalogAgents([]);
        setCatalogError("Failed to load public agent catalog.");
      })
      .finally(() => setCatalogLoading(false));
  }, []);

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
      <PublicAgentCatalog
        agents={catalogAgents}
        loading={catalogLoading}
        catalogError={catalogError}
        userHasUid={false}
        isSignedIn={false}
      />
    );
  }

  if (!uid) {
    return (
      <PublicAgentCatalog
        agents={catalogAgents}
        loading={catalogLoading}
        catalogError={catalogError}
        userHasUid={false}
        isSignedIn
      />
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

