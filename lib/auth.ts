import { ApiError } from "./api-security.ts";

export const SESSION_COOKIE = "tabletap_session";
export const CODE_TTL_MS = 10 * 60_000;
export const CODE_COOLDOWN_MS = 60_000;
export const MAX_CODE_ATTEMPTS = 5;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

export interface AuthUser {
  id: string;
  email: string;
}
export interface StoredCode {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

/** Storage the sign-in flow needs; D1 in production, node:sqlite in the preview. */
export interface AuthStore {
  getCode(email: string): Promise<StoredCode | null> | StoredCode | null;
  putCode(email: string, code: StoredCode): Promise<void> | void;
  bumpAttempts(email: string): Promise<void> | void;
  deleteCode(email: string): Promise<void> | void;
  findUserByEmail(email: string): Promise<AuthUser | null> | AuthUser | null;
  createUser(user: AuthUser, createdAt: number): Promise<void> | void;
  createSession(session: {
    tokenHash: string;
    userId: string;
    expiresAt: number;
    createdAt: number;
  }): Promise<void> | void;
  getSessionUser(
    tokenHash: string,
    now: number,
  ): Promise<AuthUser | null> | AuthUser | null;
  deleteSession(tokenHash: string): Promise<void> | void;
  deleteExpiredSessions(userId: string, now: number): Promise<void> | void;
}

function randomHex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Compares two hashes without stopping at the first difference. */
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++)
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/** Six digits, uniformly random (values that would bias the result are redrawn). */
export function generateCode(): string {
  const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  const value = new Uint32Array(1);
  do crypto.getRandomValues(value);
  while (value[0] >= limit);
  return String(value[0] % 1_000_000).padStart(6, "0");
}

export function normalizeEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    email.length > 254 ||
    !/^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/.test(email)
  )
    throw new ApiError("Enter a valid email address.", 400);
  return email;
}

const hashCode = (email: string, code: string) => sha256(`${email}:${code}`);

export function readSessionToken(cookieHeader: string | null): string | null {
  for (const part of (cookieHeader ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) {
      const token = rest.join("=");
      return /^[a-f0-9]{64}$/.test(token) ? token : null;
    }
  }
  return null;
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure ? "; Secure" : ""}`;
}

export function clearedSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

/**
 * Stores a fresh code for the email and returns it for sending. The same
 * answer is given whether or not an account exists, so emails can't be probed.
 */
export async function createSignInCode(
  store: AuthStore,
  body: unknown,
  now = Date.now(),
): Promise<{ email: string; code: string }> {
  const email = normalizeEmail((body as { email?: unknown } | null)?.email);
  const existing = await store.getCode(email);
  if (existing && now - existing.createdAt < CODE_COOLDOWN_MS)
    throw new ApiError(
      "We just sent you a code. Wait a minute before asking for another one.",
      429,
    );
  const code = generateCode();
  await store.putCode(email, {
    codeHash: await hashCode(email, code),
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    createdAt: now,
  });
  return { email, code };
}

/**
 * Checks a code and opens a session. A first sign-in creates the account;
 * `preferredUserId` lets an existing owner keep the menu saved under their old ID.
 */
export async function verifySignInCode(
  store: AuthStore,
  body: unknown,
  {
    now = Date.now(),
    preferredUserId,
  }: { now?: number; preferredUserId?: string } = {},
): Promise<{ user: AuthUser; token: string }> {
  const row = (body ?? {}) as { email?: unknown; code?: unknown };
  const email = normalizeEmail(row.email);
  const code = typeof row.code === "string" ? row.code.replace(/\s/g, "") : "";
  if (!/^\d{6}$/.test(code))
    throw new ApiError("Enter the 6-digit code from your email.", 400);
  const stored = await store.getCode(email);
  if (!stored || stored.expiresAt <= now)
    throw new ApiError("This code has expired. Ask for a new one.", 400);
  if (stored.attempts >= MAX_CODE_ATTEMPTS) {
    await store.deleteCode(email);
    throw new ApiError("Too many wrong codes. Ask for a new one.", 429);
  }
  if (!sameHash(stored.codeHash, await hashCode(email, code))) {
    await store.bumpAttempts(email);
    throw new ApiError(
      "That code isn't right. Check your email and try again.",
      400,
    );
  }
  await store.deleteCode(email);
  let user = await store.findUserByEmail(email);
  if (!user) {
    user = { id: preferredUserId || `u_${randomHex(16)}`, email };
    await store.createUser(user, now);
  }
  const token = randomHex(32);
  await store.deleteExpiredSessions(user.id, now);
  await store.createSession({
    tokenHash: await sha256(token),
    userId: user.id,
    expiresAt: now + SESSION_TTL_MS,
    createdAt: now,
  });
  return { user, token };
}

export async function getSessionUser(
  store: AuthStore,
  cookieHeader: string | null,
  now = Date.now(),
): Promise<AuthUser | null> {
  const token = readSessionToken(cookieHeader);
  return token ? store.getSessionUser(await sha256(token), now) : null;
}

export async function endSession(
  store: AuthStore,
  cookieHeader: string | null,
): Promise<void> {
  const token = readSessionToken(cookieHeader);
  if (token) await store.deleteSession(await sha256(token));
}

export function signInEmail(code: string): {
  subject: string;
  text: string;
  html: string;
} {
  return {
    subject: `${code} is your TableTap sign-in code`,
    text: `Your TableTap sign-in code is ${code}.\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.\n\nVotre code de connexion TableTap est ${code}. Il expire dans 10 minutes.`,
    html: `<div style="font-family:system-ui,sans-serif;color:#252b20;max-width:420px">
<p>Your TableTap sign-in code:</p>
<p style="font-size:32px;letter-spacing:6px;font-weight:600;margin:16px 0">${code}</p>
<p style="color:#656b5f;font-size:14px">It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>
<p style="color:#656b5f;font-size:14px">Votre code de connexion TableTap. Il expire dans 10 minutes.</p>
</div>`,
  };
}

/** Sends the code through Resend (https://resend.com/docs/api-reference/emails/send-email). */
export async function sendCodeWithResend(
  { apiKey, from }: { apiKey: string; from: string },
  to: string,
  code: string,
): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], ...signInEmail(code) }),
  });
  if (!response.ok) {
    console.error("Resend rejected the sign-in email:", response.status);
    throw new ApiError(
      "We couldn't send your code right now. Please try again shortly.",
      503,
    );
  }
}
