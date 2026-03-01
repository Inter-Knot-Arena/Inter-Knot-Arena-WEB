const MINDSCAPE_CDN_BASE = "https://static.mana.wiki/zzz/images";

export function getFullMindscapeUrl(hakushId?: number): string | null {
  if (!hakushId || !Number.isFinite(hakushId)) {
    return null;
  }
  return `${MINDSCAPE_CDN_BASE}/AgentMindscape3_${hakushId}.png`;
}
