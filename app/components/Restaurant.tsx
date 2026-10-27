"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Coffee,
  Copy,
  Leaf,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Utensils,
  X,
} from "lucide-react";
import { createSeedCatalog } from "../../lib/menu-data";
import {
  addToCart,
  buildWhatsAppMessage,
  calculateCart,
  createWhatsAppUrl,
  formatPrice,
  sanitizeCart,
  updateCartQuantity,
  validateOrder,
} from "../../lib/cart";
import type {
  CartItem,
  Catalog,
  Category,
  Language,
  MenuItem,
  OrderDetails,
  OrderType,
} from "../../lib/types";
import { copy } from "./copy";

function Mark() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15 38C18 28 28 18 36 10M24 26C13 28 8 22 10 16C17 15 23 18 24 26ZM29 21C27 11 32 6 38 7C40 14 36 20 29 21ZM18 33C9 35 5 31 6 26C12 24 17 27 18 33Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Photo({
  src,
  alt,
  className = "",
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className={`photo-fallback ${className}`} role="img" aria-label={alt}>
      <Utensils size={32} />
      <span>{alt}</span>
    </div>
  ) : (
    <img
      className={className}
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
function Modal({
  open,
  onClose,
  children,
  label,
  drawer = false,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  label: string;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
    if (open) {
      const old = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = old;
      };
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={drawer ? "modal cart-modal" : "modal item-modal"}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inside">{children}</div>
    </dialog>
  );
}

export default function Restaurant({
  menuOnly = false,
}: {
  menuOnly?: boolean;
}) {
  const [catalog, setCatalog] = useState<Catalog>(createSeedCatalog),
    [language, setLanguage] = useState<Language>("en"),
    [category, setCategory] = useState<Category | "all">("all"),
    [search, setSearch] = useState(""),
    [vegetarian, setVegetarian] = useState(false),
    [cart, setCart] = useState<CartItem[]>([]),
    [storageKey, setStorageKey] = useState(""),
    [shop, setShop] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [selected, setSelected] = useState<MenuItem | null>(null),
    [options, setOptions] = useState<string[]>([]),
    [quantity, setQuantity] = useState(1),
    [cartOpen, setCartOpen] = useState(false),
    [details, setDetails] = useState<OrderDetails>({
      name: "",
      type: "takeaway",
      table: "",
      address: "",
      notes: "",
    }),
    [message, setMessage] = useState(""),
    [formError, setFormError] = useState(""),
    [notice, setNotice] = useState(""),
    [copied, setCopied] = useState(false),
    [orderId, setOrderId] = useState("");
  const t = copy[language],
    restaurantName = catalog.settings.name || "TableTap",
    totals = calculateCart(
      cart,
      catalog.items,
      details.type === "delivery" ? catalog.settings.deliveryFee : 0,
    ),
    // Only sections with dishes get a tab.
    menuCategories = catalog.categories.filter((entry) =>
      catalog.items.some((item) => item.category === entry.id),
    );
  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    const params = new URLSearchParams(window.location.search),
      shopId = params.get("shop") || "";
    setShop(shopId);
    // Never show the demo café's details under another restaurant's link.
    if (shopId)
      setCatalog((current) => ({
        ...current,
        items: [],
        categories: [],
        settings: {
          ...current.settings,
          name: "",
          tagline: "",
          description: "",
          address: "",
          hours: "",
          whatsapp: "",
        },
      }));
    const table = params.get("table");
    if (table && /^\d{1,2}$/.test(table) && Number(table) > 0)
      setDetails((d) => ({
        ...d,
        type: "dine-in",
        table: String(Number(table)),
      }));
    try {
      const saved = localStorage.getItem("tabletap:language");
      if (saved === "en" || saved === "fr" || saved === "ar")
        setLanguage(saved);
    } catch {}
    setLoading(true);
    setError("");
    fetch(
      `/api/catalog${shopId ? `?shop=${encodeURIComponent(shopId)}` : ""}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        if (!r.ok) throw new Error("Menu unavailable");
        return r.json() as Promise<Catalog>;
      })
      .then((data) => {
        if (!live) return;
        setCatalog(data);
        const key = `tabletap:cart:v1:${shopId || "demo"}`;
        try {
          setCart(
            sanitizeCart(
              JSON.parse(localStorage.getItem(key) || "[]"),
              data.items,
            ),
          );
        } catch {
          setCart([]);
        }
        setStorageKey(key);
        setLoading(false);
      })
      .catch((e) => {
        if (live && e.name !== "AbortError") {
          setError("menu");
          setLoading(false);
        }
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [reload]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem("tabletap:language", language);
    } catch {}
  }, [language]);
  useEffect(() => {
    if (storageKey)
      try {
        localStorage.setItem(storageKey, JSON.stringify(cart));
      } catch {}
  }, [cart, storageKey]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);
  const filtered = catalog.items.filter(
    (item) =>
      (category === "all" || item.category === category) &&
      (!vegetarian ||
        item.tags.includes("vegetarian") ||
        item.tags.includes("vegan")) &&
      `${item.name[language]} ${item.description[language]} ${item.name.en}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  function pick(item: MenuItem) {
    setSelected(item);
    setQuantity(1);
    setOptions([]);
  }
  function addSelected() {
    if (!selected) return;
    setCart((c) => addToCart(c, selected, options, quantity));
    setSelected(null);
    setNotice(t.saved);
    setMessage("");
  }
  function changeQuantity(key: string, q: number) {
    setCart((c) => updateCartQuantity(c, key, q));
    setMessage("");
  }
  function preview(e: React.FormEvent) {
    e.preventDefault();
    const issue = validateOrder(details);
    if (issue) {
      setFormError(issue);
      return;
    }
    try {
      setMessage(buildWhatsAppMessage(cart, catalog, details, language));
      setOrderId(crypto.randomUUID().replaceAll("-", ""));
      setFormError("");
      setCopied(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to prepare order.",
      );
    }
  }
  function changeLanguage(next: Language) {
    setLanguage(next);
    if (!message) return;
    // Rebuild an open preview so the sent order matches the chosen language.
    try {
      setMessage(buildWhatsAppMessage(cart, catalog, details, next));
      setCopied(false);
    } catch {
      setMessage("");
    }
  }
  /** Records the order for the owner's dashboard. WhatsApp opens either way. */
  function recordOrder() {
    if (!shop || !orderId) return;
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, shop, cart, details, language }),
      keepalive: true,
    }).catch(() => {});
  }
  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setFormError("Please select and copy the message below.");
    }
  }
  let whatsappUrl = "";
  try {
    if (message)
      whatsappUrl = createWhatsAppUrl(catalog.settings.whatsapp, message);
  } catch {}
  return (
    <>
      <a className="skip-link" href="#menu">
        Skip to menu
      </a>
      <header className="site-header shell">
        <a
          className="brand"
          href={shop ? `/?shop=${encodeURIComponent(shop)}` : "/"}
          aria-label={`${restaurantName} home`}
        >
          <Mark />
          <span>{restaurantName}</span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#menu">{t.menu}</a>
          <a href="#story">{t.story}</a>
          <a href="#visit">{t.visit}</a>
        </nav>
        <div className="header-actions">
          <label className="language-select">
            <span className="sr-only">Language</span>
            <select
              aria-label="Language"
              value={language}
              onChange={(e) => changeLanguage(e.target.value as Language)}
            >
              <option value="en">EN</option>
              <option value="fr">FR</option>
              <option value="ar">عربي</option>
            </select>
          </label>
          <button
            className="bag-button"
            aria-label={`${t.cart} (${totals.itemCount})`}
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag size={20} />
            <span>{totals.itemCount}</span>
          </button>
        </div>
      </header>
      {!menuOnly && (
        <section className="hero shell" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">
              {(catalog.settings.tagline === "Good food. Slow mornings."
                ? t.hero
                : catalog.settings.tagline
              )
                .split("\n")
                .map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
            </h1>
            <p>{t.intro}</p>
            <a href="#menu" className="button primary">
              {t.explore}
              <ArrowDown size={18} />
            </a>
            <div className="hero-footnote">
              <Leaf size={18} />
              <span>
                {language === "fr"
                  ? "De saison. Tout simplement."
                  : language === "ar"
                    ? "مكونات موسمية. ببساطة."
                    : "Seasonal ingredients. Simple pleasures."}
              </span>
            </div>
          </div>
          <div className="hero-photos">
            <Photo
              src="/images/toast.jpg"
              alt="Avocado toast with tomatoes on a ceramic plate"
              className="hero-main-photo"
              eager
            />
            <div className="hero-small-photo">
              <Photo src="/images/coffee.jpg" alt="Freshly made coffee" eager />
              <span>
                {language === "fr"
                  ? "Encore un café ?"
                  : language === "ar"
                    ? "قهوة أخرى؟"
                    : "One more coffee?"}
              </span>
            </div>
            <div className="hero-photo-caption">
              <span>{restaurantName}</span>
              <span>
                {language === "fr"
                  ? "Prenez votre temps."
                  : language === "ar"
                    ? "خذ وقتك."
                    : "Take your time."}
              </span>
            </div>
          </div>
        </section>
      )}
      <main>
        <section
          id="menu"
          className={`menu-section shell ${menuOnly ? "menu-first" : ""}`}
          aria-labelledby="menu-title"
          data-ui
        >
          <div className="section-heading">
            <div>
              {menuOnly ? (
                <h1 id="menu-title">{t.menu}</h1>
              ) : (
                <h2 id="menu-title">{t.fresh}</h2>
              )}
              <p>{t.menuIntro}</p>
            </div>
            {catalog.settings.hours && (
              <span className="menu-note">
                <Clock3 size={17} />
                {catalog.settings.hours}
              </span>
            )}
          </div>
          {details.type === "dine-in" && details.table && (
            <p className="table-notice">
              <Utensils size={17} />
              {t.tableLabel} <strong>{details.table}</strong>
            </p>
          )}
          <div className="menu-toolbar">
            <div className="category-tabs" aria-label={t.menu}>
              {[
                { id: "all", label: t.all },
                ...menuCategories.map((entry) => ({
                  id: entry.id,
                  label: entry.name[language],
                })),
              ].map(({ id, label }) => (
                <button
                  key={id}
                  aria-pressed={category === id}
                  onClick={() => setCategory(id)}
                  className={category === id ? "active" : ""}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="menu-filter-row">
              <label className="search-box">
                <Search size={18} />
                <span className="sr-only">{t.search}</span>
                <input
                  type="search"
                  placeholder={t.search}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <button
                className={`veg-filter ${vegetarian ? "selected" : ""}`}
                aria-pressed={vegetarian}
                onClick={() => setVegetarian((v) => !v)}
              >
                <Leaf size={16} />
                {t.veg}
                {vegetarian && <Check size={14} />}
              </button>
            </div>
          </div>
          {loading ? (
            <div className="menu-state" role="status">
              <Coffee size={30} />
              <p>{t.menuLoading}</p>
            </div>
          ) : error ? (
            <div className="menu-state" role="alert">
              <h3>{t.error}</h3>
              <button
                className="button primary"
                onClick={() => setReload((v) => v + 1)}
              >
                {t.retry}
              </button>
              <a className="text-link" href="/menu">
                Open demo menu
              </a>
            </div>
          ) : filtered.length === 0 ? (
            <div className="menu-state">
              <Search size={30} />
              <h3>{t.noResults}</h3>
              <button
                className="text-link"
                onClick={() => {
                  setSearch("");
                  setVegetarian(false);
                  setCategory("all");
                }}
              >
                {t.clear}
              </button>
            </div>
          ) : (
            <div className="menu-grid">
              {filtered.map((item) => (
                <article
                  className={`menu-item ${!item.available ? "unavailable" : ""}`}
                  key={item.id}
                >
                  <button
                    className="menu-image-button"
                    disabled={!item.available}
                    onClick={() => pick(item)}
                    aria-label={`${t.customize}: ${item.name[language]}`}
                  >
                    <Photo src={item.image} alt={item.name[language]} />
                  </button>
                  <div className="menu-item-content">
                    <div className="menu-item-title">
                      <h3>{item.name[language]}</h3>
                      {(item.tags.includes("vegetarian") ||
                        item.tags.includes("vegan")) && (
                        <Leaf
                          className="diet-icon"
                          size={15}
                          aria-label={t.veg}
                        />
                      )}
                    </div>
                    <p>{item.description[language]}</p>
                    <div className="menu-item-bottom">
                      <strong>{formatPrice(item.price, language)}</strong>
                      <button
                        className="add-button"
                        disabled={!item.available}
                        onClick={() => pick(item)}
                        aria-label={`${t.add} ${item.name[language]}`}
                      >
                        {item.available ? (
                          <>
                            {t.add}
                            <Plus size={15} />
                          </>
                        ) : (
                          t.sold
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <p className="allergy-note">
            {language === "fr"
              ? "Des allergies ? Indiquez-les dans votre commande et demandez confirmation au café."
              : language === "ar"
                ? "لديك حساسية؟ اذكرها في طلبك واطلب التأكيد من المقهى."
                : "Food allergies? Include them in your order and check with the café before eating."}
          </p>
        </section>
        <section id="story" className="story-section shell">
          <div className="story-photo">
            <Photo
              src="/images/cafe.jpg"
              alt="Café interior with wooden tables and natural light"
            />
          </div>
          <div className="story-copy">
            <Leaf size={30} strokeWidth={1.25} />
            <h2>
              {t.about.split("\n").map((line, i) => (
                <span key={i}>{line}</span>
              ))}
            </h2>
            <p>{catalog.settings.description}</p>
            <a className="text-link" href="#visit">
              {t.visit}
              <ArrowUpRight size={18} />
            </a>
          </div>
        </section>
        <section id="visit" className="visit-section shell">
          <h2>{t.visitTitle}</h2>
          <div className="visit-detail">
            <MapPin size={21} />
            <div>
              <h3>{t.find}</h3>
              <p>{catalog.settings.address}</p>
            </div>
          </div>
          <div className="visit-detail">
            <Clock3 size={21} />
            <div>
              <h3>{t.hours}</h3>
              <p>{catalog.settings.hours}</p>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="shell footer-top">
          <a
            className="brand"
            href={shop ? `/?shop=${encodeURIComponent(shop)}` : "/"}
          >
            <Mark />
            <span>{restaurantName}</span>
          </a>
          <div className="footer-links">
            <a href="/admin">
              {t.owner}
              <ArrowUpRight size={14} />
            </a>
            <a href="/qr">
              {t.qr}
              <ArrowUpRight size={14} />
            </a>
            <a href="/privacy">{t.privacy}</a>
            <a href="/credits">Photo credits</a>
          </div>
        </div>
        <div className="shell footer-bottom">
          <span>{t.demoLabel}</span>
          <span>{t.powered} ↗</span>
        </div>
      </footer>
      {totals.itemCount > 0 && !cartOpen && (
        <button
          className="floating-cart"
          onClick={() => {
            setCartOpen(true);
            setMessage("");
          }}
        >
          <span className="cart-count">{totals.itemCount}</span>
          <span>{t.viewOrder}</span>
          <strong>{formatPrice(totals.total, language)}</strong>
          <ArrowRight size={19} />
        </button>
      )}
      <div
        className={`toast ${notice ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice && (
          <>
            <Check size={17} />
            {notice}
          </>
        )}
      </div>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        label={t.customize}
      >
        {selected && (
          <>
            <div className="item-modal-photo">
              <Photo src={selected.image} alt={selected.name[language]} eager />
              <button
                className="close-button"
                onClick={() => setSelected(null)}
                aria-label={t.close}
              >
                <X size={21} />
              </button>
            </div>
            <div className="item-modal-body">
              <div className="modal-title-row">
                <h2>{selected.name[language]}</h2>
                <strong>{formatPrice(selected.price, language)}</strong>
              </div>
              <p>{selected.description[language]}</p>
              {selected.options.length > 0 && (
                <fieldset className="extras">
                  <legend>{t.extras}</legend>
                  {selected.options.map((option) => (
                    <label key={option.id}>
                      <input
                        type="checkbox"
                        checked={options.includes(option.id)}
                        onChange={(e) =>
                          setOptions((o) =>
                            e.target.checked
                              ? [...o, option.id]
                              : o.filter((x) => x !== option.id),
                          )
                        }
                      />
                      <span>{option.label[language]}</span>
                      <strong>+{formatPrice(option.price, language)}</strong>
                    </label>
                  ))}
                </fieldset>
              )}
              <div className="item-add-row">
                <div className="quantity-control">
                  <button
                    aria-label="Decrease quantity"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((v) => v - 1)}
                  >
                    <Minus size={16} />
                  </button>
                  <output>{quantity}</output>
                  <button
                    aria-label="Increase quantity"
                    disabled={quantity >= 99}
                    onClick={() => setQuantity((v) => v + 1)}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <button className="button primary" onClick={addSelected}>
                  {t.addOrder}
                  <span>
                    {formatPrice(
                      (selected.price +
                        selected.options
                          .filter((o) => options.includes(o.id))
                          .reduce((sum, o) => sum + o.price, 0)) *
                        quantity,
                      language,
                    )}
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>
      <Modal
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        label={t.cart}
        drawer
      >
        <div className="cart-heading">
          <h2>
            {t.cart}
            <span>{totals.itemCount}</span>
          </h2>
          <button
            className="close-button"
            onClick={() => setCartOpen(false)}
            aria-label={t.close}
          >
            <X size={22} />
          </button>
        </div>
        {!totals.itemCount ? (
          <div className="empty-cart">
            <ShoppingBag size={45} strokeWidth={1} />
            <h3>{t.empty}</h3>
            <p>{t.emptyText}</p>
            <button
              className="button primary"
              onClick={() => setCartOpen(false)}
            >
              {t.continue}
              <ArrowRight size={17} />
            </button>
          </div>
        ) : message ? (
          <div className="order-preview">
            <button className="text-link" onClick={() => setMessage("")}>
              ← {t.back}
            </button>
            <h3>{t.message}</h3>
            <pre tabIndex={0}>{message}</pre>
            <p className="confirmation-note">{t.confirm}</p>
            {!whatsappUrl && <p className="demo-warning">{t.demo}</p>}
            {formError && (
              <p role="alert" className="form-error">
                {formError}
              </p>
            )}
            <button
              className="button secondary full-width"
              onClick={copyMessage}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? t.copied : t.copy}
            </button>
            {whatsappUrl ? (
              <a
                className="button primary full-width"
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={recordOrder}
              >
                {t.send}
                <ArrowUpRight size={18} />
              </a>
            ) : (
              <button className="button primary full-width" disabled>
                {t.send}
              </button>
            )}
          </div>
        ) : (
          <form className="cart-form" onSubmit={preview}>
            <div className="cart-lines">
              {totals.lines.map((line) => (
                <div className="cart-line" key={line.key}>
                  <Photo src={line.item.image} alt={line.item.name[language]} />
                  <div className="cart-line-body">
                    <div className="cart-line-title">
                      <h3>{line.item.name[language]}</h3>
                      <strong>{formatPrice(line.total, language)}</strong>
                    </div>
                    {line.options.length > 0 && (
                      <p>
                        {line.options.map((o) => o.label[language]).join(", ")}
                      </p>
                    )}
                    <div className="cart-line-controls">
                      <div className="quantity-control">
                        <button
                          type="button"
                          aria-label={`Remove one ${line.item.name[language]}`}
                          onClick={() =>
                            changeQuantity(line.key, line.quantity - 1)
                          }
                        >
                          <Minus size={14} />
                        </button>
                        <output>{line.quantity}</output>
                        <button
                          type="button"
                          aria-label={`Add one ${line.item.name[language]}`}
                          disabled={line.quantity >= 99}
                          onClick={() =>
                            changeQuantity(line.key, line.quantity + 1)
                          }
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        className="remove-line"
                        type="button"
                        aria-label={`Remove ${line.item.name[language]}`}
                        onClick={() => changeQuantity(line.key, 0)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <fieldset className="order-types">
              <legend>{t.orderType}</legend>
              <div>
                {(["dine-in", "takeaway", "delivery"] as OrderType[]).map(
                  (type) => (
                    <label
                      key={type}
                      className={details.type === type ? "selected" : ""}
                    >
                      <input
                        type="radio"
                        name="orderType"
                        value={type}
                        checked={details.type === type}
                        onChange={() => setDetails((d) => ({ ...d, type }))}
                      />
                      {type === "dine-in"
                        ? t.dine
                        : type === "takeaway"
                          ? t.takeaway
                          : t.delivery}
                    </label>
                  ),
                )}
              </div>
            </fieldset>
            <label className="form-field">
              {t.name}
              <input
                required
                maxLength={100}
                autoComplete="given-name"
                value={details.name}
                onChange={(e) =>
                  setDetails((d) => ({ ...d, name: e.target.value }))
                }
              />
            </label>
            {details.type === "dine-in" && (
              <label className="form-field">
                {t.table}
                <input
                  required
                  maxLength={20}
                  placeholder="5"
                  value={details.table}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, table: e.target.value }))
                  }
                />
              </label>
            )}
            {details.type === "delivery" && (
              <label className="form-field">
                {t.address}
                <textarea
                  required
                  minLength={5}
                  maxLength={300}
                  autoComplete="street-address"
                  value={details.address}
                  onChange={(e) =>
                    setDetails((d) => ({ ...d, address: e.target.value }))
                  }
                />
              </label>
            )}
            <label className="form-field">
              {t.notes}
              <span className="optional">{t.optional}</span>
              <textarea
                maxLength={500}
                placeholder={t.notesPlaceholder}
                value={details.notes}
                onChange={(e) =>
                  setDetails((d) => ({ ...d, notes: e.target.value }))
                }
              />
            </label>
            <div className="order-totals">
              <p>
                <span>{t.subtotal}</span>
                <span>{formatPrice(totals.subtotal, language)}</span>
              </p>
              {details.type === "delivery" && (
                <p>
                  <span>{t.deliveryFee}</span>
                  <span>{formatPrice(totals.deliveryFee, language)}</span>
                </p>
              )}
              <p className="grand-total">
                <span>{t.total}</span>
                <span>{formatPrice(totals.total, language)}</span>
              </p>
            </div>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button className="button primary full-width" type="submit">
              {t.preview}
              <ArrowRight size={18} />
            </button>
            <p className="cart-fine-print">{t.confirm}</p>
            <p className="cart-fine-print">
              {t.privacyNote.replace("{restaurant}", restaurantName)}{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">
                {t.privacy}
              </a>
            </p>
          </form>
        )}
      </Modal>
    </>
  );
}
