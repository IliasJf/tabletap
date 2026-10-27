import { getCurrentUser } from "../../../auth";
import {
  ApiError,
  assertSameOrigin,
  jsonResponse,
  readBoundedJson,
  requireOwnerId,
  routeError,
} from "../../../../lib/api-security";
import { readCatalog, saveCatalog } from "../../../../lib/catalog-store";
import {
  CatalogValidationError,
  validateCatalog,
} from "../../../../lib/catalog-validation";
import { createSeedCatalog } from "../../../../lib/menu-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ownerId = requireOwnerId(await getCurrentUser());
    return jsonResponse((await readCatalog(ownerId)) ?? createSeedCatalog());
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ownerId = requireOwnerId(await getCurrentUser());
    assertSameOrigin(request);
    const payload = await readBoundedJson(request);
    const catalog = validateCatalog(payload);
    return jsonResponse(await saveCatalog(ownerId, catalog));
  } catch (error) {
    if (error instanceof CatalogValidationError)
      return routeError(new ApiError(error.message, 400));
    return routeError(error);
  }
}
