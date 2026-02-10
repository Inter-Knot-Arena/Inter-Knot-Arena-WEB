import { Link } from "react-router-dom";
import { Bell, GitBranch, Wrench } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";

export interface UpdateItem {
  id: string;
  title: string;
  summary: string;
  type: "moderation" | "ruleset" | "season";
  date: string;
}

interface UpdatesFeedProps {
  items: UpdateItem[];
  variant?: "card" | "plain";
}

const iconMap: Record<UpdateItem["type"], JSX.Element> = {
  moderation: <Wrench className="h-4 w-4" />,
  ruleset: <GitBranch className="h-4 w-4" />,
  season: <Bell className="h-4 w-4" />
};

export function UpdatesFeed({ items, variant = "card" }: UpdatesFeedProps) {
  const containerClass =
    variant === "plain"
      ? "rounded-xl border border-border bg-transparent p-6"
      : "p-6";

  const Container = variant === "plain" ? "div" : Card;

  return (
    <Container className={cn(containerClass)}>
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-ink-500">What&apos;s new</div>
          <div className="text-sm text-ink-700">Latest platform updates</div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/rulesets">All updates</Link>
        </Button>
      </div>
      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-4 rounded-lg border border-border bg-ika-700/30 p-4">
            <div className="rounded-full border border-border bg-ika-800/70 p-2 text-ink-700">
              {iconMap[item.type]}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-ink-900">{item.title}</div>
                <span className="text-xs text-ink-500">{item.date}</span>
              </div>
              <p className="mt-1 text-sm text-ink-500">{item.summary}</p>
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
