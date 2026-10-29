"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BellRing,
  Check,
  ChefHat,
  RefreshCw,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { formatPrice } from "../../lib/cart";
import type { OrderRecord, OrderStatus } from "../../lib/orders";
import { useAdminCopy } from "./admin-copy";

/** How often an open Orders screen checks for new orders. */
const REFRESH_MS = 30_000;
const SOUND_KEY = "tabletap:order-sound";

type Filter = "active" | "finished" | "all";
const filters: { id: Filter; statuses: OrderStatus[] }[] = [
  { id: "active", statuses: ["new", "preparing"] },
  { id: "finished", statuses: ["done", "cancelled"] },
  { id: "all", statuses: ["new", "preparing", "done", "cancelled"] },
];

function isToday(timestamp: number) {
  return new Date(timestamp).toDateString() === new Date().toDateString();
}

/** A short two-note chime, made in the browser so there is no file to load. */
function playChime(context: AudioContext) {
  const start = context.currentTime;
  for (const [offset, frequency] of [
    [0, 880],
    [0.18, 1320],
  ]) {
    const tone = context.createOscillator();
    const gain = context.createGain();
    tone.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.35);
    tone.connect(gain).connect(context.destination);
    tone.start(start + offset);
    tone.stop(start + offset + 0.4);
  }
}

export default function OrdersPanel({ signedIn }: { signedIn: boolean }) {
  const { t, language } = useAdminCopy();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(signedIn);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [sound, setSound] = useState(true);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState(0);
  // IDs already shown, so only orders that arrive while the screen is open alert.
  const seen = useRef<Set<string> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    try {
      setSound(localStorage.getItem(SOUND_KEY) !== "off");
    } catch {}
  }, []);

  function chime() {
    try {
      audio.current ??= new AudioContext();
      const context = audio.current;
      void context.resume().then(() => playChime(context));
    } catch {}
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {}
    // Browsers only allow sound after a tap; this tap unlocks it.
    if (next) chime();
  }

  const announce = useCallback((arrived: string[]) => {
    setFresh(new Set(arrived));
    setToast(arrived.length);
    if (soundRef.current) chime();
  }, []);

  /** Background refreshes stay quiet so the list doesn't flicker mid-service. */
  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setLoading(true);
        setError("");
      }
      try {
        const response = await fetch("/api/admin/orders", {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          orders?: OrderRecord[];
          error?: string;
        };
        if (!response.ok) throw new Error(data.error || "");
        const next = data.orders ?? [];
        if (seen.current) {
          const known = seen.current;
          const arrived = next
            .filter((order) => order.status === "new" && !known.has(order.id))
            .map((order) => order.id);
          if (arrived.length) announce(arrived);
        }
        seen.current = new Set(next.map((order) => order.id));
        setOrders(next);
        setUpdatedAt(Date.now());
        setError("");
      } catch (cause) {
        if (!quiet)
          setError(
            cause instanceof Error && cause.message ? cause.message : "load",
          );
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [announce],
  );
  useEffect(() => {
    if (!signedIn) return;
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, REFRESH_MS);
    // Coming back to the tab checks at once instead of waiting for the timer.
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn, load]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(0);
      setFresh(new Set());
    }, 10_000);
    return () => clearTimeout(timer);
  }, [toast]);

  const waiting = orders.filter((order) => order.status === "new").length;
  // The tab title shows waiting orders, so the owner sees them from another tab.
  useEffect(() => {
    if (!signedIn) return;
    const original = document.title;
    if (waiting) document.title = `${t.newOrdersTitle(waiting)} · TableTap`;
    return () => {
      document.title = original;
    };
  }, [signedIn, waiting, t]);

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
      if (!response.ok) throw new Error(data.error || "");
      setOrders((current) =>
        current.map((row) => (row.id === order.id ? data : row)),
      );
    } catch (cause) {
      setOrders((current) =>
        current.map((row) => (row.id === order.id ? order : row)),
      );
      setError(
        cause instanceof Error && cause.message ? cause.message : "update",
      );
    } finally {
      setPending(null);
    }
  }

  if (!signedIn) return <p className="admin-note">{t.ordersSignIn}</p>;

  const locale =
    language === "ar" ? "ar-MA" : language === "fr" ? "fr" : "en-GB";
  const time = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const clock = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const money = (amount: number) => formatPrice(amount, language);
  const preparing = orders.filter(
    (order) => order.status === "preparing",
  ).length;
  const today = orders.filter(
    (order) => isToday(order.createdAt) && order.status !== "cancelled",
  );
  const visible = orders.filter((order) =>
    filters
      .find((entry) => entry.id === filter)!
      .statuses.includes(order.status),
  );
  const errorText =
    error === "load"
      ? t.ordersError
      : error === "update"
        ? t.updateError
        : error;
  const filterLabel = {
    active: t.inProgress,
    finished: t.finished,
    all: t.all,
  };

  return (
    <div className="admin-orders">
      {toast > 0 && (
        <div className="admin-order-toast" role="status">
          <BellRing size={17} />
          {t.newOrderToast(toast)}
        </div>
      )}
      <dl className="admin-order-summary">
        <div className={waiting ? "admin-order-attention" : ""}>
          <dt>{t.toConfirm}</dt>
          <dd>{waiting}</dd>
        </div>
        <div>
          <dt>{t.preparing}</dt>
          <dd>{preparing}</dd>
        </div>
        <div>
          <dt>{t.today}</dt>
          <dd>
            {today.length} ·{" "}
            {money(today.reduce((sum, order) => sum + order.total, 0))}
          </dd>
        </div>
      </dl>
      <div className="admin-order-toolbar">
        <div className="admin-category-tabs" aria-label={t.filterOrders}>
          {filters.map((entry) => (
            <button
              type="button"
              key={entry.id}
              className={filter === entry.id ? "active" : ""}
              aria-pressed={filter === entry.id}
              onClick={() => setFilter(entry.id)}
            >
              {filterLabel[entry.id]}
            </button>
          ))}
        </div>
        <div className="admin-order-tools">
          <button
            type="button"
            className="admin-icon-text"
            onClick={toggleSound}
            aria-pressed={sound}
          >
            {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
            <span>{sound ? t.soundOn : t.soundOff}</span>
          </button>
          <button
            type="button"
            className="admin-icon-text"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            <span>{loading ? t.refreshing : t.refresh}</span>
          </button>
        </div>
      </div>
      {updatedAt && (
        <p className="admin-order-checked">
          {t.checkedAt(clock.format(updatedAt))}
        </p>
      )}
      {errorText && (
        <div className="admin-message admin-message-error" role="alert">
          <p>{errorText}</p>
        </div>
      )}
      {!loading && !error && !visible.length && (
        <div className="admin-empty">
          <p>
            {orders.length
              ? filter === "active"
                ? t.nothingWaiting
                : t.noneHere
              : t.noOrders}
          </p>
        </div>
      )}
      <ol className="admin-order-list">
        {visible.map((order) => (
          <li
            className={`admin-order admin-order-${order.status}${fresh.has(order.id) ? " admin-order-fresh" : ""}`}
            key={order.id}
          >
            <div className="admin-order-head">
              <div>
                <strong>
                  {order.name}
                  <span className={`admin-order-status ${order.status}`}>
                    {t.status[order.status]}
                  </span>
                </strong>
                <span>
                  {t.orderType[order.type]}
                  {order.table && ` · ${t.table(order.table)}`}
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
                  <span>{t.delivery}</span>
                  <span>{money(order.deliveryFee)}</span>
                </li>
              )}
            </ul>
            {order.address && <p>{t.addressLine(order.address)}</p>}
            {order.notes && <p>{t.notesLine(order.notes)}</p>}
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
                    {t.confirmPrepare}
                  </button>
                  <button
                    type="button"
                    className="admin-text-button"
                    disabled={pending === order.id}
                    onClick={() => void changeStatus(order, "cancelled")}
                  >
                    <X size={15} />
                    {t.notReceived}
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
                    {t.markDone}
                  </button>
                  <button
                    type="button"
                    className="admin-text-button"
                    disabled={pending === order.id}
                    onClick={() => void changeStatus(order, "cancelled")}
                  >
                    <X size={15} />
                    {t.cancelOrder}
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
                  {t.reopen}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      <details className="admin-order-help">
        <summary>{t.howOrdersWork}</summary>
        <p>{t.ordersHelp}</p>
      </details>
    </div>
  );
}
