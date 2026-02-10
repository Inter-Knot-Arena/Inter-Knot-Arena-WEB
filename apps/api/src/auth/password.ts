import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { PasswordAccount } from "@ika/shared";
import { now } from "../utils.js";

export interface PasswordAccountRecord extends PasswordAccount {
  createdAt: number;
  updatedAt: number;
}

export interface PasswordAccountPersistenceAdapter {
  findByEmail(email: string): Promise<PasswordAccountRecord | null>;
  findByUserId(userId: string): Promise<PasswordAccountRecord | null>;
  save(account: PasswordAccountRecord): Promise<PasswordAccountRecord>;
}

export interface PasswordAccountStore {
  findByEmail(email: string): Promise<PasswordAccountRecord | null>;
  findByUserId(userId: string): Promise<PasswordAccountRecord | null>;
  save(account: PasswordAccountRecord): Promise<PasswordAccountRecord>;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const resolvedSalt = salt ?? randomBytes(16).toString("base64");
  const hash = scryptSync(password, resolvedSalt, 64).toString("base64");
  return { hash, salt: resolvedSalt };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "base64");
  if (candidate.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(candidate, expected);
}

export function createPasswordAccountStore(
  adapter?: PasswordAccountPersistenceAdapter
): PasswordAccountStore {
  const byEmail = new Map<string, PasswordAccountRecord>();

  return {
    async findByEmail(email) {
      const normalized = normalizeEmail(email);
      const cached = byEmail.get(normalized);
      if (cached) {
        return cached;
      }
      const persisted = await adapter?.findByEmail(normalized);
      if (persisted) {
        byEmail.set(normalized, persisted);
      }
      return persisted ?? null;
    },
    async findByUserId(userId) {
      for (const account of byEmail.values()) {
        if (account.userId === userId) {
          return account;
        }
      }
      const persisted = await adapter?.findByUserId(userId);
      if (persisted) {
        byEmail.set(normalizeEmail(persisted.email), persisted);
      }
      return persisted ?? null;
    },
    async save(account) {
      const timestamp = now();
      const normalizedEmail = normalizeEmail(account.email);
      const existing = await this.findByEmail(normalizedEmail);
      const payload: PasswordAccountRecord = {
        ...account,
        email: normalizedEmail,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      };
      byEmail.set(normalizedEmail, payload);
      if (adapter) {
        await adapter.save(payload);
      }
      return payload;
    }
  };
}
