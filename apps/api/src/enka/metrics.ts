export type EnkaImportStatus = "SUCCESS" | "DEGRADED" | "FAILED";

export interface EnkaMetricsSnapshot {
  totals: {
    imports: number;
    success: number;
    degraded: number;
    failed: number;
    cacheHits: number;
    networkCalls: number;
  };
  errors: {
    http403: number;
    http404: number;
    http429: number;
    http5xx: number;
    timeout: number;
    other: number;
  };
  latencyMs: {
    avg: number | null;
    p95: number | null;
    last: number | null;
  };
  lastError?: {
    kind: string;
    message: string;
    at: string;
  };
  updatedAt: string;
}

interface EnkaImportMetricsState {
  imports: number;
  success: number;
  degraded: number;
  failed: number;
  cacheHits: number;
  networkCalls: number;
  errors: EnkaMetricsSnapshot["errors"];
  latenciesMs: number[];
  lastLatencyMs: number | null;
  lastError?: EnkaMetricsSnapshot["lastError"];
  updatedAt: number;
}

const MAX_LATENCY_SAMPLES = 200;

const state: EnkaImportMetricsState = {
  imports: 0,
  success: 0,
  degraded: 0,
  failed: 0,
  cacheHits: 0,
  networkCalls: 0,
  errors: {
    http403: 0,
    http404: 0,
    http429: 0,
    http5xx: 0,
    timeout: 0,
    other: 0
  },
  latenciesMs: [],
  lastLatencyMs: null,
  updatedAt: Date.now()
};

export function recordEnkaImportEvent(params: {
  status: EnkaImportStatus;
  fromCache: boolean;
  latencyMs?: number;
  error?: unknown;
}): void {
  state.imports += 1;
  if (params.status === "SUCCESS") {
    state.success += 1;
  } else if (params.status === "DEGRADED") {
    state.degraded += 1;
  } else {
    state.failed += 1;
  }

  if (params.fromCache) {
    state.cacheHits += 1;
  } else {
    state.networkCalls += 1;
  }

  if (Number.isFinite(params.latencyMs)) {
    const value = Math.max(0, Math.trunc(Number(params.latencyMs)));
    state.latenciesMs.push(value);
    if (state.latenciesMs.length > MAX_LATENCY_SAMPLES) {
      state.latenciesMs.shift();
    }
    state.lastLatencyMs = value;
  }

  if (params.error) {
    const kind = classifyErrorKind(params.error);
    if (kind in state.errors) {
      state.errors[kind as keyof EnkaMetricsSnapshot["errors"]] += 1;
    } else {
      state.errors.other += 1;
    }
    const message = params.error instanceof Error ? params.error.message : String(params.error);
    state.lastError = {
      kind,
      message,
      at: new Date().toISOString()
    };
  }

  state.updatedAt = Date.now();
}

export function getEnkaMetricsSnapshot(): EnkaMetricsSnapshot {
  const latencies = state.latenciesMs.slice().sort((a, b) => a - b);
  const average =
    latencies.length > 0
      ? Number((latencies.reduce((sum, item) => sum + item, 0) / latencies.length).toFixed(1))
      : null;
  const p95 =
    latencies.length > 0
      ? latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)] ?? null
      : null;

  return {
    totals: {
      imports: state.imports,
      success: state.success,
      degraded: state.degraded,
      failed: state.failed,
      cacheHits: state.cacheHits,
      networkCalls: state.networkCalls
    },
    errors: {
      ...state.errors
    },
    latencyMs: {
      avg: average,
      p95,
      last: state.lastLatencyMs
    },
    lastError: state.lastError,
    updatedAt: new Date(state.updatedAt).toISOString()
  };
}

export function resetEnkaMetricsForTests(): void {
  state.imports = 0;
  state.success = 0;
  state.degraded = 0;
  state.failed = 0;
  state.cacheHits = 0;
  state.networkCalls = 0;
  state.errors = {
    http403: 0,
    http404: 0,
    http429: 0,
    http5xx: 0,
    timeout: 0,
    other: 0
  };
  state.latenciesMs = [];
  state.lastLatencyMs = null;
  state.lastError = undefined;
  state.updatedAt = Date.now();
}

function classifyErrorKind(error: unknown): string {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : NaN;

  if (Number.isFinite(status)) {
    if (status === 403) {
      return "http403";
    }
    if (status === 404) {
      return "http404";
    }
    if (status === 429) {
      return "http429";
    }
    if (status >= 500) {
      return "http5xx";
    }
  }

  if (error instanceof Error && error.name === "AbortError") {
    return "timeout";
  }

  return "other";
}
