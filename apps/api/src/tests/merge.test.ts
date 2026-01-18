import { test } from "node:test";
import assert from "node:assert/strict";
import { mergePlayerAgentDynamic } from "@ika/shared";
import type { PlayerAgentDynamic } from "@ika/shared";

test("mergePlayerAgentDynamic respects source priority", () => {
  const existing: PlayerAgentDynamic = {
    agentId: "agent_ellen",
    owned: true,
    level: 60,
    source: "VERIFIER_OCR",
    updatedAt: "2025-01-01T00:00:00.000Z"
  };
  const incoming: PlayerAgentDynamic = {
    agentId: "agent_ellen",
    owned: true,
    level: 50,
    source: "ENKA_SHOWCASE",
    updatedAt: "2025-01-02T00:00:00.000Z"
  };

  const merged = mergePlayerAgentDynamic(existing, incoming);
  assert.equal(merged.level, 60);
  assert.equal(merged.source, "VERIFIER_OCR");
});

test("mergePlayerAgentDynamic upgrades lower priority data", () => {
  const existing: PlayerAgentDynamic = {
    agentId: "agent_ellen",
    owned: false,
    level: 10,
    source: "MANUAL",
    updatedAt: "2025-01-01T00:00:00.000Z"
  };
  const incoming: PlayerAgentDynamic = {
    agentId: "agent_ellen",
    owned: true,
    level: 30,
    source: "ENKA_SHOWCASE",
    updatedAt: "2025-01-02T00:00:00.000Z"
  };

  const merged = mergePlayerAgentDynamic(existing, incoming);
  assert.equal(merged.level, 30);
  assert.equal(merged.owned, true);
  assert.equal(merged.source, "ENKA_SHOWCASE");
});
