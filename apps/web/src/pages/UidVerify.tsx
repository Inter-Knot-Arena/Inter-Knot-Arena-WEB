import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { normalizedVerificationStatus, uidStatusLabel } from "../lib/verification";

const verifierRepositoryUrl = "https://github.com/Inter-Knot-Arena/Inter-Knot-Arena-VerifierApp";

export default function UidVerify() {
  const { user, isLoading, refresh } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const verificationStatus = normalizedVerificationStatus(user?.verification?.status);
  const verificationLabel = uidStatusLabel(verificationStatus);

  const handleRefreshStatus = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1100px] px-6 pb-16 pt-8">
        <div className="rounded-xl border border-border bg-ika-800/70 p-6 text-sm text-ink-500">
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-[1100px] px-6 pb-16 pt-8">
        <div className="rounded-xl border border-border bg-ika-800/70 p-6">
          <div className="text-lg font-semibold text-ink-900">Verifier setup</div>
          <p className="mt-2 text-sm text-ink-500">
            Sign in first, then run Verifier App visible roster scan to verify UID and sync roster.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/signin">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isVerified = verificationStatus === "VERIFIED";

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 pb-16 pt-8">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.2em] text-ink-500">Verifier onboarding</div>
        <h1 className="text-2xl font-display text-ink-900">UID and roster verification</h1>
        <p className="mt-2 text-sm text-ink-500">
          Enka import and manual UID flow are replaced by Verifier App OCR visible-slice sync.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-border bg-ika-800/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-ink-900">Current status</div>
            <Badge className="border border-border bg-ika-700/60 text-ink-700">
              {verificationLabel}
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 text-sm text-ink-500">
            <div>
              <span className="text-ink-700">Account:</span> {user.displayName}
            </div>
            <div>
              <span className="text-ink-700">UID:</span> {user.verification.uid ?? "Not linked yet"}
            </div>
            <div>
              <span className="text-ink-700">Region:</span>{" "}
              {user.verification.region ?? user.region}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void handleRefreshStatus()} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "Refresh status"}
            </Button>
            {isVerified && user.verification.uid ? (
              <Button variant="outline" asChild>
                <Link to={`/players/${user.verification.uid}/roster`}>Open roster workspace</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-ika-800/70 p-6">
          <div className="text-sm font-semibold text-ink-900">How to verify now</div>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-500">
            <li>Download and launch Verifier App.</li>
            <li>Sign in with your Inter-Knot Arena account.</li>
            <li>Start ZZZ and run visible roster scan from Verifier.</li>
            <li>Wait for auto-upload of UID and the currently visible agent slice.</li>
            <li>Return here and press Refresh status.</li>
          </ol>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href={verifierRepositoryUrl} target="_blank" rel="noreferrer">
                Verifier repository
              </a>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/roster">Back to roster</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
