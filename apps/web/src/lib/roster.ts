const rosterRegions = new Set(["NA", "EU", "ASIA", "SEA", "OTHER"]);

export function normalizeRosterRegion(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  return rosterRegions.has(normalized) ? normalized : null;
}

export function buildRosterPath(uid: string, region: string | null | undefined): string {
  const path = `/players/${encodeURIComponent(uid)}/roster`;
  const normalizedRegion = normalizeRosterRegion(region);
  if (!normalizedRegion) {
    return path;
  }
  return `${path}?region=${encodeURIComponent(normalizedRegion)}`;
}
