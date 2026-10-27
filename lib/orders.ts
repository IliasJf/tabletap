import { calculateCart, validateOrder } from "./cart.ts";
import type { Catalog, Language, OrderDetails, OrderType } from "./types";

/** Newest orders kept per restaurant; older ones are removed on insert. */
export const MAX_ORDERS_PER_OWNER = 500;
export const ORDER_ID_PATTERN = /^[a-f0-9]{32}$/;

/**
 * "new" means the customer opened WhatsApp; the owner confirms it there before
 * moving it on. "cancelled" covers orders that never arrived or were refused.
 */
export const ORDER_STATUSES = [
  "new",
  "preparing",
  "done",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus);
}

/** Orders saved before statuses existed read as new. */
export function withStatus(order: OrderRecord): OrderRecord {
  return isOrderStatus(order.status) ? order : { ...order, status: "new" };
}

/** Validates an owner's status change request. */
export function parseStatusChange(value: unknown): {
  id: string;
  status: OrderStatus;
} {
  const row =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  if (typeof row.id !== "string" || !ORDER_ID_PATTERN.test(row.id))
    throw new OrderValidationError("This order has an invalid reference.");
  if (!isOrderStatus(row.status))
    throw new OrderValidationError("Choose a valid order status.");
  return { id: row.id, status: row.status };
}

export interface OrderLine {
  name: string;
  options: string[];
  quantity: number;
  total: number;
}

/** What the owner sees. Prices are recomputed from the saved menu, never the browser. */
export interface OrderRecord {
  id: string;
  createdAt: number;
  status: OrderStatus;
  /** When the owner last changed the status. */
  updatedAt?: number;
  language: Language;
  name: string;
  type: OrderType;
  table: string;
  address: string;
  notes: string;
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
}

export class OrderValidationError extends Error {}

function text(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

export function newOrderId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

/** Builds a trusted order from an untrusted customer request and the saved menu. */
export function buildOrderRecord(
  value: unknown,
  catalog: Catalog,
  createdAt = Date.now(),
): OrderRecord {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new OrderValidationError("Send the order as an object.");
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !ORDER_ID_PATTERN.test(row.id))
    throw new OrderValidationError("This order has an invalid reference.");
  const raw =
    row.details && typeof row.details === "object"
      ? (row.details as Record<string, unknown>)
      : {};
  const details: OrderDetails = {
    name: text(raw.name, 101),
    type: raw.type as OrderType,
    table: text(raw.table, 21),
    address: text(raw.address, 301),
    notes: text(raw.notes, 501),
  };
  const issue = validateOrder(details);
  if (issue) throw new OrderValidationError(issue);
  const language: Language =
    row.language === "fr" || row.language === "ar" ? row.language : "en";
  const totals = calculateCart(
    Array.isArray(row.cart) ? (row.cart as never) : [],
    catalog.items,
    details.type === "delivery" ? catalog.settings.deliveryFee : 0,
  );
  if (!totals.itemCount)
    throw new OrderValidationError("This order has no available dishes.");
  return {
    id: row.id,
    createdAt,
    status: "new",
    language,
    name: details.name.trim(),
    type: details.type,
    table: details.type === "dine-in" ? details.table.trim() : "",
    address: details.type === "delivery" ? details.address.trim() : "",
    notes: details.notes.trim(),
    lines: totals.lines.map((line) => ({
      name: line.item.name.en,
      options: line.options.map((option) => option.label.en),
      quantity: line.quantity,
      total: line.total,
    })),
    subtotal: totals.subtotal,
    deliveryFee: totals.deliveryFee,
    total: totals.total,
    itemCount: totals.itemCount,
  };
}
