import { count, eq } from "drizzle-orm";
import { getDb } from "../db";
import { menuImages } from "../db/schema";
import { ApiError } from "./api-security";
import {
  MAX_IMAGES_PER_OWNER,
  base64ToBytes,
  bytesToBase64,
  imagePath,
  newImageId,
  type ImageType,
} from "./images";

export async function saveImage(
  ownerId: string,
  bytes: Uint8Array,
  contentType: ImageType,
): Promise<{ url: string }> {
  const db = getDb();
  const [{ total }] = await db
    .select({ total: count() })
    .from(menuImages)
    .where(eq(menuImages.ownerId, ownerId));
  if (total >= MAX_IMAGES_PER_OWNER)
    throw new ApiError(
      `You can store up to ${MAX_IMAGES_PER_OWNER} photos. Reuse an existing photo or contact support.`,
      400,
    );
  const id = newImageId();
  await db.insert(menuImages).values({
    id,
    ownerId,
    contentType,
    data: bytesToBase64(bytes),
    byteLength: bytes.byteLength,
    createdAt: Date.now(),
  });
  return { url: imagePath(id) };
}

export async function readImage(
  id: string,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string } | null> {
  const [row] = await getDb()
    .select({ data: menuImages.data, contentType: menuImages.contentType })
    .from(menuImages)
    .where(eq(menuImages.id, id))
    .limit(1);
  return row
    ? { bytes: base64ToBytes(row.data), contentType: row.contentType }
    : null;
}
