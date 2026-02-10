import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export interface CatalogAgent {
  id: string;
  name: string;
  attribute: string;
  role: string;
}

export interface RulesetPreview {
  id: string;
  name: string;
  league: string;
  status: "Strict" | "Open";
}

interface CatalogPreviewGridProps {
  agents: CatalogAgent[];
  rulesets: RulesetPreview[];
}

export function CatalogPreviewGrid({ agents, rulesets }: CatalogPreviewGridProps) {
  const [attributeFilter, setAttributeFilter] = useState<string>("All");
  const [roleFilter, setRoleFilter] = useState<string>("All");

  const attributes = useMemo(() => {
    return ["All", ...Array.from(new Set(agents.map((agent) => agent.attribute)))];
  }, [agents]);

  const roles = useMemo(() => {
    return ["All", ...Array.from(new Set(agents.map((agent) => agent.role)))];
  }, [agents]);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (attributeFilter !== "All" && agent.attribute !== attributeFilter) {
        return false;
      }
      if (roleFilter !== "All" && agent.role !== roleFilter) {
        return false;
      }
      return true;
    });
  }, [agents, attributeFilter, roleFilter]);

  return (
    <Card className="p-6">
      <div className="grid gap-8 lg:grid-cols-[1.15fr,0.85fr]">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Catalog preview</div>
              <div className="text-sm text-ink-700">Draft-ready agents snapshot</div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/agents">Open agent catalog</Link>
            </Button>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap gap-3">
              {attributes.map((attr) => (
                <button
                  key={attr}
                  type="button"
                  onClick={() => setAttributeFilter(attr)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    attributeFilter === attr
                      ? "border-accent-400 bg-accent-500/20 text-ink-900"
                      : "border-border text-ink-500 hover:border-accent-400"
                  }`}
                >
                  {attr}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {roles.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRoleFilter(role)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    roleFilter === role
                      ? "border-accent-400 bg-accent-500/20 text-ink-900"
                      : "border-border text-ink-500 hover:border-accent-400"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.length ? (
              filteredAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-lg border border-border bg-ika-700/30 px-3 py-2 text-sm"
                >
                  <div className="font-semibold text-ink-900">{agent.name}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-500">
                    <span>{agent.attribute}</span>
                    <span>·</span>
                    <span>{agent.role}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full rounded-lg border border-border bg-ika-700/30 p-3 text-sm text-ink-500">
                No agents match the selected filters.
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Ruleset preview</div>
          <div className="mt-4 space-y-3">
            {rulesets.map((rule) => (
              <div
                key={rule.id}
                className="rounded-lg border border-border bg-ika-700/30 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-ink-900">{rule.name}</div>
                  <Badge
                    className={
                      rule.status === "Strict"
                        ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                        : "border border-border bg-ika-700/70 text-ink-700"
                    }
                  >
                    {rule.status}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-ink-500">{rule.league}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
