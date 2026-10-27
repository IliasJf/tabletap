import { getChatGPTUser } from "../../../chatgpt-auth";
import {
  assertSameOrigin,
  jsonResponse,
  readBoundedJson,
  routeError,
} from "../../../../lib/api-security";
import {
  normalizeEmail,
  sessionCookie,
  verifySignInCode,
} from "../../../../lib/auth";
import { d1AuthStore } from "../../../../lib/auth-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readBoundedJson(request, 1_000);
    // An owner who built a menu under ChatGPT sign-in keeps it when they sign
    // in by email with the same address while that platform session is active.
    const legacy = await getChatGPTUser();
    const email = normalizeEmail((body as { email?: unknown } | null)?.email);
    const { user, token } = await verifySignInCode(d1AuthStore(), body, {
      preferredUserId:
        legacy && legacy.email.toLowerCase() === email
          ? legacy.userId
          : undefined,
    });
    const secure = new URL(request.url).protocol === "https:";
    return jsonResponse(
      { user: { id: user.id, name: user.email, email: user.email } },
      200,
      { "Set-Cookie": sessionCookie(token, secure) },
    );
  } catch (error) {
    return routeError(error);
  }
}
