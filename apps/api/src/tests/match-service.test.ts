import test from "node:test";
import assert from "node:assert/strict";
import type { EvidenceRecord, ResultProof } from "@ika/shared";
import { createMemoryRepository } from "../repository/memory.js";
import { createMatchFromQueue, recordResult } from "../services/matchService.js";

function createPassEvidence(
  userId: string,
  type: "PRECHECK" | "INRUN",
  timestamp = Date.now()
): EvidenceRecord {
  return {
    id: `${type.toLowerCase()}-${userId}`,
    type,
    timestamp,
    userId,
    detectedAgents: ["agent_anby", "agent_nicole", "agent_ellen"],
    confidence: {
      agent_anby: 0.95,
      agent_nicole: 0.94,
      agent_ellen: 0.93
    },
    result: "PASS",
    frameHash: `frame-${type.toLowerCase()}-${userId}`
  };
}

function createResult(userId: string, submittedAt = Date.now()): ResultProof {
  return {
    metricType: "TIME_MS",
    submittedAt,
    userId,
    value: 12345,
    proofUrl: "proof://result",
    entries: [
      {
        userId,
        value: 12345,
        proofUrl: "proof://result",
        submittedAt
      }
    ]
  };
}

test("recordResult requires in-run evidence from both players when ruleset demands it", async () => {
  const repo = createMemoryRepository();
  const match = await createMatchFromQueue(repo, "queue_standard_weekly", "user_ellen", "user_lycaon");
  const ruleset = await repo.findRuleset(match.rulesetId);
  const frequencyMs = ruleset.inrunFrequencySec * 1000;
  const readyAt = 20_000;
  const prepared = {
    ...match,
    state: "IN_PROGRESS" as const,
    evidence: {
      ...match.evidence,
      precheck: [
        createPassEvidence("user_ellen", "PRECHECK", readyAt - 500),
        createPassEvidence("user_lycaon", "PRECHECK", readyAt)
      ],
      inrun: [createPassEvidence("user_ellen", "INRUN", readyAt + frequencyMs + 100)]
    },
    updatedAt: readyAt + frequencyMs + 100
  };

  await repo.saveMatch(prepared);

  await assert.rejects(
    () => recordResult(repo, match.id, createResult("user_ellen", readyAt + frequencyMs + 500)),
    /1 covered in-run interval/
  );
});

test("recordResult requires covered in-run intervals across the full match duration", async () => {
  const repo = createMemoryRepository();
  const match = await createMatchFromQueue(repo, "queue_standard_weekly", "user_ellen", "user_lycaon");
  const ruleset = await repo.findRuleset(match.rulesetId);
  const frequencyMs = ruleset.inrunFrequencySec * 1000;
  const readyAt = 40_000;
  const firstIntervalAt = readyAt + frequencyMs + 100;
  const resultAt = readyAt + frequencyMs * 2 + 1_000;
  const prepared = {
    ...match,
    state: "IN_PROGRESS" as const,
    evidence: {
      ...match.evidence,
      precheck: [
        createPassEvidence("user_ellen", "PRECHECK", readyAt - 250),
        createPassEvidence("user_lycaon", "PRECHECK", readyAt)
      ],
      inrun: [
        createPassEvidence("user_ellen", "INRUN", firstIntervalAt),
        createPassEvidence("user_lycaon", "INRUN", firstIntervalAt + 150)
      ]
    },
    updatedAt: firstIntervalAt + 150
  };

  await repo.saveMatch(prepared);

  await assert.rejects(
    () => recordResult(repo, match.id, createResult("user_ellen", resultAt)),
    /2 covered in-run intervals/
  );
});

test("recordResult allows short matches below the in-run interval without extra evidence", async () => {
  const repo = createMemoryRepository();
  const match = await createMatchFromQueue(repo, "queue_standard_weekly", "user_ellen", "user_lycaon");
  const ruleset = await repo.findRuleset(match.rulesetId);
  const frequencyMs = ruleset.inrunFrequencySec * 1000;
  const readyAt = 60_000;
  const prepared = {
    ...match,
    state: "READY_TO_START" as const,
    evidence: {
      ...match.evidence,
      precheck: [
        createPassEvidence("user_ellen", "PRECHECK", readyAt - 250),
        createPassEvidence("user_lycaon", "PRECHECK", readyAt)
      ],
      inrun: []
    },
    updatedAt: readyAt
  };

  await repo.saveMatch(prepared);

  const updated = await recordResult(
    repo,
    match.id,
    createResult("user_ellen", readyAt + frequencyMs - 1_000)
  );
  assert.equal(updated.state, "AWAITING_CONFIRMATION");
});
