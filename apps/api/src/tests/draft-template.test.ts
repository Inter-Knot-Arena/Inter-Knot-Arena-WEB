import test from "node:test";
import assert from "node:assert/strict";
import { getDraftTemplate, nextDraftAction } from "@ika/shared";

test("bo3 draft template uses a full series sequence", () => {
  const bo1 = getDraftTemplate("bo1-standard");
  const bo3 = getDraftTemplate("bo3-standard");

  assert.ok(bo3.sequence.length > bo1.sequence.length);
  assert.equal(bo3.sequence.length, 24);
  assert.equal(bo3.sequence[0], "BAN_A");
  assert.equal(bo3.sequence[8], "BAN_B");
  assert.equal(bo3.sequence[16], "BAN_A");
});

test("nextDraftAction advances through bo3 sequence", () => {
  const bo3 = getDraftTemplate("bo3-standard");
  const actions = bo3.sequence.slice(0, 10).map((type, index) => ({
    type,
    agentId: `agent_${index}`,
    userId: type.endsWith("_A") ? "user_a" : "user_b",
    timestamp: index
  }));

  const next = nextDraftAction(bo3, actions);
  assert.equal(next, bo3.sequence[10]);
});
