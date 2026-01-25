import { useMemo, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { AdminRole } from "./AdminHeader";

interface FeatureFlag {
  id: string;
  label: string;
  enabled: boolean;
}

export interface AdminActionLog {
  id: string;
  action: string;
  actor: string;
  time: string;
}

interface QuickActionsPanelProps {
  role: AdminRole;
  featureFlags: FeatureFlag[];
  onAction: (action: string) => void;
  recentActions: AdminActionLog[];
}

export function QuickActionsPanel({
  role,
  featureFlags,
  onAction,
  recentActions
}: QuickActionsPanelProps) {
  const [confirmClose, setConfirmClose] = useState(false);
  const [queueSelection, setQueueSelection] = useState<Record<string, boolean>>({
    Standard: true,
    F2P: false,
    Unlimited: true
  });
  const [flagState, setFlagState] = useState<FeatureFlag[]>(featureFlags);
  const [grantUser, setGrantUser] = useState("");
  const [grantRole, setGrantRole] = useState("MODER");

  const canConfigure = role === "admin" || role === "staff";
  const canGrantRole = role === "admin";

  const enabledCount = useMemo(() => flagState.filter((flag) => flag.enabled).length, [flagState]);

  const toggleQueue = (key: string) => {
    setQueueSelection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFlag = (id: string) => {
    setFlagState((prev) =>
      prev.map((flag) =>
        flag.id === id ? { ...flag, enabled: !flag.enabled } : flag
      )
    );
    onAction(`Toggle flag ${id}`);
  };

  if (role === "moder") {
    return (
      <aside className="space-y-4">
        <div className="rounded-xl border border-border bg-ika-800/70 p-4 text-sm text-ink-500">
          Quick actions are not available for moderators.
        </div>
        <div className="rounded-xl border border-border bg-ika-800/70 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Recent actions</div>
          <div className="mt-3 space-y-2 text-xs text-ink-500">
            {recentActions.length ? (
              recentActions.map((action) => (
                <div key={action.id} className="flex items-center justify-between">
                  <span>{action.action}</span>
                  <span>{action.time}</span>
                </div>
              ))
            ) : (
              <div>No actions yet.</div>
            )}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="space-y-4">
      <div className="rounded-xl border border-border bg-ika-800/70 p-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-ink-500">
          Quick actions
          <Badge className="border border-border bg-ika-700/60 text-ink-700">
            Flags {enabledCount}/{flagState.length}
          </Badge>
        </div>

        <div className="mt-4 space-y-3">
          {confirmClose ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
              Close all queues?
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmClose(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onAction("Close all queues");
                    setConfirmClose(false);
                  }}
                >
                  Confirm
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              className="w-full"
              onClick={() => setConfirmClose(true)}
            >
              Close all queues
            </Button>
          )}

          <div className="rounded-lg border border-border bg-ika-900/40 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-ink-500">
              Open queues
            </div>
            <div className="mt-2 space-y-2">
              {Object.keys(queueSelection).map((key) => (
                <label key={key} className="flex items-center justify-between text-xs text-ink-700">
                  <span>{key}</span>
                  <input
                    type="checkbox"
                    checked={queueSelection[key]}
                    onChange={() => toggleQueue(key)}
                  />
                </label>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full"
              onClick={() => onAction("Open selected queues")}
            >
              Apply
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-ika-900/40 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Feature flags</div>
            <div className="mt-2 space-y-2">
              {flagState.map((flag) => (
                <div key={flag.id} className="flex items-center justify-between text-xs text-ink-700">
                  <span>{flag.label}</span>
                  <button
                    type="button"
                    className={`h-5 w-9 rounded-full border transition ${
                      flag.enabled
                        ? "border-emerald-500/40 bg-emerald-500/20"
                        : "border-border bg-ika-900/50"
                    }`}
                    onClick={() => toggleFlag(flag.id)}
                  >
                    <span
                      className={`block h-4 w-4 translate-x-0.5 rounded-full bg-ink-900 transition ${
                        flag.enabled ? "translate-x-4" : ""
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {canConfigure ? (
            <div className="rounded-lg border border-border bg-ika-900/40 p-3">
              <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Seasons</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onAction("Create season")}>
                  Create season
                </Button>
                <Button size="sm" variant="outline" onClick={() => onAction("End season")}>
                  End season
                </Button>
              </div>
            </div>
          ) : null}

          {canGrantRole ? (
            <div className="rounded-lg border border-border bg-ika-900/40 p-3">
              <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Grant role</div>
              <input
                value={grantUser}
                onChange={(event) => setGrantUser(event.target.value)}
                placeholder="User ID or email"
                className="mt-2 w-full rounded-md border border-border bg-ika-900/40 px-3 py-2 text-xs text-ink-700"
              />
              <select
                className="mt-2 w-full rounded-md border border-border bg-ika-900/40 px-3 py-2 text-xs text-ink-700"
                value={grantRole}
                onChange={(event) => setGrantRole(event.target.value)}
              >
                <option value="ADMIN">Admin</option>
                <option value="STAFF">Staff</option>
                <option value="MODER">Moder</option>
              </select>
              <Button
                size="sm"
                className="mt-2 w-full"
                onClick={() => {
                  onAction(`Grant ${grantRole} to ${grantUser || "user"}`);
                  setGrantUser("");
                }}
              >
                Grant role
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-ika-800/70 p-4">
        <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Recent actions</div>
        <div className="mt-3 space-y-2 text-xs text-ink-500">
          {recentActions.length ? (
            recentActions.map((action) => (
              <div key={action.id} className="flex items-center justify-between">
                <span>{action.action}</span>
                <span>{action.time}</span>
              </div>
            ))
          ) : (
            <div>No actions yet.</div>
          )}
        </div>
      </div>
    </aside>
  );
}
