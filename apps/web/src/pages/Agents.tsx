import { useEffect, useMemo, useState } from "react";
import type { Agent, AgentCatalog, AgentStatic } from "@ika/shared";
import { fetchAgentCatalog, fetchAgents } from "../api";
import { featureFlags } from "../flags";
import { AgentCard } from "../components/catalog/AgentCard";
import { Input } from "../components/ui/input";

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [catalog, setCatalog] = useState<AgentCatalog | null>(null);
  const [elementFilter, setElementFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [attributeFilter, setAttributeFilter] = useState("ALL");
  const [factionFilter, setFactionFilter] = useState("ALL");
  const [catalogRoleFilter, setCatalogRoleFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (featureFlags.enableAgentCatalog) {
      fetchAgentCatalog().then(setCatalog);
    } else {
      fetchAgents().then(setAgents);
    }
  }, []);

  const elements = useMemo(() => {
    return ["All", ...new Set(agents.map((agent) => agent.element))];
  }, [agents]);

  const roles = useMemo(() => {
    return ["All", ...new Set(agents.map((agent) => agent.role))];
  }, [agents]);

  const catalogFilters = useMemo(() => {
    if (!catalog) {
      return { attributes: ["ALL"], factions: ["ALL"], roles: ["ALL"] };
    }
    const attributes = new Set<string>();
    const factions = new Set<string>();
    const roles = new Set<string>();
    catalog.agents.forEach((agent) => {
      attributes.add(agent.attribute);
      factions.add(agent.faction);
      roles.add(agent.role);
    });
    return {
      attributes: ["ALL", ...attributes],
      factions: ["ALL", ...factions],
      roles: ["ALL", ...roles]
    };
  }, [catalog]);

  const filtered = agents.filter((agent) => {
    const elementOk = elementFilter === "All" || agent.element === elementFilter;
    const roleOk = roleFilter === "All" || agent.role === roleFilter;
    return elementOk && roleOk;
  });

  const filteredCatalog = useMemo(() => {
    if (!catalog) {
      return [];
    }
    return catalog.agents.filter((agent: AgentStatic) => {
      const nameMatch = agent.name.toLowerCase().includes(search.trim().toLowerCase());
      const attributeMatch = attributeFilter === "ALL" || agent.attribute === attributeFilter;
      const roleMatch = catalogRoleFilter === "ALL" || agent.role === catalogRoleFilter;
      const factionMatch = factionFilter === "ALL" || agent.faction === factionFilter;
      return nameMatch && attributeMatch && roleMatch && factionMatch;
    });
  }, [catalog, search, attributeFilter, catalogRoleFilter, factionFilter]);

  if (featureFlags.enableAgentCatalog) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-6 pb-16 pt-8">
        <section className="mb-6">
          <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Agent catalog</div>
          <h2 className="text-2xl font-display text-ink-900">Static roster reference</h2>
          <p className="mt-2 text-sm text-ink-500">
            Catalog version {catalog?.catalogVersion ?? "v1.0"}.
          </p>
        </section>

        <div className="grid gap-3 rounded-xl border border-border bg-ika-800/70 p-4">
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
              {catalogFilters.attributes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-border bg-ika-900/40 px-3 py-2 text-sm text-ink-700"
              value={catalogRoleFilter}
              onChange={(event) => setCatalogRoleFilter(event.target.value)}
            >
              {catalogFilters.roles.map((option) => (
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
              {catalogFilters.factions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCatalog.map((agent) => (
            <AgentCard key={agent.agentId} agent={agent} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="section-header">
        <h2>Agents Catalog</h2>
        <p>Competitive roster reference for drafts and rulesets.</p>
      </section>

      <div className="filters">
        <label>
          Element
          <select value={elementFilter} onChange={(event) => setElementFilter(event.target.value)}>
            {elements.map((element) => (
              <option key={element} value={element}>
                {element}
              </option>
            ))}
          </select>
        </label>
        <label>
          Role
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid">
        {filtered.map((agent) => (
          <div key={agent.id} className="card">
            <div className="card-header">
              <h3>{agent.name}</h3>
              <span className="badge-outline">{agent.role}</span>
            </div>
            <div className="chip-row">
              <span className="tag">{agent.element}</span>
              <span className="tag">{agent.faction}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
