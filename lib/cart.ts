import type {
  Catalog,
  CartItem,
  Language,
  MenuItem,
  MenuOption,
  OrderDetails,
} from "./types";
import { pickText } from "./text.ts";

export interface CartLine {
  key: string;
  item: MenuItem;
  options: MenuOption[];
  quantity: number;
  unitPrice: number;
  total: number;
}

/** Prices the way Moroccan menus write them: "68 DH", "68,50 DH", "68 درهم". */
export function formatPrice(amount: number, language: Language = "en"): string {
  const number = new Intl.NumberFormat(
    language === "ar" ? "ar-MA" : language === "fr" ? "fr" : "en",
    {
      minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    },
  ).format(amount / 100);
  return language === "ar" ? `${number} درهم` : `${number} DH`;
}

export function cartKey(itemId: string, optionIds: string[] = []): string {
  return `${itemId}:${[...new Set(optionIds)].sort().join(",")}`;
}

export function addToCart(
  cart: CartItem[],
  item: MenuItem,
  optionIds: string[] = [],
  quantity = 1,
): CartItem[] {
  if (!item.available) return cart;
  const validIds = [
    ...new Set(
      optionIds.filter((id) => item.options.some((option) => option.id === id)),
    ),
  ].sort();
  const key = cartKey(item.id, validIds);
  const added = Number.isFinite(quantity)
    ? Math.max(1, Math.min(99, Math.floor(quantity)))
    : 1;
  const existing = cart.find((entry) => entry.key === key);
  if (existing)
    return cart.map((entry) =>
      entry.key === key
        ? { ...entry, quantity: Math.min(99, entry.quantity + added) }
        : entry,
    );
  return [
    ...cart,
    { key, itemId: item.id, optionIds: validIds, quantity: added },
  ];
}

export function updateCartQuantity(
  cart: CartItem[],
  key: string,
  quantity: number,
): CartItem[] {
  if (!Number.isFinite(quantity)) return cart;
  if (quantity < 1) return cart.filter((entry) => entry.key !== key);
  return cart.map((entry) =>
    entry.key === key
      ? { ...entry, quantity: Math.min(99, Math.floor(quantity)) }
      : entry,
  );
}

/** Treat saved browser state as untrusted; only current, available menu items survive. */
export function sanitizeCart(value: unknown, items: MenuItem[]): CartItem[] {
  if (!Array.isArray(value)) return [];
  let result: CartItem[] = [];
  for (const candidate of value.slice(0, 100)) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Partial<CartItem>;
    const item = items.find(
      (entry) => entry.id === row.itemId && entry.available,
    );
    if (
      !item ||
      typeof row.quantity !== "number" ||
      !Number.isInteger(row.quantity) ||
      row.quantity < 1
    )
      continue;
    if (
      !Array.isArray(row.optionIds) ||
      row.optionIds.some((id) => typeof id !== "string")
    )
      continue;
    result = addToCart(result, item, row.optionIds, row.quantity);
  }
  return result;
}

export function getCartLines(cart: CartItem[], items: MenuItem[]): CartLine[] {
  return sanitizeCart(cart, items).map((row) => {
    const item = items.find((entry) => entry.id === row.itemId)!;
    const options = item.options.filter((option) =>
      row.optionIds.includes(option.id),
    );
    const unitPrice =
      item.price + options.reduce((sum, option) => sum + option.price, 0);
    return {
      key: row.key,
      item,
      options,
      quantity: row.quantity,
      unitPrice,
      total: unitPrice * row.quantity,
    };
  });
}

export function calculateCart(
  cart: CartItem[],
  items: MenuItem[],
  deliveryFee = 0,
) {
  const lines = getCartLines(cart, items);
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const fee =
    itemCount > 0 && Number.isSafeInteger(deliveryFee)
      ? Math.max(0, deliveryFee)
      : 0;
  return {
    lines,
    subtotal,
    deliveryFee: fee,
    total: subtotal + fee,
    itemCount,
  };
}

export function validateOrder(details: OrderDetails): string | null {
  if (!details.name.trim() || details.name.length > 100)
    return "Please enter your name (up to 100 characters).";
  if (!["dine-in", "takeaway", "delivery"].includes(details.type))
    return "Choose a valid order type.";
  if (
    details.type === "dine-in" &&
    !/^[A-Za-z0-9 -]{1,20}$/.test(details.table.trim())
  )
    return "Please enter your table number.";
  if (
    details.type === "delivery" &&
    (details.address.trim().length < 5 || details.address.length > 300)
  )
    return "Please enter a delivery address (5–300 characters).";
  if (details.notes.length > 500)
    return "Please keep order notes under 500 characters.";
  return null;
}

export function buildWhatsAppMessage(
  cart: CartItem[],
  catalog: Catalog,
  details: OrderDetails,
  language: Language = "en",
): string {
  const error = validateOrder(details);
  if (error) throw new Error(error);
  const totals = calculateCart(
    cart,
    catalog.items,
    details.type === "delivery" ? catalog.settings.deliveryFee : 0,
  );
  if (!totals.itemCount)
    throw new Error("Your cart is empty. Add something delicious first.");
  const words =
    language === "fr"
      ? {
          order: "Nouvelle commande",
          name: "Nom",
          type: "Service",
          table: "Table",
          address: "Adresse",
          notes: "Notes",
          subtotal: "Sous-total",
          delivery: "Livraison",
          total: "Total",
          confirm: "Merci de confirmer la disponibilité, le total et le délai.",
          types: {
            "dine-in": "Sur place",
            takeaway: "À emporter",
            delivery: "Livraison",
          },
        }
      : language === "ar"
        ? {
            order: "طلب جديد",
            name: "الاسم",
            type: "نوع الطلب",
            table: "الطاولة",
            address: "العنوان",
            notes: "ملاحظات",
            subtotal: "المجموع الفرعي",
            delivery: "التوصيل",
            total: "الإجمالي",
            confirm: "يرجى تأكيد التوفر والمبلغ ووقت التحضير.",
            types: {
              "dine-in": "داخل المقهى",
              takeaway: "للاستلام",
              delivery: "توصيل",
            },
          }
        : {
            order: "New order",
            name: "Name",
            type: "Order type",
            table: "Table",
            address: "Address",
            notes: "Notes",
            subtotal: "Subtotal",
            delivery: "Delivery",
            total: "Total",
            confirm:
              "Please confirm availability, the total, and preparation time.",
            types: {
              "dine-in": "Dine-in",
              takeaway: "Takeaway",
              delivery: "Delivery",
            },
          };
  const rows = [
    `${words.order} · ${catalog.settings.name}`,
    "",
    `${words.name}: ${details.name.trim()}`,
    `${words.type}: ${words.types[details.type]}`,
  ];
  if (details.type === "dine-in")
    rows.push(`${words.table}: ${details.table.trim()}`);
  if (details.type === "delivery")
    rows.push(`${words.address}: ${details.address.trim()}`);
  rows.push(
    "",
    ...totals.lines.map(
      (line) =>
        `${line.quantity} × ${pickText(line.item.name, language)}${line.options.length ? ` (${line.options.map((option) => pickText(option.label, language)).join(", ")})` : ""} — ${formatPrice(line.total, language)}`,
    ),
    "",
    `${words.subtotal}: ${formatPrice(totals.subtotal, language)}`,
  );
  if (details.type === "delivery")
    rows.push(
      `${words.delivery}: ${formatPrice(totals.deliveryFee, language)}`,
    );
  rows.push(`${words.total}: ${formatPrice(totals.total, language)}`);
  if (details.notes.trim())
    rows.push("", `${words.notes}: ${details.notes.trim()}`);
  rows.push("", words.confirm);
  return rows.join("\n");
}

export function createWhatsAppUrl(number: string, message: string): string {
  const phone = number.replace(/[\s()+-]/g, "");
  if (!/^[1-9]\d{7,14}$/.test(phone))
    throw new Error(
      "The restaurant has not configured a valid WhatsApp number yet.",
    );
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function buildMenuUrl(
  baseUrl: string,
  shop?: string,
  table?: string,
): string {
  const base = new URL(baseUrl);
  if (!["https:", "http:"].includes(base.protocol))
    throw new Error("A valid website URL is required.");
  const url = new URL("/menu", base);
  if (shop) url.searchParams.set("shop", shop);
  if (table?.trim()) url.searchParams.set("table", table.trim().slice(0, 20));
  return url.toString();
}
