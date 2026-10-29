// Browser-only stand-in for the TableTap API, used by the GitHub Pages demo.
// It reuses the app's own validation, sign-in and order rules; data lives in
// the visitor's localStorage, so every visitor gets a private sandbox.
import { ApiError } from "../../lib/api-security";
import {
  type AuthStore,
  type AuthUser,
  type StoredCode,
  createSignInCode,
  endSession,
  getSessionUser,
  verifySignInCode,
} from "../../lib/auth";
import {
  CatalogValidationError,
  upgradeStoredCatalog,
  validateCatalog,
} from "../../lib/catalog-validation";
import { addToCart } from "../../lib/cart";
import {
  IMAGE_ID_PATTERN,
  MAX_IMAGE_BYTES,
  assertImage,
  bytesToBase64,
  imagePath,
  newImageId,
} from "../../lib/images";
import { createSeedCatalog } from "../../lib/menu-data";
import {
  MAX_ORDERS_PER_OWNER,
  OrderValidationError,
  type OrderRecord,
  buildOrderRecord,
  parseStatusChange,
  withStatus,
} from "../../lib/orders";
import type { Catalog, OrderDetails } from "../../lib/types";

const STATE_KEY = "tabletap-demo:v1";
const TOKEN_KEY = "tabletap-demo:session";
const IMAGE_PREFIX = "tabletap-demo:image:";

interface StoredCatalog {
  payload: string;
  revision: number;
  slug: string | null;
}
interface State {
  catalogs: Record<string, StoredCatalog>;
  orders: { id: string; ownerId: string; createdAt: number; payload: string }[];
  users: Record<string, { id: string; createdAt: number }>;
  codes: Record<string, StoredCode>;
  sessions: Record<string, { userId: string; expiresAt: number }>;
}

const emptyState = (): State => ({
  catalogs: {},
  orders: [],
  users: {},
  codes: {},
  sessions: {},
});

function load(): State {
  try {
    return {
      ...emptyState(),
      ...JSON.parse(localStorage.getItem(STATE_KEY) ?? "{}"),
    };
  } catch {
    return emptyState();
  }
}

function save(state: State) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    throw new ApiError(
      "Your browser's demo storage is full. Use “Reset demo” to start again.",
      507,
    );
  }
}

/** Clears everything this demo stored in the browser. */
export function resetDemo() {
  for (const key of Object.keys(localStorage))
    if (
      key.startsWith("tabletap-demo:") ||
      key.startsWith("tabletap:cart:") ||
      key === "tabletap:customer-name"
    )
      localStorage.removeItem(key);
}

/** Uploaded photos are kept as data URLs; the page swaps them in for display. */
export function demoImageUrl(path: string): string | null {
  const id = /^\/api\/images\/([a-f0-9]{32})$/.exec(path)?.[1];
  return id ? localStorage.getItem(IMAGE_PREFIX + id) : null;
}

function authStore(state: State): AuthStore {
  return {
    getCode: (email) => state.codes[email] ?? null,
    putCode: (email, code) => void (state.codes[email] = code),
    bumpAttempts: (email) => {
      if (state.codes[email]) state.codes[email].attempts += 1;
    },
    deleteCode: (email) => void delete state.codes[email],
    findUserByEmail: (email) =>
      state.users[email] ? { id: state.users[email].id, email } : null,
    createUser: (user, createdAt) =>
      void (state.users[user.email] = { id: user.id, createdAt }),
    createSession: ({ tokenHash, userId, expiresAt }) =>
      void (state.sessions[tokenHash] = { userId, expiresAt }),
    getSessionUser: (tokenHash, now) => {
      const session = state.sessions[tokenHash];
      if (!session || session.expiresAt <= now) return null;
      const email = Object.keys(state.users).find(
        (key) => state.users[key].id === session.userId,
      );
      return email ? { id: session.userId, email } : null;
    },
    deleteSession: (tokenHash) => void delete state.sessions[tokenHash],
    deleteExpiredSessions: (userId, now) => {
      for (const [hash, session] of Object.entries(state.sessions))
        if (session.userId === userId && session.expiresAt <= now)
          delete state.sessions[hash];
    },
  };
}

const cookie = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? `tabletap_session=${token}` : null;
};

function toCatalog(row: StoredCatalog): Catalog {
  return {
    ...(upgradeStoredCatalog(JSON.parse(row.payload)) as Catalog),
    revision: row.revision,
  };
}

/** The sample menu, pointed at this demo's own address for QR codes. */
function demoSeed(): Catalog {
  const catalog = createSeedCatalog();
  catalog.settings.publicUrl = new URL(".", document.baseURI).href.replace(
    /\/$/,
    "",
  );
  return catalog;
}

function readPublic(state: State, shop: string) {
  if (state.catalogs[shop])
    return { ownerId: shop, catalog: toCatalog(state.catalogs[shop]) };
  const entry = Object.entries(state.catalogs).find(
    ([, row]) => row.slug === shop.toLowerCase(),
  );
  return entry ? { ownerId: entry[0], catalog: toCatalog(entry[1]) } : null;
}

function storeOrder(state: State, ownerId: string, order: OrderRecord) {
  if (state.orders.some((row) => row.id === order.id)) return;
  state.orders.push({
    id: order.id,
    ownerId,
    createdAt: order.createdAt,
    payload: JSON.stringify(order),
  });
  const mine = state.orders
    .filter((row) => row.ownerId === ownerId)
    .sort((a, b) => b.createdAt - a.createdAt);
  const keep = new Set(
    mine.slice(0, MAX_ORDERS_PER_OWNER).map((row) => row.id),
  );
  state.orders = state.orders.filter(
    (row) => row.ownerId !== ownerId || keep.has(row.id),
  );
}

/** A new demo owner gets a few sample orders so the Orders screen has life. */
function seedSampleOrders(state: State, ownerId: string) {
  const catalog = createSeedCatalog();
  const item = (id: string) => catalog.items.find((entry) => entry.id === id)!;
  const samples: [
    OrderDetails,
    [string, string[], number][],
    string,
    number,
  ][] = [
    [
      { name: "Sara", type: "dine-in", table: "5", address: "", notes: "" },
      [
        ["avocado-toast", ["egg"], 1],
        ["flat-white", ["oat"], 2],
      ],
      "new",
      4,
    ],
    [
      {
        name: "Youssef",
        type: "delivery",
        table: "",
        address: "12 Rue Atlas, Maarif",
        notes: "No onions, please",
      },
      [["harvest-bowl", [], 2]],
      "preparing",
      18,
    ],
    [
      { name: "Lina", type: "takeaway", table: "", address: "", notes: "" },
      [
        ["moroccan-tea", [], 3],
        ["almond-croissant", [], 3],
      ],
      "done",
      55,
    ],
  ];
  for (const [details, lines, status, minutesAgo] of samples) {
    let cart = [] as ReturnType<typeof addToCart>;
    for (const [id, options, quantity] of lines)
      cart = addToCart(cart, item(id), options, quantity);
    const order = buildOrderRecord(
      { id: newImageId(), cart, details, language: "en" },
      catalog,
      Date.now() - minutesAgo * 60_000,
    );
    storeOrder(state, ownerId, {
      ...order,
      status: status as OrderRecord["status"],
    });
  }
}

async function requireUser(state: State): Promise<AuthUser> {
  const user = await getSessionUser(authStore(state), cookie());
  if (!user) throw new ApiError("Sign in to manage your restaurant menu.", 401);
  return user;
}

async function readJson(init?: RequestInit): Promise<unknown> {
  try {
    return JSON.parse(String(init?.body ?? ""));
  } catch {
    throw new ApiError("The request contains invalid JSON.", 400);
  }
}

async function handle(
  path: string,
  query: URLSearchParams,
  method: string,
  init?: RequestInit,
): Promise<[unknown, number]> {
  const state = load();
  if (path === "/api/me") {
    const user = await getSessionUser(authStore(state), cookie());
    return [
      {
        user: user
          ? { id: user.id, name: user.email, email: user.email }
          : null,
      },
      200,
    ];
  }
  if (path === "/api/catalog") {
    const shop = query.get("shop");
    if (!shop) return [createSeedCatalog(), 200];
    const found = readPublic(state, shop);
    if (!found)
      throw new ApiError(
        "This restaurant menu has not been published yet.",
        404,
      );
    return [found.catalog, 200];
  }
  if (path === "/api/auth/request-code") {
    const { code } = await createSignInCode(
      authStore(state),
      await readJson(init),
    );
    save(state);
    return [{ sent: true, devCode: code }, 200];
  }
  if (path === "/api/auth/verify") {
    const { user, token } = await verifySignInCode(
      authStore(state),
      await readJson(init),
    );
    if (!state.orders.some((row) => row.ownerId === user.id))
      seedSampleOrders(state, user.id);
    save(state);
    localStorage.setItem(TOKEN_KEY, token);
    return [
      { user: { id: user.id, name: user.email, email: user.email } },
      200,
    ];
  }
  if (path === "/api/auth/signout") {
    await endSession(authStore(state), cookie());
    localStorage.removeItem(TOKEN_KEY);
    save(state);
    return [{ signedOut: true }, 200];
  }
  if (path === "/api/admin/catalog") {
    const user = await requireUser(state);
    if (method === "GET") {
      const row = state.catalogs[user.id];
      return [row ? toCatalog(row) : demoSeed(), 200];
    }
    const catalog = validateCatalog(await readJson(init));
    const current = state.catalogs[user.id];
    if ((current?.revision ?? 0) !== catalog.revision)
      throw new ApiError(
        "This menu was changed in another tab. Reload the latest version before saving.",
        409,
      );
    const slug = catalog.settings.slug || null;
    if (
      slug &&
      Object.entries(state.catalogs).some(
        ([owner, row]) => row.slug === slug && owner !== user.id,
      )
    )
      throw new ApiError(
        "That menu link name is already used. Choose another one.",
        400,
      );
    const next = { ...catalog, revision: catalog.revision + 1 };
    state.catalogs[user.id] = {
      payload: JSON.stringify(next),
      revision: next.revision,
      slug,
    };
    save(state);
    return [next, 200];
  }
  if (path === "/api/admin/images") {
    await requireUser(state);
    const bytes = new Uint8Array(await new Response(init?.body).arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES)
      throw new ApiError("This request is too large.", 413);
    const type = assertImage(bytes);
    const id = newImageId();
    try {
      localStorage.setItem(
        IMAGE_PREFIX + id,
        `data:${type};base64,${bytesToBase64(bytes)}`,
      );
    } catch {
      throw new ApiError(
        "Your browser's demo storage is full. Remove a photo or use “Reset demo”.",
        507,
      );
    }
    return [{ url: imagePath(id) }, 201];
  }
  if (path === "/api/orders") {
    const body = (await readJson(init)) as { shop?: unknown } | null;
    const shop = typeof body?.shop === "string" ? body.shop : "";
    const found = shop ? readPublic(state, shop) : null;
    if (!found) throw new ApiError("This restaurant menu was not found.", 404);
    const order = buildOrderRecord(body, found.catalog);
    storeOrder(state, found.ownerId, order);
    save(state);
    return [{ id: order.id }, 201];
  }
  if (path === "/api/admin/orders") {
    const user = await requireUser(state);
    if (method === "PATCH") {
      const { id, status } = parseStatusChange(await readJson(init));
      const row = state.orders.find(
        (entry) => entry.id === id && entry.ownerId === user.id,
      );
      if (!row) throw new ApiError("This order was not found.", 404);
      const next = {
        ...withStatus(JSON.parse(row.payload)),
        status,
        updatedAt: Date.now(),
      };
      row.payload = JSON.stringify(next);
      save(state);
      return [next, 200];
    }
    const orders = state.orders
      .filter((row) => row.ownerId === user.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 100)
      .map((row) => withStatus(JSON.parse(row.payload)));
    return [{ orders }, 200];
  }
  if (IMAGE_ID_PATTERN.test(path.split("/").pop() ?? ""))
    throw new ApiError("Photo not found.", 404);
  throw new ApiError("Not found.", 404);
}

/** Routes `/api/...` fetches (under any site prefix) to the in-browser API. */
export function installDemoApi(base: string) {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      window.location.href,
    );
    const path = url.pathname.startsWith(base)
      ? "/" + url.pathname.slice(base.length)
      : url.pathname;
    if (url.origin !== window.location.origin || !path.startsWith("/api/"))
      return realFetch(input, init);
    const method = (init?.method ?? "GET").toUpperCase();
    try {
      const [value, status] = await handle(
        path,
        url.searchParams,
        method,
        init,
      );
      return Response.json(value, { status });
    } catch (error) {
      const known =
        error instanceof ApiError ||
        error instanceof CatalogValidationError ||
        error instanceof OrderValidationError;
      if (!known) console.error("TableTap demo API failed:", error);
      return Response.json(
        { error: known ? error.message : "Something went wrong in the demo." },
        {
          status: error instanceof ApiError ? error.status : known ? 400 : 500,
        },
      );
    }
  };
}
