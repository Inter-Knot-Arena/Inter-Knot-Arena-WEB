import { createId, now } from "../utils.js";
import type { AuditEvent, AuditQuery, AuditStore } from "./types.js";

export function createMemoryAuditStore(): AuditStore {
  const events: AuditEvent[] = [];

  return {
    async record(event) {
      const payload: AuditEvent = {
        id: event.id ?? createId("audit"),
        actorUserId: event.actorUserId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        payload: event.payload,
        createdAt: event.createdAt ?? now()
      };
      events.push(payload);
      return payload;
    },
    async list(query: AuditQuery = {}) {
      const limit = query.limit ?? 100;
      return events
        .slice()
        .reverse()
        .filter((event) => {
          if (query.actorUserId && event.actorUserId !== query.actorUserId) {
            return false;
          }
          if (query.action && event.action !== query.action) {
            return false;
          }
          if (query.entityType && event.entityType !== query.entityType) {
            return false;
          }
          return true;
        })
        .slice(0, limit);
    }
  };
}
