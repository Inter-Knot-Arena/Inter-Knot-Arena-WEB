import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { PlayerRosterView, PlayerAgentSource } from "@ika/shared";
import { fetchPlayerRoster, importRosterFromEnka } from "../api";
import { featureFlags } from "../flags";
import { ImportPanel } from "../components/roster/ImportPanel";
import { RosterGrid } from "../components/roster/RosterGrid";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { TooltipProvider } from "../components/ui/tooltip";

const regionOptions = ["NA", "EU", "ASIA", "SEA", "OTHER"];
const sourceOptions: Array<"ALL" | PlayerAgentSource> = [
  "ALL",
  "ENKA_SHOWCASE",
  "VERIFIER_OCR",
  "MANUAL"
];

export default function PlayerRoster() {
  const { uid } = useParams();
  const [roster, setRoster] = useState<PlayerRosterView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [attributeFilter, setAttributeFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [factionFilter, setFactionFilter] = useState("ALL");
  const [ownedFilter, setOwnedFilter] = useState<"ALL" | "OWNED" | "MISSING">("ALL");
  const [eligibilityFilter, setEligibilityFilter] = useState<"ALL" | "ELIGIBLE" | "INELIGIBLE">(
    "ALL"
  );
  const [sourceFilter, setSourceFilter] = useState<"ALL" | PlayerAgentSource>("ALL");
  const [region, setRegion] = useState("NA");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!featureFlags.enableAgentCatalog) {
      setLoading(false);
      return;
    }
    if (!uid) {
      setError("Missing UID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetchPlayerRoster({ uid, region })
      .then((data) => {
        setRoster(data);
      })
      .catch(() => {
        setError("Failed to load roster data.");
        setRoster(null);
      })
      .finally(() => setLoading(false));
  }, [uid, region]);

  const filters = useMemo(() => {
    if (!roster) {
      return { attributes: [], roles: [], factions: [] };
    }
    const attributes = new Set<string>();
    const roles = new Set<string>();
    const factions = new Set<string>();
    roster.agents.forEach((item) => {
      attributes.add(item.agent.attribute);
      roles.add(item.agent.role);
      factions.add(item.agent.faction);
    });
    return {
      attributes: ["ALL", ...attributes],
      roles: ["ALL", ...roles],
      factions: ["ALL", ...factions]
    };
  }, [roster]);

  const totalAgentsSaved = useMemo(() => {
    if (!roster) {
      return undefined;
    }
    return roster.agents.filter((item) => item.state?.owned).length;
  }, [roster]);

  const missingAgents = useMemo(() => {
    if (!roster) {
      return [];
    }
    return roster.agents
      .filter((item) => !item.state?.owned)
      .map((item) => item.agent.name)
      .sort((a, b) => a.localeCompare(b));
  }, [roster]);

  const filteredItems = useMemo(() => {
    if (!roster) {
      return [];
    }
    return roster.agents.filter((item) => {
      const nameMatch = item.agent.name.toLowerCase().includes(search.trim().toLowerCase());
      const attributeMatch = attributeFilter === "ALL" || item.agent.attribute === attributeFilter;
      const roleMatch = roleFilter === "ALL" || item.agent.role === roleFilter;
      const factionMatch = factionFilter === "ALL" || item.agent.faction === factionFilter;
      const owned = item.state?.owned ?? false;
      const ownedMatch =
        ownedFilter === "ALL" ||
        (ownedFilter === "OWNED" && owned) ||
        (ownedFilter === "MISSING" && !owned);
      const eligibilityMatch =
        eligibilityFilter === "ALL" ||
        (eligibilityFilter === "ELIGIBLE" && item.eligibility.draftEligible) ||
        (eligibilityFilter === "INELIGIBLE" && !item.eligibility.draftEligible);
      const sourceMatch =
        sourceFilter === "ALL" || (item.state?.source ?? "MANUAL") === sourceFilter;
      return (
        nameMatch &&
        attributeMatch &&
        roleMatch &&
        factionMatch &&
        ownedMatch &&
        eligibilityMatch &&
        sourceMatch
      );
    });
  }, [
    roster,
    search,
    attributeFilter,
    roleFilter,
    factionFilter,
    ownedFilter,
    eligibilityFilter,
    sourceFilter
  ]);

  const handleImport = async () => {
    if (!uid) {
      return;
    }
    setImporting(true);
    try {
      await importRosterFromEnka({ uid, region });
      const updated = await fetchPlayerRoster({ uid, region });
      setRoster(updated);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Import failed. Check ENKA_BASE_URL and try again.";
      setError(message);
    } finally {
      setImporting(false);
    }
  };

  if (!featureFlags.enableAgentCatalog) {
    return (
      <div className="card">
        Agent catalog is disabled. Enable `VITE_ENABLE_AGENT_CATALOG=true` to use roster view.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-[1400px] px-6 pb-16 pt-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Player roster</div>
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
              onChange={(event) => setRegion(event.target.value)}
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
          enabled={featureFlags.enableEnkaImport}
          isImporting={importing}
          region={region}
          lastImport={roster?.lastImport}
          totalAgentsSaved={totalAgentsSaved}
          missingAgents={missingAgents}
          onImport={handleImport}
        />

        <div className="mt-6 grid gap-3 rounded-xl border border-border bg-ika-800/70 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search agent"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full md:w-72"
            />
            <select
              className="rounded-md border border-border bg-ika-900/40 px-3 py-2 text-sm text-ink-700"
              value={attributeFilter}
              onChange={(event) => setAttributeFilter(event.target.value)}
            >
              {filters.attributes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-border bg-ika-900/40 px-3 py-2 text-sm text-ink-700"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              {filters.roles.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-border bg-ika-900/40 px-3 py-2 text-sm text-ink-700"
              value={factionFilter}
              onChange={(event) => setFactionFilter(event.target.value)}
            >
              {filters.factions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={ownedFilter === "ALL" ? "default" : "outline"}
              size="sm"
              onClick={() => setOwnedFilter("ALL")}
            >
              All
            </Button>
            <Button
              variant={ownedFilter === "OWNED" ? "default" : "outline"}
              size="sm"
              onClick={() => setOwnedFilter("OWNED")}
            >
              Owned
            </Button>
            <Button
              variant={ownedFilter === "MISSING" ? "default" : "outline"}
              size="sm"
              onClick={() => setOwnedFilter("MISSING")}
            >
              Missing
            </Button>
            <Button
              variant={eligibilityFilter === "ELIGIBLE" ? "default" : "outline"}
              size="sm"
              onClick={() => setEligibilityFilter("ELIGIBLE")}
            >
              Draft-eligible
            </Button>
            <Button
              variant={eligibilityFilter === "INELIGIBLE" ? "default" : "outline"}
              size="sm"
              onClick={() => setEligibilityFilter("INELIGIBLE")}
            >
              Not eligible
            </Button>
            {sourceOptions.map((option) => (
              <Button
                key={option}
                variant={sourceFilter === option ? "default" : "outline"}
                size="sm"
                onClick={() => setSourceFilter(option)}
              >
                {option === "ALL" ? "All sources" : option}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-36" />
              ))}
            </div>
          ) : roster && filteredItems.length ? (
            <RosterGrid items={filteredItems} />
          ) : (
            <div className="rounded-xl border border-border bg-ika-800/70 p-6 text-sm text-ink-500">
              No roster entries found. Import from Enka showcase or adjust filters.
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
