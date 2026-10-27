import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../db";
import { restaurantCatalogs } from "../db/schema";
import { ApiError } from "./api-security";
import { upgradeStoredCatalog } from "./catalog-validation";
import type { Catalog } from "./types";

export const SLUG_TAKEN_MESSAGE =
  "That menu link name is already used by another restaurant. Choose another one.";

function toCatalog(row: { payload: string; revision: number }): Catalog {
  return {
    ...(upgradeStoredCatalog(JSON.parse(row.payload)) as Catalog),
    revision: row.revision,
  };
}

export async function readCatalog(ownerId: string): Promise<Catalog | null> {
  const [row] = await getDb()
    .select()
    .from(restaurantCatalogs)
    .where(eq(restaurantCatalogs.ownerId, ownerId))
    .limit(1);
  return row ? toCatalog(row) : null;
}

/**
 * Resolves a customer link. Owner IDs win over link names so QR codes printed
 * before a restaurant chose a link name keep opening the same menu.
 */
export async function readPublicCatalog(
  shop: string,
): Promise<{ ownerId: string; catalog: Catalog } | null> {
  const db = getDb();
  const [byOwner] = await db
    .select()
    .from(restaurantCatalogs)
    .where(eq(restaurantCatalogs.ownerId, shop))
    .limit(1);
  const [bySlug] = byOwner
    ? []
    : await db
        .select()
        .from(restaurantCatalogs)
        .where(eq(restaurantCatalogs.slug, shop.toLowerCase()))
        .limit(1);
  const match = byOwner ?? bySlug;
  return match ? { ownerId: match.ownerId, catalog: toCatalog(match) } : null;
}

/** Uses a single atomic insert/update with revision comparison to prevent lost edits. */
export async function saveCatalog(
  ownerId: string,
  catalog: Catalog,
): Promise<Catalog> {
  const next = { ...catalog, revision: catalog.revision + 1 };
  const slug = next.settings.slug || null;
  const db = getDb();
  if (slug) {
    const [taken] = await db
      .select({ ownerId: restaurantCatalogs.ownerId })
      .from(restaurantCatalogs)
      .where(
        and(
          eq(restaurantCatalogs.slug, slug),
          ne(restaurantCatalogs.ownerId, ownerId),
        ),
      )
      .limit(1);
    if (taken) throw new ApiError(SLUG_TAKEN_MESSAGE, 400);
  }
  const values = {
    payload: JSON.stringify(next),
    revision: next.revision,
    updatedAt: Date.now(),
    slug,
  };
  let changed: { ownerId: string }[];
  try {
    changed =
      catalog.revision === 0
        ? await db
            .insert(restaurantCatalogs)
            .values({ ownerId, ...values })
            .onConflictDoNothing({ target: restaurantCatalogs.ownerId })
            .returning({ ownerId: restaurantCatalogs.ownerId })
        : await db
            .update(restaurantCatalogs)
            .set(values)
            .where(
              and(
                eq(restaurantCatalogs.ownerId, ownerId),
                eq(restaurantCatalogs.revision, catalog.revision),
              ),
            )
            .returning({ ownerId: restaurantCatalogs.ownerId });
  } catch (error) {
    // Two owners claimed the same link name at the same moment.
    if (error instanceof Error && /UNIQUE.*slug/i.test(error.message))
      throw new ApiError(SLUG_TAKEN_MESSAGE, 400);
    throw error;
  }
  if (!changed.length)
    throw new ApiError(
      "This menu was changed in another tab. Reload the latest version before saving.",
      409,
    );
  return next;
}
