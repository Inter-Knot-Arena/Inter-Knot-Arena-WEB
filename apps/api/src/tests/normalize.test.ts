import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEnkaPayload } from "../enka/normalize.js";
import type { EnkaMapping } from "@ika/shared";

const mapping: EnkaMapping = {
  mappingVersion: "v1.0",
  characters: {
    "1001": "agent_ellen"
  },
  weapons: {
    "2001": "weapon_ellen_signature"
  },
  discs: {
    "3001": "disc_ice_melody"
  }
};

test("normalizeEnkaPayload skips unknown characters", () => {
  const payload = {
    showcase: {
      agents: [
        { characterId: "1001", level: 50 },
        { characterId: "9999", level: 1 }
      ]
    }
  };

  const result = normalizeEnkaPayload(payload, mapping, "2025-01-01T00:00:00.000Z");
  assert.equal(result.agents.length, 1);
  assert.ok(result.unknownIds.includes("character:9999"));
});

test("normalizeEnkaPayload maps weapons and discs", () => {
  const payload = {
    showcase: {
      agents: [
        {
          characterId: "1001",
          level: 60,
          weapon: { id: "2001", level: 10 },
          discs: [{ id: "3001", slot: 1 }]
        }
      ]
    }
  };

  const result = normalizeEnkaPayload(payload, mapping, "2025-01-01T00:00:00.000Z");
  assert.equal(result.agents.length, 1);
  assert.equal(result.agents[0].weapon?.weaponId, "weapon_ellen_signature");
  assert.equal(result.agents[0].discs?.[0].discId, "disc_ice_melody");
});
