import {
  assertSameOrigin,
  jsonResponse,
  routeError,
} from "../../../../lib/api-security";
import { clearedSessionCookie, endSession } from "../../../../lib/auth";
import { d1AuthStore } from "../../../../lib/auth-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await endSession(d1AuthStore(), request.headers.get("cookie"));
    const secure = new URL(request.url).protocol === "https:";
    return jsonResponse({ signedOut: true }, 200, {
      "Set-Cookie": clearedSessionCookie(secure),
    });
  } catch (error) {
    return routeError(error);
  }
}
