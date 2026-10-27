import { env } from "cloudflare:workers";
import {
  ApiError,
  assertSameOrigin,
  jsonResponse,
  readBoundedJson,
  routeError,
} from "../../../../lib/api-security";
import { createSignInCode, sendCodeWithResend } from "../../../../lib/auth";
import { d1AuthStore } from "../../../../lib/auth-store";

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
    const store = d1AuthStore();
    const { email, code } = await createSignInCode(
      store,
      await readBoundedJson(request, 1_000),
    );
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
