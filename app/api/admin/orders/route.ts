import { getCurrentUser } from "../../../auth";
import {
  ApiError,
  assertSameOrigin,
  jsonResponse,
  readBoundedJson,
  requireOwnerId,
  routeError,
} from "../../../../lib/api-security";
import { listOrders, updateOrderStatus } from "../../../../lib/order-store";
import {
  OrderValidationError,
  parseStatusChange,
} from "../../../../lib/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ownerId = requireOwnerId(await getCurrentUser());
    return jsonResponse({ orders: await listOrders(ownerId) });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ownerId = requireOwnerId(await getCurrentUser());
    assertSameOrigin(request);
    const { id, status } = parseStatusChange(
      await readBoundedJson(request, 1_000),
    );
    return jsonResponse(await updateOrderStatus(ownerId, id, status));
  } catch (error) {
    if (error instanceof OrderValidationError)
      return routeError(new ApiError(error.message, 400));
    return routeError(error);
  }
}
