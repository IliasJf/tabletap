export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface RequestIdentity {
  userId: string;
}

/** Only the server-authenticated identity selects the writable database row. */
export function requireOwnerId(user: RequestIdentity | null): string {
  if (!user?.userId)
    throw new ApiError("Sign in to manage your restaurant menu.", 401);
  return user.userId;
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const destination = new URL(request.url).origin;
  if (!origin || origin !== destination)
    throw new ApiError("This request must come from the same website.", 403);
}

/** Reads at most `maximumBytes` of the body, whatever Content-Length claims. */
export async function readBoundedBytes(
  request: Request,
  maximumBytes: number,
): Promise<Uint8Array> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes)
    throw new ApiError("This request is too large.", 413);
  if (!request.body) throw new ApiError("The request body is empty.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maximumBytes) {
      await reader.cancel();
      throw new ApiError("This request is too large.", 413);
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, position);
    position += chunk.byteLength;
  }
  return buffer;
}

export async function readBoundedJson(
  request: Request,
  maximumBytes = 250_000,
): Promise<unknown> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new ApiError("Send the request as JSON.", 415);
  const buffer = await readBoundedBytes(request, maximumBytes);
  try {
    return JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    throw new ApiError("The request contains invalid JSON.", 400);
  }
}

export function jsonResponse(
  value: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

export function routeError(error: unknown): Response {
  if (error instanceof ApiError)
    return jsonResponse({ error: error.message }, error.status);
  // Infrastructure details must stay server-side.
  console.error(
    "TableTap API failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  return jsonResponse(
    { error: "Something went wrong on our side. Please try again shortly." },
    503,
  );
}
