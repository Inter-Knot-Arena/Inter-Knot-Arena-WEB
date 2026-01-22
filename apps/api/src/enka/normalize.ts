import type { EnkaMapping, PlayerAgentDynamic } from "@ika/shared";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function hasExplicitAgentId(record: UnknownRecord): boolean {
  return (
    record.characterId !== undefined ||
    record.character_id !== undefined ||
    record.avatarId !== undefined ||
    record.avatar_id !== undefined
  );
}

function hasDiscMarkers(record: UnknownRecord): boolean {
  return (
    record.discId !== undefined ||
    record.diskDrive !== undefined ||
    record.diskDrives !== undefined ||
    record.driveDisk !== undefined ||
    record.driveDisks !== undefined ||
    record.mainStat !== undefined ||
    record.subStats !== undefined ||
    record.slot !== undefined ||
    record.set !== undefined
  );
}

function hasCharacterMarkers(record: UnknownRecord): boolean {
  return (
    record.level !== undefined ||
    record.characterLevel !== undefined ||
    record.rank !== undefined ||
    record.dupes !== undefined ||
    record.mindscape !== undefined ||
    record.resonance !== undefined ||
    record.weapon !== undefined ||
    record.weaponInfo !== undefined ||
    record.skills !== undefined ||
    record.skillLevels !== undefined ||
    record.skillMap !== undefined
  );
}

function looksLikeAgentRecord(record: UnknownRecord): boolean {
  if (hasDiscMarkers(record)) {
    return false;
  }
  if (hasExplicitAgentId(record)) {
    return true;
  }
  return hasCharacterMarkers(record) && extractId(record) !== null;
}

function extractShowcaseAgents(payload: unknown): unknown[] {
  const root = asRecord(payload);
  if (!root) {
    return [];
  }

  const candidates = [
    root.showcase,
    root.showcaseInfo,
    root.showcaseAgents,
    root.data,
    root.playerInfo,
    root.player,
    root.profile,
    root.payload
  ];

  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (!record) {
      continue;
    }
    const agents =
      record.agents ??
      record.characters ??
      record.showcaseAgents ??
      record.avatarInfoList ??
      record.avatarList ??
      record.showcaseList;
    const list = asArray(agents);
    if (list.length) {
      return list;
    }
  }

  const queue: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];
  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    if (current.depth > 6) {
      continue;
    }
    if (Array.isArray(current.value)) {
      if (
        current.value.some((item) => {
          const record = asRecord(item);
          return record ? looksLikeAgentRecord(record) : false;
        })
      ) {
        return current.value;
      }
      current.value.forEach((item) => queue.push({ value: item, depth: current.depth + 1 }));
      continue;
    }
    const record = asRecord(current.value);
    if (!record) {
      continue;
    }
    Object.values(record).forEach((value) => {
      if (value && typeof value === "object") {
        queue.push({ value, depth: current.depth + 1 });
      }
    });
  }

  return [];
}

function extractId(record: UnknownRecord): string | null {
  return (
    asString(record.characterId) ??
    asString(record.character_id) ??
    asString(record.avatarId) ??
    asString(record.avatar_id) ??
    asString(record.id)
  );
}

function normalizeWeapon(record: UnknownRecord, mapping: EnkaMapping, unknownIds: string[]) {
  const weaponRecord = asRecord(record.weapon ?? record.weaponInfo);
  if (!weaponRecord) {
    const primitive = asString(record.weapon);
    if (!primitive) {
      return undefined;
    }
    const mapped = mapping.weapons[primitive];
    if (!mapped) {
      unknownIds.push(`weapon:${primitive}`);
    }
    return {
      weaponId: mapped ?? `enka:${primitive}`
    };
  }
  const rawId = asString(weaponRecord.weaponId ?? weaponRecord.id);
  if (!rawId) {
    return undefined;
  }
  const mapped = mapping.weapons[rawId];
  if (!mapped) {
    unknownIds.push(`weapon:${rawId}`);
  }
  return {
    weaponId: mapped ?? `enka:${rawId}`,
    level: asNumber(weaponRecord.level),
    rarity: asString(weaponRecord.rarity)
  };
}

function normalizeDiscs(record: UnknownRecord, mapping: EnkaMapping, unknownIds: string[]) {
  const discs = asArray(
    record.discs ??
      record.diskDrives ??
      record.equipment ??
      record.driveDisks ??
      record.driveDiskList ??
      record.driveDisk ??
      record.diskList
  );
  if (!discs.length) {
    return undefined;
  }

  const normalized = discs
    .map((disc) => {
      const discRecord = asRecord(disc);
      if (!discRecord) {
        return null;
      }
      const rawId = asString(discRecord.discId ?? discRecord.id);
      if (!rawId) {
        return null;
      }
      const mapped = mapping.discs[rawId];
      if (!mapped) {
        unknownIds.push(`disc:${rawId}`);
      }
      return {
        discId: mapped ?? `enka:${rawId}`,
        slot: asNumber(discRecord.slot),
        set: asString(discRecord.set),
        mainStat: asString(discRecord.mainStat),
        subStats: asArray(discRecord.subStats).map((value) => String(value))
      };
    })
    .filter((value) => value !== null);

  return normalized.length ? normalized : undefined;
}

function normalizeSkills(record: UnknownRecord): Record<string, number> | undefined {
  const rawSkills = record.skills ?? record.skillLevels ?? record.skillMap;
  if (Array.isArray(rawSkills)) {
    const entries = rawSkills
      .map((item, index) => {
        const skillRecord = asRecord(item);
        const key = asString(skillRecord?.id) ?? `skill_${index + 1}`;
        const value = asNumber(skillRecord?.level ?? skillRecord?.value ?? item);
        return value !== undefined ? ([key, value] as const) : null;
      })
      .filter((entry) => entry !== null) as Array<readonly [string, number]>;
    return entries.length ? (Object.fromEntries(entries) as Record<string, number>) : undefined;
  }

  const skills = asRecord(rawSkills);
  if (!skills) {
    return undefined;
  }
  const entries = Object.entries(skills)
    .map(([key, value]) => [key, asNumber(value)] as const)
    .filter(([, value]) => value !== undefined);
  if (!entries.length) {
    return undefined;
  }
  return Object.fromEntries(entries) as Record<string, number>;
}

export function normalizeEnkaPayload(
  payload: unknown,
  mapping: EnkaMapping,
  timestampIso: string
): { agents: PlayerAgentDynamic[]; unknownIds: string[] } {
  const unknownIds: string[] = [];
  const agents = extractShowcaseAgents(payload)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        const rawId = asString(item);
        if (!rawId) {
          return null;
        }
        const agentId = mapping.characters[rawId];
        if (!agentId) {
          unknownIds.push(`character:${rawId}`);
          return null;
        }
        return {
          agentId,
          owned: true,
          source: "ENKA_SHOWCASE",
          updatedAt: timestampIso
        } satisfies PlayerAgentDynamic;
      }
      const rawId = extractId(record);
      if (!rawId) {
        return null;
      }
      const agentId = mapping.characters[rawId];
      if (!agentId) {
        unknownIds.push(`character:${rawId}`);
        return null;
      }

      const dynamic: PlayerAgentDynamic = {
        agentId,
        owned: true,
        level: asNumber(record.level ?? record.characterLevel),
        dupes: asNumber(record.dupes ?? record.rank),
        mindscape: asNumber(record.mindscape ?? record.resonance),
        weapon: normalizeWeapon(record, mapping, unknownIds),
        discs: normalizeDiscs(record, mapping, unknownIds),
        skills: normalizeSkills(record),
        source: "ENKA_SHOWCASE",
        updatedAt: timestampIso
      };

      return dynamic;
    })
    .filter((value) => value !== null) as PlayerAgentDynamic[];

  return { agents, unknownIds };
}
