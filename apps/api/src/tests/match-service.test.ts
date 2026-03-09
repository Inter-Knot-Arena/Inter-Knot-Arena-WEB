import test from "node:test";
import assert from "node:assert/strict";
import type { EvidenceRecord, ResultProof } from "@ika/shared";
import { createMemoryRepository } from "../repository/memory.js";
import { createMatchFromQueue, recordResult } from "../services/matchService.js";

function createPassEvidence(userId: string, type: "PRECHECK" | "INRUN"): EvidenceRecord {
  return {
    id: `${type.toLowerCase()}-${userId}`,
    type,
    timestamp: Date.now(),
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

function createResult(userId: string): ResultProof {
  return {
    metricType: "TIME_MS",
    submittedAt: Date.now(),
    userId,
    value: 12345,
    proofUrl: "proof://result",
    entries: [
      {
        userId,
        value: 12345,
        proofUrl: "proof://result",
        submittedAt: Date.now()
      }
    ]
  };
}

test("recordResult requires in-run evidence from both players when ruleset demands it", async () => {
  const repo = createMemoryRepository();
  const match = await createMatchFromQueue(repo, "queue_standard_weekly", "user_ellen", "user_lycaon");
  const prepared = {
    ...match,
    state: "IN_PROGRESS" as const,
    evidence: {
      ...match.evidence,
      precheck: [
        createPassEvidence("user_ellen", "PRECHECK"),
        createPassEvidence("user_lycaon", "PRECHECK")
      ],
      inrun: [createPassEvidence("user_ellen", "INRUN")]
    },
    updatedAt: Date.now()
  };

  await repo.saveMatch(prepared);

  await assert.rejects(
    () => recordResult(repo, match.id, createResult("user_ellen")),
    /in-run evidence from both players/
  );
});
