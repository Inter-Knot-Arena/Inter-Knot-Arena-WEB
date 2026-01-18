import type {
  AgentEligibility,
  AgentStatic,
  PlayerAgentDynamic,
  PlayerAgentSource,
  Ruleset
} from "./types.js";

const SOURCE_PRIORITY: Record<PlayerAgentSource, number> = {
  MANUAL: 0,
  ENKA_SHOWCASE: 1,
  VERIFIER_OCR: 2
};

function hasOwn<T extends object, K extends keyof T>(value: T, key: K): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function shouldOverride(existing: PlayerAgentSource, incoming: PlayerAgentSource): boolean {
  return SOURCE_PRIORITY[incoming] >= SOURCE_PRIORITY[existing];
}

export function mergePlayerAgentDynamic(
  existing: PlayerAgentDynamic | null | undefined,
  incoming: PlayerAgentDynamic
): PlayerAgentDynamic {
  if (!existing) {
    return incoming;
  }

  const canOverride = shouldOverride(existing.source, incoming.source);
  const result: PlayerAgentDynamic = {
    ...existing,
    agentId: incoming.agentId
  };

  if (hasOwn(incoming, "owned") && (canOverride || !hasOwn(existing, "owned"))) {
    result.owned = incoming.owned;
  }
  if (hasOwn(incoming, "level") && (canOverride || !hasOwn(existing, "level"))) {
    result.level = incoming.level;
  }
  if (hasOwn(incoming, "dupes") && (canOverride || !hasOwn(existing, "dupes"))) {
    result.dupes = incoming.dupes;
  }
  if (hasOwn(incoming, "mindscape") && (canOverride || !hasOwn(existing, "mindscape"))) {
    result.mindscape = incoming.mindscape;
  }
  if (hasOwn(incoming, "weapon") && (canOverride || !hasOwn(existing, "weapon"))) {
    result.weapon = incoming.weapon;
  }
  if (hasOwn(incoming, "discs") && (canOverride || !hasOwn(existing, "discs"))) {
    result.discs = incoming.discs;
  }
  if (hasOwn(incoming, "skills") && (canOverride || !hasOwn(existing, "skills"))) {
    result.skills = incoming.skills;
  }
  if (hasOwn(incoming, "confidence") && (canOverride || !hasOwn(existing, "confidence"))) {
    result.confidence = incoming.confidence;
  }

  result.source = canOverride ? incoming.source : existing.source;
  result.updatedAt = canOverride ? incoming.updatedAt : existing.updatedAt;

  return result;
}

export function computeEligibility(
  agent: AgentStatic,
  state: PlayerAgentDynamic | undefined,
  ruleset: Ruleset
): AgentEligibility {
  const reasons: string[] = [];

  if (!state?.owned) {
    reasons.push("Agent not owned");
  }

  const allowed = ruleset.allowedAgents;
  if (allowed) {
    const isListed = allowed.agentIds.includes(agent.agentId);
    if (allowed.mode === "WHITELIST" && !isListed) {
      reasons.push("Not in allowed agent list");
    }
    if (allowed.mode === "BLACKLIST" && isListed) {
      reasons.push("Agent is banned in this ruleset");
    }
  }

  if (ruleset.levelCaps?.agentLevel && state?.level !== undefined) {
    if (state.level > ruleset.levelCaps.agentLevel) {
      reasons.push(`Exceeds agent level cap (${ruleset.levelCaps.agentLevel})`);
    }
  }

  if (ruleset.levelCaps?.skillLevel && state?.skills) {
    const skillLevels = Object.values(state.skills);
    const maxSkill = skillLevels.length ? Math.max(...skillLevels) : 0;
    if (maxSkill > ruleset.levelCaps.skillLevel) {
      reasons.push(`Exceeds skill level cap (${ruleset.levelCaps.skillLevel})`);
    }
  }

  if (ruleset.dupesPolicy?.mode === "DISALLOW" && (state?.dupes ?? 0) > 0) {
    reasons.push("Dupes are not allowed");
  } else if (
    ruleset.dupesPolicy?.mode === "LIMIT" &&
    ruleset.dupesPolicy.max !== undefined &&
    (state?.dupes ?? 0) > ruleset.dupesPolicy.max
  ) {
    reasons.push(`Dupes limited to ${ruleset.dupesPolicy.max}`);
  }

  return { draftEligible: reasons.length === 0, reasons };
}
