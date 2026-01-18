import type { OAuthAccount } from "@ika/shared";
import { now } from "../utils.js";

export interface OAuthAccountRecord extends OAuthAccount {
  createdAt: number;
  updatedAt: number;
}

export interface OAuthAccountStore {
  findByProviderAccountId(provider: OAuthAccount["provider"], providerAccountId: string): OAuthAccountRecord | null;
  findByEmail(email: string): OAuthAccountRecord | null;
  save(account: OAuthAccountRecord): OAuthAccountRecord;
}

export function createOAuthAccountStore(): OAuthAccountStore {
  const byProvider = new Map<string, OAuthAccountRecord>();

  return {
    findByProviderAccountId(provider, providerAccountId) {
      return byProvider.get(`${provider}:${providerAccountId}`) ?? null;
    },
    findByEmail(email) {
      for (const record of byProvider.values()) {
        if (record.email === email) {
          return record;
        }
      }
      return null;
    },
    save(account) {
      const timestamp = now();
      const existing = this.findByProviderAccountId(account.provider, account.providerAccountId);
      const payload: OAuthAccountRecord = {
        ...account,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      };
      byProvider.set(`${account.provider}:${account.providerAccountId}`, payload);
      return payload;
    }
  };
}
