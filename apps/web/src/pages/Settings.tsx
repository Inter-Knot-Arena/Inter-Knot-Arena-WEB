import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, CheckCircle2, Info, LogOut, Pencil, ShieldAlert, ShieldCheck } from "lucide-react";
import { updateMe } from "../api";
import { useAuth } from "../auth/AuthProvider";
import type { Region } from "@ika/shared";
import { normalizedVerificationStatus, uidStatusLabel } from "../lib/verification";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";

const REGIONS: Region[] = ["NA", "EU", "ASIA", "SEA", "OTHER"];

interface ToastState {
  type: "success" | "error";
  message: string;
}

type SaveState = "idle" | "saving" | "saved";

function roleBadgeClass(role: string) {
  if (role === "ADMIN") {
    return "border border-[#FF3B30]/40 bg-[#FF3B30]/10 text-[#FF3B30]";
  }
  if (role === "STAFF") {
    return "border border-[#FF7A1A]/40 bg-[#FF7A1A]/10 text-[#FF7A1A]";
  }
  if (role === "MODER") {
    return "border border-[#2DD4BF]/40 bg-[#2DD4BF]/10 text-[#2DD4BF]";
  }
  return "border border-border bg-ika-700/70 text-ink-700";
}

function roleLabel(role: string) {
  if (role === "ADMIN") return "Admin";
  if (role === "STAFF") return "Staff";
  if (role === "MODER") return "Moder";
  return role;
}

export default function Settings() {
  const { user, isLoading, setUser, logout } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [region, setRegion] = useState<Region>("OTHER");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [showUidPublicly, setShowUidPublicly] = useState(false);
  const [showMatchHistoryPublicly, setShowMatchHistoryPublicly] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);
  const [showAvatarUrlInput, setShowAvatarUrlInput] = useState(false);
  const [googleAvatarUrl, setGoogleAvatarUrl] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    setDisplayName(user.displayName);
    setRegion(user.region);
    setAvatarUrl(user.avatarUrl ?? "");
    setGoogleAvatarUrl(user.avatarUrl ?? null);
    setShowUidPublicly(user.privacy.showUidPublicly);
    setShowMatchHistoryPublicly(user.privacy.showMatchHistoryPublicly);
    setShowAvatarOptions(false);
    setShowAvatarUrlInput(false);
    setSaveState("idle");
  }, [user]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const proxyProgress = useMemo(() => {
    if (!user) {
      return 0;
    }
    return Math.min(100, Math.round((user.proxyLevel.xp / user.proxyLevel.nextXp) * 100));
  }, [user]);

  const trustTier = useMemo(() => {
    if (!user) {
      return "Neutral";
    }
    if (user.trustScore >= 130) {
      return "Trusted";
    }
    if (user.trustScore >= 90) {
      return "Neutral";
    }
    return "At risk";
  }, [user]);

  const nextUnlock = useMemo(() => {
    if (!user) {
      return { level: 5, label: "Ranked access" };
    }
    const level = user.proxyLevel.level;
    if (level < 5) {
      return { level: 5, label: "Ranked access" };
    }
    if (level < 10) {
      return { level: 10, label: "Moderator eligibility" };
    }
    if (level < 20) {
      return { level: 20, label: "Advanced queues" };
    }
    return { level: 30, label: "Seasonal badges" };
  }, [user]);

  const displayRoles = useMemo(() => {
    if (!user) {
      return ["USER"];
    }
    const elevated = user.roles.filter((role) => role !== "USER");
    return elevated.length ? elevated : user.roles.length ? user.roles : ["USER"];
  }, [user]);

  const isDirty = useMemo(() => {
    if (!user) {
      return false;
    }
    const normalizedAvatar = avatarUrl.trim();
    const userAvatar = user.avatarUrl ?? "";
    return (
      displayName.trim() !== user.displayName ||
      region !== user.region ||
      normalizedAvatar !== userAvatar ||
      showUidPublicly !== user.privacy.showUidPublicly ||
      showMatchHistoryPublicly !== user.privacy.showMatchHistoryPublicly
    );
  }, [user, displayName, region, avatarUrl, showUidPublicly, showMatchHistoryPublicly]);

  useEffect(() => {
    if (saveState !== "saved") {
      return;
    }
    const timer = window.setTimeout(() => setSaveState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [saveState]);

  useEffect(() => {
    if (saveState === "saved" && isDirty) {
      setSaveState("idle");
    }
  }, [isDirty, saveState]);

  const isSaving = saveState === "saving";

  if (isLoading) {
    return <div className="card">Loading settings...</div>;
  }

  if (!user) {
    return <div className="card">Sign in required.</div>;
  }

  const verificationStatus = normalizedVerificationStatus(user.verification.status);
  const verificationLabel = uidStatusLabel(verificationStatus);

  const handleAvatarFile = (file?: File) => {
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setToast({ type: "error", message: "Please choose an image file." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setToast({ type: "error", message: "Image must be under 2MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
        setToast({ type: "success", message: "Avatar updated." });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      setToast({ type: "error", message: "Display name is required." });
      return;
    }
    if (displayName.trim().length > 24) {
      setToast({ type: "error", message: "Display name must be 24 characters or fewer." });
      return;
    }
    if (avatarUrl && !isValidUrl(avatarUrl)) {
      setToast({ type: "error", message: "Avatar URL must be a valid http(s) URL." });
      return;
    }

    const payload = {
      displayName: displayName.trim(),
      region,
      avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : null,
      privacy: {
        showUidPublicly,
        showMatchHistoryPublicly
      }
    };

    const previous = user;
    const optimistic = {
      ...user,
      displayName: payload.displayName,
      region: payload.region,
      avatarUrl: payload.avatarUrl,
      privacy: payload.privacy,
      updatedAt: Date.now()
    };

    setSaveState("saving");
    setUser(optimistic);
    try {
      const updated = await updateMe(payload);
      setUser(updated);
      setToast({ type: "success", message: "Saved." });
      setSaveState("saved");
    } catch {
      setUser(previous);
      setToast({ type: "error", message: "Failed to save changes." });
      setSaveState("idle");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 pb-16 pt-8">
      {toast ? (
        <div
          className={`fixed right-6 top-24 z-50 rounded-lg border px-4 py-3 text-sm shadow-card ${
            toast.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/40 bg-rose-500/10 text-rose-200"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="mb-6">
        <h2 className="text-2xl font-display text-ink-900">Profile settings</h2>
        <p className="text-sm text-ink-500">Manage account identity, privacy, and competitive status.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.7fr,1.3fr]">
        <Card className="border-border bg-ika-800/70">
          <CardHeader>
            <CardTitle className="text-lg font-sans text-ink-900">Account snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar className="h-16 w-16">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={user.displayName} /> : null}
                  <AvatarFallback>{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  className="absolute -bottom-2 -right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-ika-800 text-ink-700 opacity-0 transition group-hover:opacity-100"
                  aria-label="Change avatar"
                  onClick={() => setShowAvatarOptions((prev) => !prev)}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <div>
                <div className="text-sm font-semibold text-ink-900">{user.displayName}</div>
                <div className="text-xs text-ink-500">{user.email}</div>
              </div>
            </div>
            {showAvatarOptions ? (
              <div className="rounded-lg border border-border bg-ika-800/70 p-3 text-xs text-ink-500">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setAvatarUrl(googleAvatarUrl ?? "")}
                    disabled={!googleAvatarUrl}
                  >
                    Use account avatar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload image
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAvatarUrlInput((prev) => !prev)}
                  >
                    Paste link
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handleAvatarFile(event.target.files?.[0])}
                  />
                </div>
                {showAvatarUrlInput ? (
                  <div className="mt-3">
                    <Input
                      value={avatarUrl}
                      onChange={(event) => setAvatarUrl(event.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Roles</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {displayRoles.map((role) => (
                  <Badge key={role} className={roleBadgeClass(role)}>
                    {roleLabel(role)}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-ika-700/40 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Trust score</div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900"
                      aria-label="Trust score info"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Trust reflects completed matches, disputes, and proof compliance.</TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-2 flex items-center gap-2 text-2xl font-semibold text-ink-900">
                {user.trustScore}
                <Badge className={trustBadgeClass(trustTier)}>{trustTier}</Badge>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-ink-500">
                <li>+ Completed matches without disputes</li>
                <li>+ UID verification and proof compliance</li>
                <li>- No-shows or repeated disputes</li>
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-ika-700/40 p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-ink-500">
                Proxy level
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="mt-2 flex items-center justify-between text-sm font-semibold text-ink-900">
                <span>
                  {user.proxyLevel.level} / 60
                </span>
                <span className="text-xs text-ink-500">{user.proxyLevel.xp} XP</span>
              </div>
              <div className="mt-2">
                <Progress value={proxyProgress} />
              </div>
              <div className="mt-2 text-xs text-ink-500">
                Next unlock at level {nextUnlock.level}: {nextUnlock.label}.
              </div>
              <div className="mt-1 text-xs text-ink-500">
                Earn XP by: completing matches, verifying UID, moderating disputes.
              </div>
            </div>

            <div className="rounded-lg border border-border bg-ika-700/40 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-500">
                <CheckCircle2 className="h-4 w-4" />
                Verification
              </div>
              <div className="mt-2">
                <Badge className={verificationBadgeClass(verificationStatus)}>
                  {verificationStatus}
                </Badge>
              </div>
              {user.verification.uid ? (
                <div className="mt-1 text-xs text-ink-500">UID: {user.verification.uid}</div>
              ) : null}
              <div className="mt-1 text-xs text-ink-500">{verificationLabel}</div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-ink-500">Required for ranked queues.</div>
                {verificationStatus !== "VERIFIED" ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/uid-verify">Verify UID</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-ika-800/70">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg font-sans text-ink-900">Profile editor</CardTitle>
            {isDirty ? (
              <Badge className="border border-accent-400/30 bg-accent-600/10 text-accent-400">
                Unsaved
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-ink-500">Display name</label>
                <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-ink-500">Region</label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-ika-800/70 px-3 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                  value={region}
                  onChange={(event) => setRegion(event.target.value as Region)}
                >
                  {REGIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <div className="mt-2 text-xs text-ink-500">Used for matchmaking queues.</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border bg-ika-700/40 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Privacy</div>
              <ToggleRow
                label="Show UID publicly"
                description="UID is visible on your public profile."
                checked={showUidPublicly}
                onChange={setShowUidPublicly}
              />
              <ToggleRow
                label="Show match history publicly"
                description="Ranked history remains visible to moderators and dispute participants."
                checked={showMatchHistoryPublicly}
                onChange={setShowMatchHistoryPublicly}
              />
            </div>

            <div className="rounded-lg border border-border bg-ika-700/30 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Danger zone</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => logout()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-rose-500/50 text-rose-300 hover:border-rose-400/70 hover:text-rose-100"
                  onClick={() => setDeleteOpen(true)}
                >
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Delete account
                </Button>
              </div>
              <div className="mt-2 text-xs text-ink-500">
                Account deletion requires manual support in MVP.
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <div className="text-xs text-ink-500">
                {isDirty ? "Unsaved changes." : "All changes saved."}
              </div>
              <Button onClick={handleSave} disabled={isSaving || !isDirty}>
                {saveState === "saved" ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Saved
                  </>
                ) : saveState === "saving" ? (
                  "Saving..."
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ika-900/80 px-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-ika-800 p-5 shadow-card">
            <div className="text-lg font-semibold text-ink-900">Delete account</div>
            <p className="mt-2 text-sm text-ink-500">
              Type <span className="font-semibold text-ink-900">DELETE</span> to confirm.
            </p>
            <Input
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder="DELETE"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-rose-500/50 text-rose-300 hover:border-rose-400/70 hover:text-rose-100"
                disabled={deleteConfirm !== "DELETE"}
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirm("");
                  setToast({ type: "error", message: "Account deletion is not available yet." });
                }}
              >
                Confirm delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isValidUrl(value: string): boolean {
  if (value.startsWith("data:image/")) {
    return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function ToggleRow({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex w-full items-start gap-3 rounded-lg bg-ika-800/40 p-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border border-border transition ${
          checked ? "bg-accent-500/70" : "bg-ika-800/80"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-ink-900 transition ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <div>
        <div className="text-sm font-semibold text-ink-900 leading-5">{label}</div>
        <div className="text-xs text-ink-500 leading-4">{description}</div>
      </div>
    </div>
  );
}

function trustBadgeClass(tier: string): string {
  if (tier === "Trusted") {
    return "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (tier === "At risk") {
    return "border border-rose-500/30 bg-rose-500/10 text-rose-300";
  }
  return "border border-slate-400/30 bg-slate-500/10 text-slate-300";
}

function verificationBadgeClass(status: string): string {
  if (status === "VERIFIED") {
    return "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "PENDING") {
    return "border border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  if (status === "REJECTED") {
    return "border border-rose-500/30 bg-rose-500/10 text-rose-300";
  }
  return "border border-slate-400/30 bg-slate-500/10 text-slate-300";
}
