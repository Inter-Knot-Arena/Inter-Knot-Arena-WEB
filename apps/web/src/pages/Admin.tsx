import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Cloud, Flag, RefreshCw, Shield } from "lucide-react";
import { AdminHeader, type AdminRole } from "../components/admin/AdminHeader";
import { OpsMetricCard } from "../components/admin/OpsMetricCard";
import { WorkQueueTabs } from "../components/admin/WorkQueueTabs";
import type { WorkQueueItem } from "../components/admin/WorkQueueTable";
import {
  QuickActionsPanel,
  type AdminActionLog
} from "../components/admin/QuickActionsPanel";
import { ConfigModulesGrid, type ConfigModule } from "../components/admin/ConfigModulesGrid";
import { Skeleton } from "../components/ui/skeleton";

const mockQueues = [
  { name: "Standard", status: "OPEN", inQueue: 14, avgWait: "2–4 min" },
  { name: "F2P", status: "OPEN", inQueue: 9, avgWait: "3–6 min" },
  { name: "Unlimited", status: "OPEN", inQueue: 3, avgWait: "1–3 min" }
];

const reviewItems: WorkQueueItem[] = Array.from({ length: 8 }).map((_, index) => ({
  id: `REV-${1200 + index}`,
  players: index % 2 === 0 ? "Ellen vs Lycaon" : "Anby vs Nicole",
  league: index % 2 === 0 ? "Standard" : "F2P",
  createdAt: "2h ago",
  updatedAt: "30m ago",
  status: index % 3 === 0 ? "IN_REVIEW" : "NEW",
  assignee: index % 3 === 0 ? "moder_kris" : undefined
}));

const disputeItems: WorkQueueItem[] = Array.from({ length: 5 }).map((_, index) => ({
  id: `DSP-${640 + index}`,
  players: "Ellen vs Billy",
  league: "Standard",
  createdAt: "1d ago",
  updatedAt: "4h ago",
  status: index % 2 === 0 ? "OPEN" : "ESCALATED",
  assignee: index % 2 === 0 ? "staff_zoe" : undefined
}));

const reportItems: WorkQueueItem[] = Array.from({ length: 3 }).map((_, index) => ({
  id: `RPT-${300 + index}`,
  players: "Unknown",
  league: "Unlimited",
  createdAt: "3d ago",
  updatedAt: "6h ago",
  status: "NEW",
  assignee: undefined
}));

const importItems: WorkQueueItem[] = Array.from({ length: 6 }).map((_, index) => ({
  id: `IMP-${80 + index}`,
  players: "UID 123456789",
  league: "Standard",
  createdAt: "4h ago",
  updatedAt: "2h ago",
  status: index % 2 === 0 ? "FAILED" : "OK",
  assignee: "system"
}));

const featureFlags = [
  { id: "ENKA_IMPORT", label: "Enka Import", enabled: true },
  { id: "AGENT_CATALOG", label: "Agent Catalog", enabled: true },
  { id: "ACCUMULATIVE_IMPORT", label: "Accumulative Import", enabled: true },
  { id: "STRICT_RANKED", label: "Strict Ranked", enabled: false },
  { id: "VERIFIER_MONITOR", label: "Verifier Monitor", enabled: false }
];

const configModules: ConfigModule[] = [
  {
    id: "catalogs",
    title: "Catalogs",
    description: "Agents, weapons, and disc set content.",
    status: "Ready",
    updatedAt: "2h ago",
    allowedRoles: ["admin"]
  },
  {
    id: "rulesets",
    title: "Rulesets",
    description: "League caps, verifier requirements, evidence policies.",
    status: "Draft",
    updatedAt: "1d ago"
  },
  {
    id: "seasons",
    title: "Seasons",
    description: "Season timelines and soft resets.",
    status: "Active",
    updatedAt: "3h ago"
  },
  {
    id: "rank-bands",
    title: "Rank bands",
    description: "ELO tiers and seasonal badges.",
    status: "Draft",
    updatedAt: "6h ago"
  },
  {
    id: "flags",
    title: "Feature flags",
    description: "Runtime toggles for queue behavior.",
    status: "Ready",
    updatedAt: "15m ago"
  },
  {
    id: "access-control",
    title: "Access control",
    description: "Role grants and permissions.",
    status: "Ready",
    updatedAt: "12m ago",
    allowedRoles: ["admin"]
  }
];

export default function Admin() {
  const [season, setSeason] = useState("Season 01");
  const [role] = useState<AdminRole>("admin");
  const [loading] = useState(false);
  const [recentActions, setRecentActions] = useState<AdminActionLog[]>([]);

  const onAction = (action: string) => {
    setRecentActions((prev) => [
      {
        id: `${Date.now()}-${prev.length}`,
        action,
        actor: role,
        time: new Date().toLocaleTimeString()
      },
      ...prev
    ].slice(0, 5));
  };

  const queueSummary = useMemo(() => {
    return mockQueues
      .map((queue) => `${queue.name}: ${queue.inQueue} (${queue.avgWait})`)
      .join(" · ");
  }, []);

  const flagsEnabled = featureFlags.filter((flag) => flag.enabled).length;
  const pendingReviews = reviewItems.length;
  const openDisputes = disputeItems.length;
  const proofMissing = 4;
  const enkaErrors = 3;
  const catalogSummary = "agents v1.2 · weapons v1.1 · discs v1.0";

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 px-6 pb-16 pt-8">
      <AdminHeader
        role={role}
        season={season}
        seasons={["Season 01", "Season 00"]}
        systemStatus="Operational"
        lastRefresh="2 minutes ago"
        onSeasonChange={setSeason}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))
        ) : (
          <>
            <OpsMetricCard
              title="Live queues"
              value="3 OPEN"
              description={queueSummary}
              icon={<Shield className="h-4 w-4" />}
            />
            <OpsMetricCard
              title="Pending reviews"
              value={`${pendingReviews}`}
              warning={pendingReviews > 6}
              description="Awaiting moderation"
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <OpsMetricCard
              title="Open disputes"
              value={`${openDisputes}`}
              warning={openDisputes > 4}
              description="Active escalations"
              icon={<Flag className="h-4 w-4" />}
            />
            <OpsMetricCard
              title="Proof missing"
              value={`${proofMissing}`}
              warning={proofMissing > 3}
              description="Uploads required"
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <OpsMetricCard
              title="Enka errors"
              value={`${enkaErrors}`}
              warning={enkaErrors > 0}
              description="Top: invalid UID"
              icon={<Cloud className="h-4 w-4" />}
            />
            <OpsMetricCard
              title="Catalog versions"
              value="v1.x"
              description={catalogSummary}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <OpsMetricCard
              title="Feature flags"
              value={`${flagsEnabled} enabled`}
              description="Runtime toggles"
              icon={<RefreshCw className="h-4 w-4" />}
            />
            <OpsMetricCard
              title="Verifier health"
              value="Healthy"
              description="Last heartbeat 4m ago"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
          </>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Work queue</div>
              <div className="text-lg font-semibold text-ink-900">Reviews & disputes</div>
            </div>
          </div>
          <WorkQueueTabs
            role={role}
            reviews={reviewItems}
            disputes={disputeItems}
            reports={reportItems}
            imports={importItems}
          />
        </section>

        <QuickActionsPanel
          role={role}
          featureFlags={featureFlags}
          recentActions={recentActions}
          onAction={onAction}
        />
      </div>

      <ConfigModulesGrid role={role} modules={configModules} />
    </div>
  );
}
