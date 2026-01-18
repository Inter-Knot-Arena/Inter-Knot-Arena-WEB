import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { PasswordAccount } from "@ika/shared";
import { now } from "../utils.js";

export interface PasswordAccountRecord extends PasswordAccount {
  createdAt: number;
  updatedAt: number;
}

export interface PasswordAccountStore {
  findByEmail(email: string): PasswordAccountRecord | null;
  findByUserId(userId: string): PasswordAccountRecord | null;
  save(account: PasswordAccountRecord): PasswordAccountRecord;
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

export function createPasswordAccountStore(): PasswordAccountStore {
  const byEmail = new Map<string, PasswordAccountRecord>();

  return {
    findByEmail(email) {
      return byEmail.get(normalizeEmail(email)) ?? null;
    },
    findByUserId(userId) {
      for (const account of byEmail.values()) {
        if (account.userId === userId) {
          return account;
        }
      }
      return null;
    },
    save(account) {
      const timestamp = now();
      const normalizedEmail = normalizeEmail(account.email);
      const existing = byEmail.get(normalizedEmail);
      const payload: PasswordAccountRecord = {
        ...account,
        email: normalizedEmail,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      };
      byEmail.set(normalizedEmail, payload);
      return payload;
    }
  };
}
