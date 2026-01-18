import { createHash } from "node:crypto";
import { now } from "../utils";

export interface GoogleAuthState {
  codeVerifier: string;
  redirectTo: string;
  nonce: string;
  createdAt: number;
}

export interface GoogleAuthStateStore {
  save(state: string, value: GoogleAuthState): void;
  consume(state: string): GoogleAuthState | null;
}

interface GoogleTokenResponse {
  access_token?: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export function createGoogleAuthStateStore(ttlMs = 1000 * 60 * 10): GoogleAuthStateStore {
  const stateMap = new Map<string, GoogleAuthState>();

  return {
    save(state: string, value: GoogleAuthState) {
      stateMap.set(state, value);
    },
    consume(state: string) {
      const value = stateMap.get(state);
      if (!value) {
        return null;
      }
      stateMap.delete(state);
      if (now() - value.createdAt > ttlMs) {
        return null;
      }
      return value;
    }
  };
}

export function createCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildGoogleAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  nonce: string;
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("access_type", "online");
  return url.toString();
}

export async function exchangeCodeForTokens(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
    code_verifier: params.codeVerifier,
    grant_type: "authorization_code"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const payload = (await response.json()) as GoogleTokenResponse;
  if (!response.ok) {
    const message = payload.error_description ?? payload.error ?? "Failed to exchange code";
    throw new Error(message);
  }
  return payload;
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = (await response.json()) as GoogleProfile;
  if (!response.ok) {
    throw new Error("Failed to fetch Google profile");
  }
  return payload;
}

export function parseIdTokenPayload(idToken: string): Record<string, unknown> | null {
  const parts = idToken.split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
