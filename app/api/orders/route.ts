import {
  ApiError,
  assertSameOrigin,
  jsonResponse,
  readBoundedJson,
  routeError,
} from "../../../lib/api-security";
import { readPublicCatalog } from "../../../lib/catalog-store";
import { saveOrder } from "../../../lib/order-store";
import { OrderValidationError, buildOrderRecord } from "../../../lib/orders";
import { enforceLimit } from "../../../lib/rate-limit";
import { clientIp, d1RateLimitStore } from "../../../lib/rate-limit-store";

export const dynamic = "force-dynamic";

/** Customers are anonymous; the restaurant comes from the link, prices from its saved menu. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceLimit(d1RateLimitStore(), "orderPerIp", clientIp(request));
    const body = await readBoundedJson(request, 20_000);
    const shop = (body as { shop?: unknown } | null)?.shop;
    if (typeof shop !== "string" || !shop || shop.length > 200)
      throw new ApiError("Invalid restaurant link.", 400);
    const found = await readPublicCatalog(shop);
    if (!found) throw new ApiError("This restaurant menu was not found.", 404);
    const order = buildOrderRecord(body, found.catalog);
    await saveOrder(found.ownerId, order);
    return jsonResponse({ id: order.id }, 201);
  } catch (error) {
    if (error instanceof OrderValidationError)
      return routeError(new ApiError(error.message, 400));
    return routeError(error);
  }
}
