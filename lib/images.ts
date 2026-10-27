import { ApiError } from "./api-security.ts";

/** Photos are resized in the browser first; this bounds what the server stores. */
export const MAX_IMAGE_BYTES = 700_000;
export const MAX_IMAGES_PER_OWNER = 300;
export const IMAGE_ID_PATTERN = /^[a-f0-9]{32}$/;

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

/** Trusts the file's own bytes, never the declared Content-Type. */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "image/png";
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export function assertImage(bytes: Uint8Array): ImageType {
  if (!bytes.byteLength) throw new ApiError("Choose a photo to upload.", 400);
  const type = detectImageType(bytes);
  if (!type) throw new ApiError("Upload a JPEG, PNG or WebP photo.", 415);
  return type;
}

export function newImageId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function imagePath(id: string): string {
  return `/api/images/${id}`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Uploaded photos never change, and are served so they can't run as a page. */
export function imageResponse(
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
): Response {
  return new Response(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
