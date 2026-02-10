export interface IdempotencyReplay {
  statusCode: number;
  responseBody: unknown;
}

export interface IdempotencySaveInput {
  key: string;
  scope: string;
  actorUserId: string;
  statusCode: number;
  responseBody: unknown;
  ttlMs: number;
}

export interface IdempotencyStore {
  find(key: string, scope: string, actorUserId: string): Promise<IdempotencyReplay | null>;
  save(input: IdempotencySaveInput): Promise<void>;
  purgeExpired(referenceTimestamp?: number): Promise<void>;
}
