import { and, desc, eq, notInArray } from "drizzle-orm";
import { getDb } from "../db";
import { orders } from "../db/schema";
import { ApiError } from "./api-security";
import {
  MAX_ORDERS_PER_OWNER,
  withStatus,
  type OrderRecord,
  type OrderStatus,
} from "./orders";

/** Idempotent: the browser reuses one order ID however often Send is pressed. */
export async function saveOrder(
  ownerId: string,
  order: OrderRecord,
): Promise<void> {
  const db = getDb();
  await db
    .insert(orders)
    .values({
      id: order.id,
      ownerId,
      createdAt: order.createdAt,
      payload: JSON.stringify(order),
    })
    .onConflictDoNothing({ target: orders.id });
  const newest = db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.ownerId, ownerId))
    .orderBy(desc(orders.createdAt))
    .limit(MAX_ORDERS_PER_OWNER);
  await db
    .delete(orders)
    .where(and(eq(orders.ownerId, ownerId), notInArray(orders.id, newest)));
}

export async function listOrders(
  ownerId: string,
  limit = 100,
): Promise<OrderRecord[]> {
  const rows = await getDb()
    .select({ payload: orders.payload })
    .from(orders)
    .where(eq(orders.ownerId, ownerId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
  return rows.map((row) => withStatus(JSON.parse(row.payload) as OrderRecord));
}

/** Only the owner's own orders match, so one restaurant can't touch another's. */
export async function updateOrderStatus(
  ownerId: string,
  id: string,
  status: OrderStatus,
): Promise<OrderRecord> {
  const db = getDb();
  const [row] = await db
    .select({ payload: orders.payload })
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new ApiError("This order was not found.", 404);
  const next: OrderRecord = {
    ...withStatus(JSON.parse(row.payload) as OrderRecord),
    status,
    updatedAt: Date.now(),
  };
  await db
    .update(orders)
    .set({ payload: JSON.stringify(next) })
    .where(and(eq(orders.id, id), eq(orders.ownerId, ownerId)));
  return next;
}
