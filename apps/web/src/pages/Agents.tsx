import { useEffect, useMemo, useState } from "react";
import type { Agent } from "@ika/shared";
import { fetchAgents } from "../api";

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [elementFilter, setElementFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");

  useEffect(() => {
    fetchAgents().then(setAgents);
  }, []);

  const elements = useMemo(() => {
    return ["All", ...new Set(agents.map((agent) => agent.element))];
  }, [agents]);

  const roles = useMemo(() => {
    return ["All", ...new Set(agents.map((agent) => agent.role))];
  }, [agents]);

  const filtered = agents.filter((agent) => {
    const elementOk = elementFilter === "All" || agent.element === elementFilter;
    const roleOk = roleFilter === "All" || agent.role === roleFilter;
    return elementOk && roleOk;
  });

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
