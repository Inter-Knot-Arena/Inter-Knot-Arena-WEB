import { AlertTriangle, CheckCircle2, Eye, Info } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export interface EvidenceItem {
  id: string;
  match: string;
  type: string;
  date: string;
  status: "Stored" | "Expiring" | "Requested";
  retention: string;
}

interface EvidencePanelProps {
  verifierRequired: string[];
  lastPrecheck: string;
  inrunViolations: number;
  evidenceItems: EvidenceItem[];
  retentionInfo: string;
}

export function EvidencePanel({
  verifierRequired,
  lastPrecheck,
  inrunViolations,
  evidenceItems,
  retentionInfo
}: EvidencePanelProps) {
  return (
    <Card className="border-border bg-ika-800/70">
      <CardHeader>
        <CardTitle className="text-lg font-sans text-ink-900">Evidence and verifier</CardTitle>
        <p className="text-sm text-ink-500">Verifier checks and stored proof artifacts.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-ika-700/40 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-500">
              <Eye className="h-4 w-4" />
              Verifier required
            </div>
            <div className="mt-2 text-sm font-semibold text-ink-900">
              {verifierRequired.join(" and ")} ranked
            </div>
            <p className="text-xs text-ink-500">Standard and F2P queues enforce pre-check.</p>
          </div>
          <div className="rounded-lg border border-border bg-ika-700/40 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-500">
              <CheckCircle2 className="h-4 w-4" />
              Last pre-check
            </div>
            <div className="mt-2 text-sm font-semibold text-ink-900">PASS</div>
            <p className="text-xs text-ink-500">{lastPrecheck}</p>
          </div>
          <div className="rounded-lg border border-border bg-ika-700/40 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-500">
              <AlertTriangle className="h-4 w-4" />
              In-run checks
            </div>
            <div className="mt-2 text-sm font-semibold text-ink-900">{inrunViolations} violations</div>
            <p className="text-xs text-ink-500">No auto-loss flags this season.</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-ika-700/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-500">
                Evidence vault
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900"
                      aria-label="Retention policy"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{retentionInfo}</TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-1 text-sm text-ink-900">Stored evidence list</div>
            </div>
            <Button variant="outline" size="sm" type="button">
              Request deletion
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {evidenceItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-ika-800/60 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-semibold text-ink-900">{item.type}</div>
                  <div className="text-xs text-ink-500">{item.match} - {item.date}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs text-ink-500">Retention: {item.retention}</div>
                  <Badge
                    className={
                      item.status === "Stored"
                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : item.status === "Expiring"
                        ? "border border-amber-500/30 bg-amber-500/10 text-amber-200"
                        : "border border-rose-500/30 bg-rose-500/10 text-rose-300"
                    }
                  >
                    {item.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
