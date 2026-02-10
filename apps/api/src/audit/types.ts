export interface AuditEvent {
  id: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  payload?: unknown;
  createdAt: number;
}

export interface AuditQuery {
  limit?: number;
  actorUserId?: string;
  action?: string;
  entityType?: string;
}

export interface AuditStore {
  record(event: Omit<AuditEvent, "id" | "createdAt"> & Partial<Pick<AuditEvent, "id" | "createdAt">>): Promise<AuditEvent>;
  list(query?: AuditQuery): Promise<AuditEvent[]>;
}
