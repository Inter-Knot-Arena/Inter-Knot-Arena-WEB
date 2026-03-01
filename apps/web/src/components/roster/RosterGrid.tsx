import type { PlayerRosterView } from "@ika/shared";
import { PlayerAgentCard } from "./PlayerAgentCard";

interface RosterGridProps {
  items: PlayerRosterView["agents"];
}

export function RosterGrid({ items }: RosterGridProps) {
  return (
    <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
      {items.map((item) => (
        <PlayerAgentCard
          key={item.agent.agentId}
          agent={item.agent}
          state={item.state}
          eligibility={item.eligibility}
        />
      ))}
    </div>
  );
}
