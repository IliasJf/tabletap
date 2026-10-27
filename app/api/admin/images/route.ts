import { getCurrentUser } from "../../../auth";
import {
  assertSameOrigin,
  jsonResponse,
  readBoundedBytes,
  requireOwnerId,
  routeError,
} from "../../../../lib/api-security";
import { saveImage } from "../../../../lib/image-store";
import { MAX_IMAGE_BYTES, assertImage } from "../../../../lib/images";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ownerId = requireOwnerId(await getCurrentUser());
    assertSameOrigin(request);
    const bytes = await readBoundedBytes(request, MAX_IMAGE_BYTES);
    return jsonResponse(
      await saveImage(ownerId, bytes, assertImage(bytes)),
      201,
    );
  } catch (error) {
    return routeError(error);
  }
}
