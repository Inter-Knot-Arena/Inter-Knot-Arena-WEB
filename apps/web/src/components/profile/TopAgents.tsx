import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ReTooltip } from "recharts";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export interface AgentUsage {
  name: string;
  matches: number;
  winrate: number;
  role: string;
  share: number;
}

interface TopAgentsProps {
  agents: AgentUsage[];
}

const COLORS = ["#f2a65a", "#6bb6c5", "#e36b3a"];

export function TopAgents({ agents }: TopAgentsProps) {
  return (
    <Card className="border-border bg-ika-800/70">
      <CardHeader>
        <CardTitle className="text-lg font-sans text-ink-900">Top agents</CardTitle>
        <p className="text-sm text-ink-500">Most played agents this season.</p>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="grid gap-3">
          {agents.map((agent) => (
            <div
              key={agent.name}
              className="flex items-center justify-between rounded-lg border border-border bg-ika-700/40 px-4 py-3"
            >
              <div>
                <div className="text-sm font-semibold text-ink-900">{agent.name}</div>
                <div className="text-xs text-ink-500">{agent.matches} matches</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-ika-700/70 text-ink-700">{agent.role}</Badge>
                <div className="text-sm font-semibold text-ink-900">{agent.winrate}% WR</div>
              </div>
            </div>
          ))}
        </div>
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={agents}
                dataKey="share"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
              >
                {agents.map((agent, index) => (
                  <Cell key={`cell-${agent.name}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <ReTooltip
                contentStyle={{
                  background: "#111720",
                  border: "1px solid rgba(242, 244, 247, 0.08)",
                  borderRadius: 10,
                  color: "#f2f4f7",
                  fontSize: 12
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-between text-xs text-ink-500">
            <span>Usage share</span>
            <span>Top {agents.length}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
