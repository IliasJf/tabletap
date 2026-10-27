"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChefHat, RefreshCw, RotateCcw, X } from "lucide-react";
import type { OrderRecord, OrderStatus } from "../../lib/orders";

const money = (price: number) => `${(price / 100).toFixed(2)} MAD`;
const typeLabel = {
  "dine-in": "Dine-in",
  takeaway: "Takeaway",
  delivery: "Delivery",
} as const;
const statusLabel: Record<OrderStatus, string> = {
  new: "New",
  preparing: "Preparing",
  done: "Done",
  cancelled: "Cancelled",
};
const time = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const clock = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});
/** How often an open Orders screen checks for new orders. */
const REFRESH_MS = 30_000;

type Filter = "active" | "finished" | "all";
const filters: { id: Filter; label: string; statuses: OrderStatus[] }[] = [
  { id: "active", label: "In progress", statuses: ["new", "preparing"] },
  { id: "finished", label: "Finished", statuses: ["done", "cancelled"] },
  {
    id: "all",
    label: "All",
    statuses: ["new", "preparing", "done", "cancelled"],
  },
];

function isToday(timestamp: number) {
  return new Date(timestamp).toDateString() === new Date().toDateString();
}

export default function OrdersPanel({ signedIn }: { signedIn: boolean }) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(signedIn);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  /** Background refreshes stay quiet so the list doesn't flicker mid-service. */
  const load = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError("");
    }
    try {
      const response = await fetch("/api/admin/orders", { cache: "no-store" });
      const data = (await response.json()) as {
        orders?: OrderRecord[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || "Your orders could not be loaded.");
      setOrders(data.orders ?? []);
      setUpdatedAt(Date.now());
      setError("");
    } catch (cause) {
      if (!quiet)
        setError(
          cause instanceof Error
            ? cause.message
            : "Your orders could not be loaded.",
        );
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [signedIn, load]);

  async function changeStatus(order: OrderRecord, status: OrderStatus) {
    setPending(order.id);
    setError("");
    // Show the change at once; put it back if the server refuses.
    setOrders((current) =>
      current.map((row) => (row.id === order.id ? { ...row, status } : row)),
    );
    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status }),
      });
      const data = (await response.json()) as OrderRecord & { error?: string };
      if (!response.ok)
        throw new Error(data.error || "The order could not be updated.");
      setOrders((current) =>
        current.map((row) => (row.id === order.id ? data : row)),
      );
    } catch (cause) {
      setOrders((current) =>
        current.map((row) => (row.id === order.id ? order : row)),
      );
      setError(
        cause instanceof Error
          ? cause.message
          : "The order could not be updated.",
      );
    } finally {
      setPending(null);
    }
  }

  if (!signedIn)
    return (
      <p className="admin-note">
        Sign in to see the orders customers send from your menu.
      </p>
    );

  const count = (status: OrderStatus) =>
    orders.filter((order) => order.status === status).length;
  const today = orders.filter(
    (order) => isToday(order.createdAt) && order.status !== "cancelled",
  );
  const visible = orders.filter((order) =>
    filters
      .find((entry) => entry.id === filter)!
      .statuses.includes(order.status),
  );
  return (
    <div className="admin-orders">
      <div className="admin-order-summary">
        <div className={count("new") ? "admin-order-attention" : ""}>
          <span>To confirm</span>
          <strong>{count("new")}</strong>
        </div>
        <div>
          <span>Preparing</span>
          <strong>{count("preparing")}</strong>
        </div>
        <div>
          <span>Today</span>
          <strong>
            {today.length} · {money(today.reduce((sum, o) => sum + o.total, 0))}
          </strong>
        </div>
        <button
          type="button"
          className="admin-secondary"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={15} />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <p className="admin-note">
        New orders appear here when a customer opens WhatsApp. Check the message
        arrived, then tap <strong>Confirm</strong>. This list refreshes every 30
        seconds
        {updatedAt ? ` (last checked ${clock.format(updatedAt)})` : ""}.
      </p>
      <div className="admin-category-tabs" aria-label="Filter orders">
        {filters.map((entry) => (
          <button
            type="button"
            key={entry.id}
            className={filter === entry.id ? "active" : ""}
            aria-pressed={filter === entry.id}
            onClick={() => setFilter(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {error && (
        <div className="admin-message admin-message-error" role="alert">
          <p>{error}</p>
        </div>
      )}
      {!loading && !error && !visible.length && (
        <div className="admin-empty">
          <p>
            {orders.length
              ? filter === "active"
                ? "Nothing waiting. New orders will show up here."
                : "No orders here yet."
              : "No orders yet. Share your menu link or QR code, and new orders will show up here."}
          </p>
        </div>
      )}
      <ol className="admin-order-list">
        {visible.map((order) => (
          <li
            className={`admin-order admin-order-${order.status}`}
            key={order.id}
          >
            <div className="admin-order-head">
              <div>
                <strong>
                  {order.name}
                  <span className={`admin-order-status ${order.status}`}>
                    {statusLabel[order.status]}
                  </span>
                </strong>
                <span>
                  {typeLabel[order.type]}
                  {order.table && ` · Table ${order.table}`}
                </span>
              </div>
              <div className="admin-order-total">
                <strong>{money(order.total)}</strong>
                <time dateTime={new Date(order.createdAt).toISOString()}>
                  {time.format(order.createdAt)}
                </time>
              </div>
            </div>
            <ul>
              {order.lines.map((line, i) => (
                <li key={i}>
                  <span>
                    {line.quantity} × {line.name}
                    {line.options.length > 0 && (
                      <small> ({line.options.join(", ")})</small>
                    )}
                  </span>
                  <span>{money(line.total)}</span>
                </li>
              ))}
              {order.deliveryFee > 0 && (
                <li>
                  <span>Delivery</span>
                  <span>{money(order.deliveryFee)}</span>
                </li>
              )}
            </ul>
            {order.address && <p>Address: {order.address}</p>}
            {order.notes && <p>Notes: {order.notes}</p>}
            <div className="admin-order-actions">
              {order.status === "new" && (
                <>
                  <button
                    type="button"
                    className="admin-primary"
                    disabled={pending === order.id}
                    onClick={() => void changeStatus(order, "preparing")}
                  >
                    <ChefHat size={15} />
                    Confirm & prepare
                  </button>
                  <button
                    type="button"
                    className="admin-text-button"
                    disabled={pending === order.id}
                    onClick={() => void changeStatus(order, "cancelled")}
                  >
                    <X size={15} />
                    Not received
                  </button>
                </>
              )}
              {order.status === "preparing" && (
                <>
                  <button
                    type="button"
                    className="admin-primary"
                    disabled={pending === order.id}
                    onClick={() => void changeStatus(order, "done")}
                  >
                    <Check size={15} />
                    Mark as done
                  </button>
                  <button
                    type="button"
                    className="admin-text-button"
                    disabled={pending === order.id}
                    onClick={() => void changeStatus(order, "cancelled")}
                  >
                    <X size={15} />
                    Cancel order
                  </button>
                </>
              )}
              {(order.status === "done" || order.status === "cancelled") && (
                <button
                  type="button"
                  className="admin-text-button"
                  disabled={pending === order.id}
                  onClick={() => void changeStatus(order, "preparing")}
                >
                  <RotateCcw size={15} />
                  Reopen
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
