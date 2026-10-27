import { and, eq, gt, lte } from "drizzle-orm";
import { getDb } from "../db";
import { loginCodes, sessions, users } from "../db/schema";
import type { AuthStore } from "./auth";

/** D1-backed sign-in storage for production. */
export function d1AuthStore(): AuthStore {
  const db = getDb();
  return {
    async getCode(email) {
      const [row] = await db
        .select()
        .from(loginCodes)
        .where(eq(loginCodes.email, email))
        .limit(1);
      return row ?? null;
    },
    async putCode(email, code) {
      await db
        .insert(loginCodes)
        .values({ email, ...code })
        .onConflictDoUpdate({ target: loginCodes.email, set: code });
    },
    async bumpAttempts(email) {
      const [row] = await db
        .select({ attempts: loginCodes.attempts })
        .from(loginCodes)
        .where(eq(loginCodes.email, email))
        .limit(1);
      if (row)
        await db
          .update(loginCodes)
          .set({ attempts: row.attempts + 1 })
          .where(eq(loginCodes.email, email));
    },
    async deleteCode(email) {
      await db.delete(loginCodes).where(eq(loginCodes.email, email));
    },
    async findUserByEmail(email) {
      const [row] = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return row ?? null;
    },
    async createUser(user, createdAt) {
      await db.insert(users).values({ ...user, createdAt });
    },
    async createSession(session) {
      await db.insert(sessions).values(session);
    },
    async getSessionUser(tokenHash, now) {
      const [row] = await db
        .select({ id: users.id, email: users.email })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(
          and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)),
        )
        .limit(1);
      return row ?? null;
    },
    async deleteSession(tokenHash) {
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    },
    async deleteExpiredSessions(userId, now) {
      await db
        .delete(sessions)
        .where(and(eq(sessions.userId, userId), lte(sessions.expiresAt, now)));
    },
  };
}
