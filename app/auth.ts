import { headers } from "next/headers";
import { getSessionUser } from "../lib/auth";
import { d1AuthStore } from "../lib/auth-store";

export type OwnerUser = {
  userId: string;
  email: string;
};

/** The owner signed in with an emailed code, from the session cookie. */
export async function getCurrentUser(): Promise<OwnerUser | null> {
  const requestHeaders = await headers();
  const user = await getSessionUser(
    d1AuthStore(),
    requestHeaders.get("cookie"),
  );
  return user ? { userId: user.id, email: user.email } : null;
}
