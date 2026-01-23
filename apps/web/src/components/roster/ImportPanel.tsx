import type { PlayerRosterImportSummary } from "@ika/shared";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface ImportPanelProps {
  enabled: boolean;
  isImporting: boolean;
  region: string;
  lastImport?: PlayerRosterImportSummary;
  totalAgentsSaved?: number;
  missingAgents?: string[];
  onImport: (force?: boolean) => void;
}

export function ImportPanel({
  enabled,
  isImporting,
  region,
  lastImport,
  totalAgentsSaved,
  missingAgents,
  onImport
}: ImportPanelProps) {
  return (
    <div className="rounded-xl border border-border bg-ika-800/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink-900">Showcase import</div>
          <p className="text-xs text-ink-500">
            Pull roster data from Enka.Network showcase (region {region}).
          </p>
        </div>
        {enabled ? (
          <Button onClick={() => onImport(false)} disabled={isImporting}>
            {isImporting ? "Importing..." : "Import from Showcase"}
          </Button>
        ) : null}
      </div>

      {!enabled ? (
        <p className="mt-3 text-xs text-ink-500">Enka import is disabled for this environment.</p>
      ) : null}

      {lastImport ? (
        <div className="mt-3 rounded-lg border border-border bg-ika-900/40 p-3 text-xs text-ink-500">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border border-border bg-ika-700/60 text-ink-700">{lastImport.source}</Badge>
            <span>Imported: {lastImport.importedCount}</span>
            <span>Skipped: {lastImport.skippedCount}</span>
            {lastImport.newAgentsCount !== undefined ? (
              <span>New: {lastImport.newAgentsCount}</span>
            ) : null}
            {lastImport.updatedAgentsCount !== undefined ? (
              <span>Updated: {lastImport.updatedAgentsCount}</span>
            ) : null}
            {lastImport.unchangedCount !== undefined ? (
              <span>Unchanged: {lastImport.unchangedCount}</span>
            ) : null}
            <span>Fetched: {new Date(lastImport.fetchedAt).toLocaleString()}</span>
          </div>
          {lastImport.unknownIds.length ? (
            <div className="mt-2 text-amber-200">
              Unknown IDs: {lastImport.unknownIds.join(", ")}
            </div>
          ) : null}
          {lastImport.message ? <div className="mt-2">{lastImport.message}</div> : null}
        </div>
      ) : null}

      {typeof totalAgentsSaved === "number" ? (
        <div className="mt-3 grid gap-2 text-xs text-ink-500">
          <div>Total agents saved: {totalAgentsSaved}</div>
          {missingAgents && missingAgents.length ? (
            <div className="rounded-lg border border-border bg-ika-900/40 p-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-ink-500">
                Put these agents into showcase next
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {missingAgents.slice(0, 10).map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-border bg-ika-800/70 px-2 py-0.5 text-[11px] text-ink-500"
                  >
                    {name}
                  </span>
                ))}
                {missingAgents.length > 10 ? (
                  <span className="text-[11px] text-ink-500">
                    +{missingAgents.length - 10} more
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="text-emerald-300">All agents have been imported.</div>
          )}
        </div>
      ) : null}

      <div className="mt-3 text-xs text-ink-500">
        Verify full roster to unlock strict draft eligibility checks.
      </div>
    </div>
  );
}
