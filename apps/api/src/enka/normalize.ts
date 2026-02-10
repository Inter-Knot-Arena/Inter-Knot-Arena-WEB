import type { DiscProperty, DiscSet, EnkaMapping, PlayerAgentDynamic } from "@ika/shared";

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

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === 1 || value === 0) {
    return Boolean(value);
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
  }
  return undefined;
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

function normalizeDiscProps(value: unknown): DiscProperty[] | undefined {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const normalized = list
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const propertyId =
        asNumber(record.PropertyId ?? record.propertyId ?? record.Id ?? record.id ?? record.propertyType);
      if (propertyId === undefined) {
        return null;
      }
      const level = asNumber(record.Level ?? record.level ?? record.PropertyLevel ?? record.propertyLevel);
      const rawValue =
        asNumber(record.Value ?? record.value ?? record.PropertyValue ?? record.propertyValue) ??
        (asString(record.Value ?? record.value ?? record.PropertyValue ?? record.propertyValue) ??
          undefined);
      return {
        propertyId,
        level,
        value: rawValue
      } satisfies DiscProperty;
    })
    .filter((item) => item !== null) as DiscProperty[];
  return normalized.length ? normalized : undefined;
}

function extractEquippedList(record: UnknownRecord): UnknownRecord[] {
  const list = asArray(
    record.EquippedList ??
      record.equippedList ??
      record.equipmentList ??
      record.equipList ??
      record.equipments ??
      record.equipment
  );
  return list.map((item) => asRecord(item)).filter((item): item is UnknownRecord => Boolean(item));
}

function extractEquipment(record: UnknownRecord): UnknownRecord | null {
  return (
    asRecord(record.Equipment) ??
    asRecord(record.equipment) ??
    asRecord(record.driveDisk) ??
    asRecord(record.disc) ??
    asRecord(record.item) ??
    record
  );
}

function normalizeEquippedDiscs(
  record: UnknownRecord,
  discSetMap?: Map<number, DiscSet>
): PlayerAgentDynamic["discs"] | undefined {
  const equipped = extractEquippedList(record);
  if (!equipped.length) {
    return undefined;
  }

  const discs = equipped
    .map((entry) => {
      const equipment = extractEquipment(entry);
      if (!equipment) {
        return null;
      }
      const pieceId = asNumber(equipment.Id ?? equipment.id ?? equipment.pieceId ?? equipment.equipmentId);
      if (!pieceId) {
        return null;
      }
      const setGameId = Math.floor(pieceId / 100) * 100;
      const slot = pieceId % 10;
      const discSet = discSetMap?.get(setGameId);
      const setName = discSet?.name ?? `Unknown set ${setGameId}`;
      const setId = discSet?.discSetId ?? `discset_${setGameId}`;
      const setIconKey = discSet?.iconKey;

      return {
        discId: `disc_${pieceId}`,
        pieceGameId: pieceId,
        setGameId,
        slot,
        setId,
        setName,
        setIconKey,
        mainProps: normalizeDiscProps(
          equipment.MainProperty ?? equipment.mainProperty ?? equipment.mainProps
        ),
        subProps: normalizeDiscProps(
          equipment.SubPropertyList ?? equipment.subPropertyList ?? equipment.subProps
        ),
        level: asNumber(equipment.Level ?? equipment.level),
        breakLevel: asNumber(equipment.BreakLevel ?? equipment.breakLevel),
        isLocked: asBoolean(equipment.IsLock ?? equipment.isLocked)
      };
    })
    .filter((item) => item !== null);

  return discs.length ? (discs as PlayerAgentDynamic["discs"]) : undefined;
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
      weaponId: mapped ?? `enka:${primitive}`,
      gameId: asNumber(primitive)
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
    gameId: asNumber(rawId),
    level: asNumber(weaponRecord.level),
    breakLevel: asNumber(weaponRecord.breakLevel ?? weaponRecord.break ?? weaponRecord.promoteLevel),
    rarity: asString(weaponRecord.rarity) ?? undefined
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
        set: asString(discRecord.set) ?? undefined,
        mainStat: asString(discRecord.mainStat) ?? undefined,
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
  timestampIso: string,
  discSetMap?: Map<number, DiscSet>
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
          agentGameId: asNumber(rawId),
          owned: true,
          source: "ENKA_SHOWCASE",
          updatedAt: timestampIso
        } satisfies PlayerAgentDynamic;
      }
      const rawId = extractId(record);
      if (!rawId) {
        return null;
      }
      const agentGameId = asNumber(rawId);
      const agentId = mapping.characters[rawId];
      if (!agentId) {
        unknownIds.push(`character:${rawId}`);
        return null;
      }

      const dynamic: PlayerAgentDynamic = {
        agentId,
        agentGameId,
        owned: true,
        level: asNumber(record.level ?? record.characterLevel),
        dupes: asNumber(record.dupes ?? record.rank),
        mindscape: asNumber(record.mindscape ?? record.resonance),
        promotion: asNumber(record.promotion ?? record.promotionLevel ?? record.ascension),
        talent: asNumber(record.talent ?? record.talentLevel ?? record.coreSkillLevel),
        core: asNumber(record.core ?? record.coreLevel ?? record.coreSkill),
        weapon: normalizeWeapon(record, mapping, unknownIds),
        discs: normalizeEquippedDiscs(record, discSetMap) ?? normalizeDiscs(record, mapping, unknownIds),
        skills: normalizeSkills(record),
        source: "ENKA_SHOWCASE",
        updatedAt: timestampIso
      };

      return dynamic;
    })
    .filter((value) => value !== null) as PlayerAgentDynamic[];

  return { agents, unknownIds };
}
