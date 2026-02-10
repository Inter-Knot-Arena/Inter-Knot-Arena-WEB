import type { Pool } from "pg";
import { getPool } from "../db/pool.js";
import { createId, now } from "../utils.js";
import type { AuditEvent, AuditQuery, AuditStore } from "./types.js";

export function createPostgresAuditStore(pool: Pool = getPool()): AuditStore {
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
      await pool.query(
        `INSERT INTO audit_logs (
           id,
           actor_user_id,
           action,
           entity_type,
           entity_id,
           payload,
           created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          payload.id,
          payload.actorUserId ?? null,
          payload.action,
          payload.entityType,
          payload.entityId ?? null,
          payload.payload ? JSON.stringify(payload.payload) : null,
          payload.createdAt
        ]
      );
      return payload;
    },
    async list(query: AuditQuery = {}) {
      const limit = query.limit ?? 100;
      const values: unknown[] = [];
      const where: string[] = [];

      if (query.actorUserId) {
        values.push(query.actorUserId);
        where.push(`actor_user_id = $${values.length}`);
      }
      if (query.action) {
        values.push(query.action);
        where.push(`action = $${values.length}`);
      }
      if (query.entityType) {
        values.push(query.entityType);
        where.push(`entity_type = $${values.length}`);
      }
      values.push(limit);
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const result = await pool.query(
        `SELECT *
         FROM audit_logs
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT $${values.length}`,
        values
      );
      return result.rows.map(mapAuditEvent);
    }
  };
}

function mapAuditEvent(row: Record<string, unknown>): AuditEvent {
  return {
    id: String(row.id),
    actorUserId: (row.actor_user_id as string | null) ?? undefined,
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: (row.entity_id as string | null) ?? undefined,
    payload: row.payload ?? undefined,
    createdAt: toNumber(row.created_at)
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
}
