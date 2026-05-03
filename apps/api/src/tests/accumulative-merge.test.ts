import { test } from "node:test";
import assert from "node:assert/strict";
import { mergePlayerAgentDynamicAccumulative } from "@ika/shared";
import type { PlayerAgentDynamic } from "@ika/shared";

test("mergePlayerAgentDynamicAccumulative keeps highest numeric progress", () => {
  const existing: PlayerAgentDynamic = {
    agentId: "agent_ellen",
    owned: true,
    level: 60,
    dupes: 2,
    mindscape: 1,
    promotion: 3,
    source: "VERIFIER_OCR",
    updatedAt: "2025-01-01T00:00:00.000Z"
  };
  const incoming: PlayerAgentDynamic = {
    agentId: "agent_ellen",
    owned: true,
    level: 55,
    dupes: 1,
    mindscape: 0,
    promotion: 2,
    source: "VERIFIER_OCR",
    updatedAt: "2025-01-02T00:00:00.000Z"
  };

  const merged = mergePlayerAgentDynamicAccumulative(existing, incoming);
  assert.equal(merged.level, 60);
  assert.equal(merged.dupes, 2);
  assert.equal(merged.mindscape, 1);
  assert.equal(merged.promotion, 3);
});

test("mergePlayerAgentDynamicAccumulative merges skills by max per key", () => {
  const existing: PlayerAgentDynamic = {
    agentId: "agent_ellen",
    owned: true,
    skills: { basic: 10, skill: 4 },
    source: "VERIFIER_OCR",
    updatedAt: "2025-01-01T00:00:00.000Z"
  };
  const incoming: PlayerAgentDynamic = {
    agentId: "agent_ellen",
    owned: true,
    skills: { basic: 8, skill: 6, ult: 3 },
    source: "VERIFIER_OCR",
    updatedAt: "2025-01-02T00:00:00.000Z"
  };

  const merged = mergePlayerAgentDynamicAccumulative(existing, incoming);
  assert.equal(merged.skills?.basic, 10);
  assert.equal(merged.skills?.skill, 6);
  assert.equal(merged.skills?.ult, 3);
});

test("mergePlayerAgentDynamicAccumulative merges discs per slot without losing data", () => {
  const existing: PlayerAgentDynamic = {
    agentId: "agent_ellen",
    owned: true,
    discs: [
      { discId: "disc_31041", slot: 1, setName: "Woodpecker Electro", level: 12 },
      { discId: "disc_32042", slot: 2, setName: "Inferno Metal", level: 6 }
    ],
    source: "VERIFIER_OCR",
    updatedAt: "2025-01-01T00:00:00.000Z"
  };
  const incoming: PlayerAgentDynamic = {
    agentId: "agent_ellen",
    owned: true,
    discs: [
      { discId: "disc_99992", slot: 2, setName: "Unknown set 32000", level: 4 }
    ],
    source: "VERIFIER_OCR",
    updatedAt: "2025-01-02T00:00:00.000Z"
  };

  const merged = mergePlayerAgentDynamicAccumulative(existing, incoming);
  const slot1 = merged.discs?.find((disc) => disc.slot === 1);
  const slot2 = merged.discs?.find((disc) => disc.slot === 2);

  assert.equal(slot1?.setName, "Woodpecker Electro");
  assert.equal(slot2?.setName, "Inferno Metal");
  assert.equal(slot2?.level, 6);
});
