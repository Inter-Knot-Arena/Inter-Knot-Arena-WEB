import type { IdentityStatus } from "@ika/shared";

export function normalizedVerificationStatus(
  status: IdentityStatus | null | undefined
): IdentityStatus {
  return status ?? "UNVERIFIED";
}

export function isUidVerified(status: IdentityStatus | null | undefined): boolean {
  return normalizedVerificationStatus(status) === "VERIFIED";
}

export function uidStatusLabel(status: IdentityStatus | null | undefined): string {
  const normalized = normalizedVerificationStatus(status);
  if (normalized === "VERIFIED") {
    return "UID verified";
  }
  if (normalized === "PENDING") {
    return "UID pending";
  }
  if (normalized === "REJECTED") {
    return "UID rejected";
  }
  return "UID unverified";
}
