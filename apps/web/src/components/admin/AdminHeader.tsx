import { Badge } from "../ui/badge";

export type AdminRole = "admin" | "staff" | "moder";

interface AdminHeaderProps {
  role: AdminRole;
  season: string;
  seasons: string[];
  systemStatus: "Operational" | "Degraded" | "Maintenance";
  lastRefresh: string;
  onSeasonChange?: (season: string) => void;
}

const roleStyles: Record<AdminRole, string> = {
  admin: "border border-[#FF3B30]/40 bg-[#FF3B30]/10 text-[#FF3B30]",
  staff: "border border-[#FF7A1A]/40 bg-[#FF7A1A]/10 text-[#FF7A1A]",
  moder: "border border-[#2DD4BF]/40 bg-[#2DD4BF]/10 text-[#2DD4BF]"
};

const roleLabels: Record<AdminRole, string> = {
  admin: "Admin",
  staff: "Staff",
  moder: "Moder"
};

const statusStyles: Record<AdminHeaderProps["systemStatus"], string> = {
  Operational: "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  Degraded: "border border-amber-500/40 bg-amber-500/10 text-amber-300",
  Maintenance: "border border-rose-500/40 bg-rose-500/10 text-rose-300"
};

export function AdminHeader({
  role,
  season,
  seasons,
  systemStatus,
  lastRefresh,
  onSeasonChange
}: AdminHeaderProps) {
  return (
    <section className="rounded-2xl border border-border bg-ika-800/70 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Admin Console</div>
          <h1 className="mt-2 text-3xl font-display text-ink-900">Operations Center</h1>
          <p className="mt-2 text-sm text-ink-500">
            Operations, configuration, and enforcement tools.
          </p>
          <div className="mt-3 text-xs text-ink-500">Last refresh {lastRefresh}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={roleStyles[role]}>{roleLabels[role]}</Badge>
          <select
            className="rounded-md border border-border bg-ika-900/40 px-3 py-2 text-sm text-ink-700"
            value={season}
            onChange={(event) => onSeasonChange?.(event.target.value)}
          >
            {seasons.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Badge className={statusStyles[systemStatus]}>{systemStatus}</Badge>
        </div>
      </div>
    </section>
  );
}
