import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { createApp } from "../app.js";

let app: FastifyInstance;
const originalRepository = process.env.IKA_REPOSITORY;

before(async () => {
  process.env.IKA_REPOSITORY = "memory";
  app = await createApp({
    logger: false,
    disableBackgroundJobs: true
  });
});

after(async () => {
  if (originalRepository === undefined) {
    delete process.env.IKA_REPOSITORY;
  } else {
    process.env.IKA_REPOSITORY = originalRepository;
  }
  await app.close();
});

test("health and metrics endpoints respond with expected payload", async () => {
  const health = await app.inject({
    method: "GET",
    url: "/health"
  });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { status: "ok" });

  const metrics = await app.inject({
    method: "GET",
    url: "/metrics"
  });
  assert.equal(metrics.statusCode, 200);
  const payload = metrics.json() as {
    enka?: {
      totals: { imports: number };
    };
  };
  assert.ok(payload.enka);
  assert.equal(payload.enka?.totals.imports, 0);
});

test("profile endpoints return summary, paged matches, and analytics", async () => {
  const users = await app.inject({
    method: "GET",
    url: "/users"
  });
  assert.equal(users.statusCode, 200);
  const userList = users.json() as Array<{ id: string }>;
  assert.ok(userList.length > 0);
  const userId = userList[0]?.id;
  assert.ok(userId);

  const summary = await app.inject({
    method: "GET",
    url: `/profiles/${userId}`
  });
  assert.equal(summary.statusCode, 200);
  const summaryBody = summary.json() as {
    user?: { id: string };
    analytics?: { matchHistory: unknown[] };
  };
  assert.equal(summaryBody.user?.id, userId);
  assert.ok(summaryBody.analytics);

  const matches = await app.inject({
    method: "GET",
    url: `/profiles/${userId}/matches?page=1&pageSize=5`
  });
  assert.equal(matches.statusCode, 200);
  const matchesBody = matches.json() as {
    page: number;
    pageSize: number;
    total: number;
    items: unknown[];
  };
  assert.equal(matchesBody.page, 1);
  assert.equal(matchesBody.pageSize, 5);
  assert.ok(Array.isArray(matchesBody.items));
  assert.ok(matchesBody.total >= matchesBody.items.length);

  const analytics = await app.inject({
    method: "GET",
    url: `/profiles/${userId}/analytics`
  });
  assert.equal(analytics.statusCode, 200);
  const analyticsBody = analytics.json() as {
    draft?: unknown;
    evidence?: unknown;
  };
  assert.ok(analyticsBody.draft);
  assert.ok(analyticsBody.evidence);
});
