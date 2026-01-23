import type {
  AgentEligibility,
  AgentStatic,
  DiscProperty,
  PlayerAgentDisc,
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

function maxNumber(a?: number, b?: number): number | undefined {
  if (a === undefined) {
    return b;
  }
  if (b === undefined) {
    return a;
  }
  return Math.max(a, b);
}

function mergeSkills(
  existing?: Record<string, number>,
  incoming?: Record<string, number>
): Record<string, number> | undefined {
  if (!incoming && !existing) {
    return undefined;
  }
  if (!existing) {
    return incoming;
  }
  if (!incoming) {
    return existing;
  }
  const merged: Record<string, number> = { ...existing };
  Object.entries(incoming).forEach(([key, value]) => {
    const current = merged[key];
    merged[key] = current === undefined ? value : Math.max(current, value);
  });
  return merged;
}

function mergeDiscProps(
  existing?: DiscProperty[],
  incoming?: DiscProperty[]
): DiscProperty[] | undefined {
  if (!incoming || incoming.length === 0) {
    return existing;
  }
  if (!existing || existing.length === 0) {
    return incoming;
  }
  const merged = new Map<number, DiscProperty>();
  existing.forEach((prop) => merged.set(prop.propertyId, prop));
  incoming.forEach((prop) => {
    const current = merged.get(prop.propertyId);
    if (!current) {
      merged.set(prop.propertyId, prop);
      return;
    }
    merged.set(prop.propertyId, {
      propertyId: prop.propertyId,
      level: maxNumber(current.level, prop.level),
      value: prop.value ?? current.value
    });
  });
  return Array.from(merged.values());
}

function mergeDisc(existing: PlayerAgentDisc | undefined, incoming: PlayerAgentDisc): PlayerAgentDisc {
  if (!existing) {
    return incoming;
  }
  const incomingUnknown = incoming.setName?.startsWith("Unknown set");
  const existingUnknown = existing.setName?.startsWith("Unknown set");
  const setName =
    incoming.setName && (!incomingUnknown || existingUnknown) ? incoming.setName : existing.setName;
  const setId =
    incoming.setId && (!incomingUnknown || existingUnknown) ? incoming.setId : existing.setId;
  const setIconKey =
    incoming.setIconKey && (!incomingUnknown || existingUnknown)
      ? incoming.setIconKey
      : existing.setIconKey;

  return {
    discId: incoming.discId ?? existing.discId,
    slot: incoming.slot ?? existing.slot,
    set: incoming.set ?? existing.set,
    mainStat: incoming.mainStat ?? existing.mainStat,
    subStats: incoming.subStats && incoming.subStats.length ? incoming.subStats : existing.subStats,
    pieceGameId: incoming.pieceGameId ?? existing.pieceGameId,
    setGameId: incoming.setGameId ?? existing.setGameId,
    setId,
    setName,
    setIconKey,
    mainProps: mergeDiscProps(existing.mainProps, incoming.mainProps),
    subProps: mergeDiscProps(existing.subProps, incoming.subProps),
    level: maxNumber(existing.level, incoming.level),
    breakLevel: maxNumber(existing.breakLevel, incoming.breakLevel),
    isLocked: incoming.isLocked ?? existing.isLocked
  };
}

function mergeDiscs(
  existing?: PlayerAgentDisc[],
  incoming?: PlayerAgentDisc[]
): PlayerAgentDisc[] | undefined {
  if (!incoming || incoming.length === 0) {
    return existing;
  }
  const slotMap = new Map<number, PlayerAgentDisc>();
  const extras: PlayerAgentDisc[] = [];
  existing?.forEach((disc) => {
    if (disc.slot) {
      slotMap.set(disc.slot, disc);
    } else {
      extras.push(disc);
    }
  });

  incoming.forEach((disc) => {
    if (disc.slot) {
      const current = slotMap.get(disc.slot);
      slotMap.set(disc.slot, mergeDisc(current, disc));
    } else {
      extras.push(disc);
    }
  });

  const merged = Array.from(slotMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, disc]) => disc)
    .concat(extras);

  return merged.length ? merged : undefined;
}

function mergeWeapon(
  existing: PlayerAgentDynamic["weapon"] | undefined,
  incoming: PlayerAgentDynamic["weapon"] | undefined
): PlayerAgentDynamic["weapon"] | undefined {
  if (!incoming) {
    return existing;
  }
  if (!existing) {
    return incoming;
  }
  const existingScore = (existing.level ?? 0) * 10 + (existing.breakLevel ?? 0);
  const incomingScore = (incoming.level ?? 0) * 10 + (incoming.breakLevel ?? 0);
  const best = incomingScore > existingScore ? incoming : existing;
  const other = best === incoming ? existing : incoming;

  return {
    weaponId: best.weaponId ?? other.weaponId,
    gameId: best.gameId ?? other.gameId,
    level: maxNumber(best.level, other.level),
    breakLevel: maxNumber(best.breakLevel, other.breakLevel),
    rarity: best.rarity ?? other.rarity
  };
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

  if (hasOwn(incoming, "agentGameId") && (canOverride || !hasOwn(existing, "agentGameId"))) {
    result.agentGameId = incoming.agentGameId;
  }
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
  if (hasOwn(incoming, "promotion") && (canOverride || !hasOwn(existing, "promotion"))) {
    result.promotion = incoming.promotion;
  }
  if (hasOwn(incoming, "talent") && (canOverride || !hasOwn(existing, "talent"))) {
    result.talent = incoming.talent;
  }
  if (hasOwn(incoming, "core") && (canOverride || !hasOwn(existing, "core"))) {
    result.core = incoming.core;
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
  if (hasOwn(incoming, "lastImportedAt") && (canOverride || !hasOwn(existing, "lastImportedAt"))) {
    result.lastImportedAt = incoming.lastImportedAt;
  }
  if (
    hasOwn(incoming, "lastShowcaseSeenAt") &&
    (canOverride || !hasOwn(existing, "lastShowcaseSeenAt"))
  ) {
    result.lastShowcaseSeenAt = incoming.lastShowcaseSeenAt;
  }

  result.source = canOverride ? incoming.source : existing.source;
  result.updatedAt = canOverride ? incoming.updatedAt : existing.updatedAt;

  return result;
}

export function mergePlayerAgentDynamicAccumulative(
  existing: PlayerAgentDynamic | null | undefined,
  incoming: PlayerAgentDynamic
): PlayerAgentDynamic {
  if (!existing) {
    return {
      ...incoming,
      owned: incoming.owned ?? true
    };
  }

  const result: PlayerAgentDynamic = {
    ...existing,
    agentId: incoming.agentId,
    agentGameId: incoming.agentGameId ?? existing.agentGameId,
    owned: existing.owned || incoming.owned
  };

  result.level = maxNumber(existing.level, incoming.level);
  result.dupes = maxNumber(existing.dupes, incoming.dupes);
  result.mindscape = maxNumber(existing.mindscape, incoming.mindscape);
  result.promotion = maxNumber(existing.promotion, incoming.promotion);
  result.core = maxNumber(existing.core, incoming.core);
  result.talent = maxNumber(existing.talent, incoming.talent);
  result.weapon = mergeWeapon(existing.weapon, incoming.weapon);
  result.discs = mergeDiscs(existing.discs, incoming.discs);
  result.skills = mergeSkills(existing.skills, incoming.skills);
  result.confidence = incoming.confidence ?? existing.confidence;

  result.lastImportedAt = incoming.lastImportedAt ?? existing.lastImportedAt;
  result.lastShowcaseSeenAt = incoming.lastShowcaseSeenAt ?? existing.lastShowcaseSeenAt;
  result.source = incoming.source ?? existing.source;
  result.updatedAt = incoming.updatedAt ?? existing.updatedAt;

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
