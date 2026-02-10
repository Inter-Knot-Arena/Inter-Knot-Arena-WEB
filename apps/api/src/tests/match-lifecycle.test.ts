import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryRepository } from "../repository/memory.js";
import { createMatchFromQueue, markCheckin } from "../services/matchService.js";
import { runMatchLifecycle, type MatchLifecycleConfig } from "../services/matchLifecycleService.js";

const FAST_CONFIG: MatchLifecycleConfig = {
  checkinTimeoutMs: 1,
  draftActionTimeoutMs: 1,
  precheckTimeoutMs: 1,
  confirmationTimeoutMs: 1
};

test("runMatchLifecycle resolves no-show in checkin state", async () => {
  const repo = createMemoryRepository();
  const match = await createMatchFromQueue(repo, "queue_standard_weekly", "user_ellen", "user_lycaon");
  await markCheckin(repo, match.id, "user_ellen");

  await runMatchLifecycle(repo, FAST_CONFIG, match.createdAt + 10_000);
  const resolved = await repo.findMatch(match.id);

  assert.equal(resolved.state, "RESOLVED");
  assert.equal(resolved.resolution?.winnerUserId, "user_ellen");
});

test("runMatchLifecycle auto-picks for draft timeout", async () => {
  const repo = createMemoryRepository();
  const match = await createMatchFromQueue(repo, "queue_unlimited_weekly", "user_ellen", "user_lycaon");
  await markCheckin(repo, match.id, "user_ellen");
  await markCheckin(repo, match.id, "user_lycaon");

  const before = await repo.findMatch(match.id);
  assert.equal(before.state, "DRAFTING");
  assert.equal(before.draft.actions.length, 0);

  await runMatchLifecycle(repo, FAST_CONFIG, before.updatedAt + 10_000);
  const after = await repo.findMatch(match.id);

  assert.equal(after.draft.actions.length, 1);
  assert.equal(after.draft.actions[0]?.type, "BAN_A");
});
