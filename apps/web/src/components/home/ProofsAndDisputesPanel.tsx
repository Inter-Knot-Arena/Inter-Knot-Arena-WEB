import { Link } from "react-router-dom";
import { AlertTriangle, FileCheck, Gavel } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

interface ProofsAndDisputesPanelProps {
  proofsPending: number;
  disputesOpen: number;
  decisions: number;
}

export function ProofsAndDisputesPanel({
  proofsPending,
  disputesOpen,
  decisions
}: ProofsAndDisputesPanelProps) {
  return (
    <Card className="flex h-full flex-col gap-5 p-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Disputes & proofs</div>
        <div className="text-sm text-ink-700">Active compliance checks</div>
      </div>
      <div className="grid gap-3 text-sm text-ink-700">
        <div className="flex items-center justify-between rounded-lg border border-border bg-ika-700/30 px-4 py-3">
          <span className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-ink-500" />
            Proofs pending
          </span>
          <span className="font-semibold text-ink-900">{proofsPending}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-ika-700/30 px-4 py-3">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-ink-500" />
            Disputes open
          </span>
          <span className="font-semibold text-ink-900">{disputesOpen}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-ika-700/30 px-4 py-3">
          <span className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-ink-500" />
            Moderator decisions
          </span>
          <span className="font-semibold text-ink-900">{decisions}</span>
        </div>
      </div>
      <div className="mt-auto grid gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/matchmaking">Upload proof</Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link to="/disputes">Open dispute</Link>
        </Button>
        <Link className="text-xs text-ink-500" to="/rulesets">
          How proofs work
        </Link>
      </div>
    </Card>
  );
}
