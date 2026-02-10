import type { OAuthAccount } from "@ika/shared";
import { now } from "../utils.js";

export interface OAuthAccountRecord extends OAuthAccount {
  createdAt: number;
  updatedAt: number;
}

export interface OAuthAccountPersistenceAdapter {
  findByProviderAccountId(
    provider: OAuthAccount["provider"],
    providerAccountId: string
  ): Promise<OAuthAccountRecord | null>;
  findByEmail(email: string): Promise<OAuthAccountRecord | null>;
  save(account: OAuthAccountRecord): Promise<OAuthAccountRecord>;
}

export interface OAuthAccountStore {
  findByProviderAccountId(
    provider: OAuthAccount["provider"],
    providerAccountId: string
  ): Promise<OAuthAccountRecord | null>;
  findByEmail(email: string): Promise<OAuthAccountRecord | null>;
  save(account: OAuthAccountRecord): Promise<OAuthAccountRecord>;
}

export function createOAuthAccountStore(
  adapter?: OAuthAccountPersistenceAdapter
): OAuthAccountStore {
  const byProvider = new Map<string, OAuthAccountRecord>();

  return {
    async findByProviderAccountId(provider, providerAccountId) {
      const key = `${provider}:${providerAccountId}`;
      const cached = byProvider.get(key);
      if (cached) {
        return cached;
      }
      const persisted = await adapter?.findByProviderAccountId(provider, providerAccountId);
      if (persisted) {
        byProvider.set(key, persisted);
      }
      return persisted ?? null;
    },
    async findByEmail(email) {
      for (const record of byProvider.values()) {
        if (record.email === email) {
          return record;
        }
      }
      const persisted = await adapter?.findByEmail(email);
      if (persisted) {
        byProvider.set(`${persisted.provider}:${persisted.providerAccountId}`, persisted);
      }
      return persisted ?? null;
    },
    async save(account) {
      const timestamp = now();
      const key = `${account.provider}:${account.providerAccountId}`;
      const existing = (await this.findByProviderAccountId(account.provider, account.providerAccountId)) ?? null;
      const payload: OAuthAccountRecord = {
        ...account,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      };
      byProvider.set(key, payload);
      if (adapter) {
        await adapter.save(payload);
      }
      return payload;
    }
  };
}
