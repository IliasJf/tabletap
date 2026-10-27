import { env } from "cloudflare:workers";
import {
  ApiError,
  assertSameOrigin,
  jsonResponse,
  readBoundedJson,
  routeError,
} from "../../../../lib/api-security";
import {
  createSignInCode,
  normalizeEmail,
  sendCodeWithResend,
} from "../../../../lib/auth";
import { d1AuthStore } from "../../../../lib/auth-store";
import { enforceLimit } from "../../../../lib/rate-limit";
import { clientIp, d1RateLimitStore } from "../../../../lib/rate-limit-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const configured = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
    // `npm run dev` shows the code on screen; production must send real email.
    if (!configured && !import.meta.env.DEV)
      throw new ApiError(
        "Email sign-in isn't set up yet. The site owner needs to add RESEND_API_KEY and EMAIL_FROM.",
        503,
      );
    const limits = d1RateLimitStore();
    await enforceLimit(limits, "codePerIp", clientIp(request));
    const body = await readBoundedJson(request, 1_000);
    await enforceLimit(
      limits,
      "codePerEmail",
      normalizeEmail((body as { email?: unknown } | null)?.email),
    );
    const store = d1AuthStore();
    const { email, code } = await createSignInCode(store, body);
    if (!configured) return jsonResponse({ sent: true, devCode: code });
    try {
      await sendCodeWithResend(
        { apiKey: env.RESEND_API_KEY!, from: env.EMAIL_FROM! },
        email,
        code,
      );
    } catch (error) {
      // Let the owner ask again straight away instead of waiting out the cooldown.
      await store.deleteCode(email);
      throw error;
    }
    return jsonResponse({ sent: true });
  } catch (error) {
    return routeError(error);
  }
}
