import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEnkaPayload } from "../enka/normalize.js";
import type { DiscSet, EnkaMapping } from "@ika/shared";

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
const discSetMap = new Map<number, DiscSet>([
  [
    31000,
    {
      discSetId: "discset_31000",
      gameId: 31000,
      name: "Woodpecker Electro",
      iconKey: "SuitWoodpeckerElectro"
    }
  ]
]);

test("normalizeEnkaPayload skips unknown characters", () => {
  const payload = {
    showcase: {
      agents: [
        { characterId: "1001", level: 50 },
        { characterId: "9999", level: 1 }
      ]
    }
  };

  const result = normalizeEnkaPayload(payload, mapping, "2025-01-01T00:00:00.000Z", discSetMap);
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

  const result = normalizeEnkaPayload(payload, mapping, "2025-01-01T00:00:00.000Z", discSetMap);
  assert.equal(result.agents.length, 1);
  const [agent] = result.agents;
  assert.ok(agent);
  assert.equal(agent.weapon?.weaponId, "weapon_ellen_signature");
  assert.equal(agent.discs?.[0]?.discId, "disc_ice_melody");
});

test("normalizeEnkaPayload maps equipped discs with set info", () => {
  const payload = {
    showcase: {
      agents: [
        {
          characterId: "1001",
          EquippedList: [
            {
              Equipment: {
                Id: 31041,
                Level: 12,
                BreakLevel: 2,
                IsLock: 1,
                MainProperty: { PropertyId: 101, PropertyValue: 8 },
                SubPropertyList: [{ PropertyId: 201, PropertyValue: 4 }]
              }
            }
          ]
        }
      ]
    }
  };

  const result = normalizeEnkaPayload(payload, mapping, "2025-01-01T00:00:00.000Z", discSetMap);
  assert.equal(result.agents.length, 1);
  const [agent] = result.agents;
  assert.ok(agent);
  const disc = agent.discs?.[0];
  assert.equal(disc?.setGameId, 31000);
  assert.equal(disc?.slot, 1);
  assert.equal(disc?.setName, "Woodpecker Electro");
  assert.equal(disc?.mainProps?.[0]?.propertyId, 101);
  assert.equal(disc?.subProps?.[0]?.propertyId, 201);
});
