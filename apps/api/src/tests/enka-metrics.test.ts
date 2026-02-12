import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getEnkaMetricsSnapshot,
  recordEnkaImportEvent,
  resetEnkaMetricsForTests
} from "../enka/metrics.js";

test("recordEnkaImportEvent tracks success/degraded/failed totals", () => {
  resetEnkaMetricsForTests();
  recordEnkaImportEvent({ status: "SUCCESS", fromCache: true });
  recordEnkaImportEvent({ status: "DEGRADED", fromCache: false, latencyMs: 320 });
  recordEnkaImportEvent({
    status: "FAILED",
    fromCache: false,
    latencyMs: 810,
    error: { status: 429, message: "rate limited" }
  });

  const metrics = getEnkaMetricsSnapshot();
  assert.equal(metrics.totals.imports, 3);
  assert.equal(metrics.totals.success, 1);
  assert.equal(metrics.totals.degraded, 1);
  assert.equal(metrics.totals.failed, 1);
  assert.equal(metrics.totals.cacheHits, 1);
  assert.equal(metrics.totals.networkCalls, 2);
  assert.equal(metrics.errors.http429, 1);
  assert.equal(metrics.latencyMs.last, 810);
  assert.equal(metrics.latencyMs.p95, 810);
  assert.equal(metrics.lastError?.kind, "http429");
});

test("recordEnkaImportEvent classifies timeout as timeout error bucket", () => {
  resetEnkaMetricsForTests();
  const timeoutError = new Error("timed out");
  timeoutError.name = "AbortError";

  recordEnkaImportEvent({
    status: "FAILED",
    fromCache: false,
    latencyMs: 1500,
    error: timeoutError
  });

  const metrics = getEnkaMetricsSnapshot();
  assert.equal(metrics.errors.timeout, 1);
  assert.equal(metrics.lastError?.kind, "timeout");
});
