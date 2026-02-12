import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryRepository } from "../repository/memory.js";
import { createMatchFromQueue } from "../services/matchService.js";
import {
  getProfileMatchHistoryPage,
  getProfileSummary
} from "../services/profileService.js";

test("getProfileSummary hides uid for public viewers when profile privacy disables uid visibility", async () => {
  const repo = createMemoryRepository();
  const user = await repo.findUser("user_lycaon");
  await repo.saveUser({
    ...user,
    privacy: { ...user.privacy, showUidPublicly: false }
  });

  const summary = await getProfileSummary(repo, "user_lycaon", {
    viewer: null,
    includeAnalytics: false
  });
  assert.equal(summary.user.verification.uid, undefined);
});

test("getProfileMatchHistoryPage returns populated history for profile owner", async () => {
  const repo = createMemoryRepository();
  const match = await createMatchFromQueue(repo, "queue_unlimited_weekly", "user_ellen", "user_lycaon");
  match.state = "RESOLVED";
  match.draft.actions = [
    {
      type: "BAN_A",
      agentId: "agent_nicole",
      userId: "user_ellen",
      timestamp: Date.now() - 9000
    },
    {
      type: "BAN_B",
      agentId: "agent_anby",
      userId: "user_lycaon",
      timestamp: Date.now() - 8000
    },
    {
      type: "PICK_A",
      agentId: "agent_ellen",
      userId: "user_ellen",
      timestamp: Date.now() - 7000
    },
    {
      type: "PICK_B",
      agentId: "agent_lycaon",
      userId: "user_lycaon",
      timestamp: Date.now() - 6000
    }
  ];
  match.evidence.result = {
    metricType: "TIME_MS",
    submittedAt: Date.now() - 5000,
    winnerUserId: "user_ellen",
    entries: [
      {
        userId: "user_ellen",
        value: 12345,
        proofUrl: "proof://ellen",
        submittedAt: Date.now() - 5000
      },
      {
        userId: "user_lycaon",
        value: 13000,
        proofUrl: "proof://lycaon",
        submittedAt: Date.now() - 5000
      }
    ]
  };
  match.resolution = {
    finalizedAt: Date.now() - 4000,
    source: "CONFIRMATION",
    winnerUserId: "user_ellen",
    ratingDelta: {
      user_ellen: 25,
      user_lycaon: -25
    }
  };
  match.updatedAt = Date.now() - 3000;
  await repo.saveMatch(match);

  const viewer = await repo.findUser("user_ellen");
  const page = await getProfileMatchHistoryPage(repo, "user_ellen", {}, 1, 20, viewer);
  assert.equal(page.total, 1);
  assert.equal(page.items[0]?.result, "W");
  assert.equal(page.items[0]?.evidenceStatus, "Verified");
  assert.match(page.items[0]?.draftSummary ?? "", /Picks:/);
});
