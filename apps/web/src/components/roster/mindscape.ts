import { getLocalMindscapePath } from "./mindscapeManifest";

export function getFullMindscapeUrl(agentId: string): string | null {
  return getLocalMindscapePath(agentId);
}
