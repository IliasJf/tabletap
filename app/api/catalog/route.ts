import { ApiError, jsonResponse, routeError } from "../../../lib/api-security";
import { readPublicCatalog } from "../../../lib/catalog-store";
import { createSeedCatalog } from "../../../lib/menu-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const shop = new URL(request.url).searchParams.get("shop");
    if (shop === null) return jsonResponse(createSeedCatalog());
    if (!shop.trim() || shop.length > 200 || /[\u0000-\u001f]/.test(shop))
      throw new ApiError("Invalid restaurant link.", 400);
    const found = await readPublicCatalog(shop);
    if (!found)
      throw new ApiError(
        "This restaurant menu has not been published yet.",
        404,
      );
    return jsonResponse(found.catalog);
  } catch (error) {
    return routeError(error);
  }
}
