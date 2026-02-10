import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

export interface AgentItem {
  id: string;
  name: string;
  element: string;
  faction: string;
  role: string;
  owned: boolean;
  verified: boolean;
  draftEligible: boolean;
  rankedUsage: number;
}

interface AgentGridProps {
  agents: AgentItem[];
}

export function AgentGrid({ agents }: AgentGridProps) {
  const [search, setSearch] = useState("");
  const [element, setElement] = useState("all");
  const [faction, setFaction] = useState("all");
  const [role, setRole] = useState("all");

  const elements = useMemo(() => Array.from(new Set(agents.map((agent) => agent.element))), [agents]);
  const factions = useMemo(() => Array.from(new Set(agents.map((agent) => agent.faction))), [agents]);
  const roles = useMemo(() => Array.from(new Set(agents.map((agent) => agent.role))), [agents]);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (element !== "all" && agent.element !== element) {
        return false;
      }
      if (faction !== "all" && agent.faction !== faction) {
        return false;
      }
      if (role !== "all" && agent.role !== role) {
        return false;
      }
      if (search && !agent.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [agents, element, faction, role, search]);

  const selectClass =
    "h-10 w-full rounded-md border border-border bg-ika-800/70 px-3 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500";

  return (
    <Card className="border-border bg-ika-800/70">
      <CardHeader>
        <CardTitle className="text-lg font-sans text-ink-900">Roster</CardTitle>
        <p className="text-sm text-ink-500">Filter roster eligibility and ranked usage.</p>
      </CardHeader>
      <CardContent className="space-y-4 overflow-hidden">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search agent"
              className="pl-9"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-ink-500">Element</label>
            <select className={selectClass} value={element} onChange={(event) => setElement(event.target.value)}>
              <option value="all">All elements</option>
              {elements.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-ink-500">Faction</label>
            <select className={selectClass} value={faction} onChange={(event) => setFaction(event.target.value)}>
              <option value="all">All factions</option>
              {factions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-ink-500">Role</label>
            <select className={selectClass} value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="all">All roles</option>
              {roles.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredAgents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-ika-700/20 p-6 text-sm text-ink-500">
            No agents match the selected filters.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredAgents.map((agent) => (
              <div key={agent.id} className="flex h-full flex-col rounded-xl border border-border bg-ika-800/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-ink-900">{agent.name}</div>
                  <Badge className="bg-ika-700/70 text-ink-700">{agent.role}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-500">
                  <span className="rounded-full border border-border px-2 py-0.5">{agent.element}</span>
                  <span className="rounded-full border border-border px-2 py-0.5">{agent.faction}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge
                    className={
                      agent.owned
                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border border-border bg-ika-700/60 text-ink-500"
                    }
                  >
                    {agent.owned ? "Owned" : "Not owned"}
                  </Badge>
                  {agent.verified && (
                    <Badge className="border border-cool-400/30 bg-cool-500/10 text-cool-300">Verified</Badge>
                  )}
                  {agent.draftEligible && (
                    <Badge className="border border-accent-500/30 bg-accent-500/10 text-accent-400">
                      Draft-eligible
                    </Badge>
                  )}
                </div>
                <div className="mt-auto pt-3 text-xs text-ink-500">
                  Used in ranked: <span className="font-semibold text-ink-900">{agent.rankedUsage}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
