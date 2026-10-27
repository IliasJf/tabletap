import { ApiError, routeError } from "../../../../lib/api-security";
import { readImage } from "../../../../lib/image-store";
import { IMAGE_ID_PATTERN, imageResponse } from "../../../../lib/images";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!IMAGE_ID_PATTERN.test(id)) throw new ApiError("Photo not found.", 404);
    const image = await readImage(id);
    if (!image) throw new ApiError("Photo not found.", 404);
    return imageResponse(image.bytes, image.contentType);
  } catch (error) {
    return routeError(error);
  }
}
