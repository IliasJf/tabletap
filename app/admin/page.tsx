"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Coffee,
  ExternalLink,
  LayoutList,
  ListOrdered,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import type {
  AppUser,
  Catalog,
  Category,
  Language,
  MenuItem,
  MenuOption,
} from "../../lib/types";
import { createSeedCatalog } from "../../lib/menu-data";
import {
  SLUG_PATTERN,
  slugify,
  validateCatalog,
} from "../../lib/catalog-validation";
import QrPanel from "../components/QrPanel";
import CategoriesPanel from "./CategoriesPanel";
import OrdersPanel from "./OrdersPanel";
import PhotoField from "./PhotoField";
import SignInPanel from "./SignInPanel";
import "./admin.css";

type View = "menu" | "categories" | "orders" | "restaurant" | "qr";
const languages: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
  { id: "ar", label: "العربية" },
];
const money = (price: number) => (price / 100).toFixed(2);
const newId = () => crypto.randomUUID().replaceAll("-", "");

export default function AdminPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [catalog, setCatalog] = useState<Catalog>(createSeedCatalog);
  const [saved, setSaved] = useState<Catalog>(createSeedCatalog);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<View>("menu");
  const [filter, setFilter] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("en");
  const [navigationOpen, setNavigationOpen] = useState(false);
  const dirty = JSON.stringify(catalog) !== JSON.stringify(saved);
  const selected = catalog.items.find((item) => item.id === selectedId);
  const categories = catalog.categories;
  // Customer links use the saved link name, so they never point at an unsaved one.
  const shopId = user ? saved.settings.slug || user.id : undefined;
  const publicLink = shopId
    ? `/menu?shop=${encodeURIComponent(shopId)}`
    : "/menu";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setConflict(false);
    try {
      const session = await fetch("/api/me", { cache: "no-store" });
      if (!session.ok)
        throw new Error("We could not check your sign-in. Please try again.");
      const sessionData = (await session.json()) as { user: AppUser | null };
      setUser(sessionData.user);
      if (sessionData.user) {
        const response = await fetch("/api/admin/catalog", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            (data as { error?: string }).error ||
              "Your menu could not be loaded.",
          );
        setCatalog(validateCatalog(data));
        setSaved(validateCatalog(data));
      } else {
        const demo = createSeedCatalog();
        setCatalog(demo);
        setSaved(demo);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your menu could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const items = useMemo(
    () =>
      catalog.items.filter(
        (item) =>
          (filter === "all" || item.category === filter) &&
          Object.values(item.name).some((name) =>
            name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
          ),
      ),
    [catalog.items, filter, search],
  );

  function editItem(patch: Partial<MenuItem>) {
    setCatalog((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === selectedId ? { ...item, ...patch } : item,
      ),
    }));
    setNotice("");
  }
  function editOption(index: number, patch: Partial<MenuOption>) {
    if (!selected) return;
    editItem({
      options: selected.options.map((option, i) =>
        i === index ? { ...option, ...patch } : option,
      ),
    });
  }
  function addItem() {
    const item: MenuItem = {
      id: newId(),
      category: filter === "all" ? categories[0].id : filter,
      name: { en: "New dish", fr: "Nouveau plat", ar: "طبق جديد" },
      description: { en: "", fr: "", ar: "" },
      price: 0,
      image: "/images/toast.jpg",
      tags: [],
      available: true,
      options: [],
    };
    setCatalog((current) => ({ ...current, items: [...current.items, item] }));
    setSelectedId(item.id);
    setLanguage("en");
    setNotice("");
  }
  function deleteItem() {
    if (
      !selected ||
      !window.confirm(
        `Remove “${selected.name.en}” from the menu? Save your menu to publish this change.`,
      )
    )
      return;
    setCatalog((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== selectedId),
    }));
    setSelectedId(null);
  }
  async function save() {
    setError("");
    setConflict(false);
    setNotice("");
    let checked: Catalog;
    try {
      checked = validateCatalog(catalog);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Please check the fields in your menu.",
      );
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checked),
      });
      const data = await response.json();
      if (!response.ok) {
        setConflict(response.status === 409);
        throw new Error(
          (data as { error?: string }).error ||
            "Your menu could not be saved. Please try again.",
        );
      }
      setCatalog(validateCatalog(data));
      setSaved(validateCatalog(data));
      setNotice("Your menu is saved. Customers can see the latest version.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your menu could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function signOut() {
    if (dirty && !window.confirm("Sign out and discard your unsaved changes?"))
      return;
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } finally {
      setSelectedId(null);
      setView("menu");
      void load();
    }
  }
  function switchView(next: View) {
    setView(next);
    setSelectedId(null);
    setNavigationOpen(false);
  }
  function setting<K extends keyof Catalog["settings"]>(
    key: K,
    value: Catalog["settings"][K],
  ) {
    setCatalog((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
    }));
    setNotice("");
  }
  const title =
    view === "menu"
      ? selected
        ? "Edit dish"
        : "Your menu"
      : view === "categories"
        ? "Menu sections"
        : view === "orders"
          ? "Orders"
          : view === "restaurant"
            ? "Restaurant details"
            : "QR codes";

  return (
    <div className="admin-app" data-ui>
      <aside
        className={`admin-sidebar ${navigationOpen ? "admin-sidebar-open" : ""}`}
      >
        <a className="admin-logo" href="/">
          <Coffee size={25} strokeWidth={1.6} />
          TableTap<span className="admin-logo-dot">.</span>
        </a>
        <div className="admin-workspace">
          <span className="admin-workspace-symbol">O&E</span>
          <div>
            <strong>{catalog.settings.name}</strong>
            <span>{user ? "Your restaurant" : "Demo restaurant"}</span>
          </div>
        </div>
        <nav aria-label="Owner navigation">
          <button
            type="button"
            className={view === "menu" ? "active" : ""}
            onClick={() => switchView("menu")}
          >
            <LayoutList size={18} />
            Menu
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            className={view === "categories" ? "active" : ""}
            onClick={() => switchView("categories")}
          >
            <ListOrdered size={18} />
            Sections
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            className={view === "orders" ? "active" : ""}
            onClick={() => switchView("orders")}
          >
            <ReceiptText size={18} />
            Orders
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            className={view === "restaurant" ? "active" : ""}
            onClick={() => switchView("restaurant")}
          >
            <Settings size={18} />
            Restaurant
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            className={view === "qr" ? "active" : ""}
            onClick={() => switchView("qr")}
          >
            <QrCode size={18} />
            QR codes
            <ChevronRight size={15} />
          </button>
        </nav>
        <div className="admin-sidebar-bottom">
          <a href={publicLink} target="_blank" rel="noopener noreferrer">
            View customer menu <ArrowUpRight size={17} />
          </a>
          <div className="admin-account">
            <span>{user?.name?.slice(0, 1).toUpperCase() || "D"}</span>
            <div>
              <strong>{user?.name || "Demo workspace"}</strong>
              <small>
                {user ? "Signed in by email" : "Explore before you sign in"}
              </small>
            </div>
          </div>
          {user && (
            <button
              type="button"
              className="admin-signout"
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          )}
        </div>
      </aside>
      <div className="admin-body">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-nav-toggle"
            onClick={() => setNavigationOpen((open) => !open)}
            aria-label={navigationOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={navigationOpen}
          >
            {navigationOpen ? <X size={20} /> : <LayoutList size={20} />}
          </button>
          <span>Restaurant workspace</span>
          <a href="/">
            Back to café <ArrowUpRight size={14} />
          </a>
        </header>
        <main className="admin-sheet">
          <div className="admin-title-row">
            <div>
              <h1>{title}</h1>
              <p>
                {view === "menu"
                  ? "A little care for every dish on the table."
                  : view === "categories"
                    ? "Group your dishes the way your guests think about them."
                    : view === "orders"
                      ? "Every order your guests prepare from your menu."
                      : view === "restaurant"
                        ? "The details your guests need before they order."
                        : "Make the next good meal one scan away."}
              </p>
            </div>
            {user && view !== "orders" && (
              <button
                type="button"
                className="admin-primary"
                onClick={() => void save()}
                disabled={loading || saving || (!dirty && catalog.revision > 0)}
              >
                <Save size={16} />
                {saving
                  ? "Saving…"
                  : dirty
                    ? "Save changes"
                    : catalog.revision === 0
                      ? "Save your menu"
                      : "Saved"}
              </button>
            )}
          </div>
          {error && (
            <div className="admin-message admin-message-error" role="alert">
              <p>{error}</p>
              {conflict ? (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Reload the saved menu? This will discard your unsaved changes.",
                      )
                    ) {
                      setSelectedId(null);
                      void load();
                    }
                  }}
                >
                  Reload saved menu
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      !dirty ||
                      window.confirm(
                        "Reload the menu and discard your unsaved changes?",
                      )
                    )
                      void load();
                  }}
                >
                  <RefreshCw size={14} />
                  Retry loading
                </button>
              )}
            </div>
          )}
          {notice && (
            <div className="admin-message" role="status">
              <Check size={16} />
              <p>{notice}</p>
            </div>
          )}
          {dirty && (
            <p className="admin-unsaved">
              You have unsaved changes. Save to update the customer menu.
            </p>
          )}
          {loading ? (
            <div className="admin-loading" role="status">
              <p>Opening your restaurant workspace…</p>
              {[1, 2, 3, 4].map((n) => (
                <div className="admin-skeleton-row" key={n}>
                  <span />
                  <div />
                  <span />
                </div>
              ))}
            </div>
          ) : (
            <>
              {!user && <SignInPanel onSignedIn={() => void load()} />}
              {user && catalog.revision === 0 && (
                <p className="admin-notice">
                  Your workspace starts with a sample café menu. Add your
                  restaurant details, then save to create your public menu.
                </p>
              )}
              {view === "menu" && !selected && (
                <>
                  <div
                    className="admin-category-tabs"
                    aria-label="Filter menu categories"
                  >
                    <button
                      type="button"
                      className={filter === "all" ? "active" : ""}
                      onClick={() => setFilter("all")}
                    >
                      All dishes
                    </button>
                    {categories.map((category) => (
                      <button
                        type="button"
                        key={category.id}
                        className={filter === category.id ? "active" : ""}
                        onClick={() => setFilter(category.id)}
                      >
                        {category.name.en}
                      </button>
                    ))}
                  </div>
                  <div className="admin-list-toolbar">
                    <label className="admin-search">
                      <Search size={17} />
                      <input
                        type="search"
                        aria-label="Search dishes"
                        placeholder="Find a dish…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <div>
                      <span>
                        {items.length} {items.length === 1 ? "dish" : "dishes"}
                      </span>
                      {user && (
                        <button
                          className="admin-secondary"
                          type="button"
                          onClick={addItem}
                          disabled={catalog.items.length >= 100}
                        >
                          <Plus size={16} />
                          Add dish
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="admin-dish-list">
                    <div className="admin-dish-head">
                      <span>Dish</span>
                      <span>Price</span>
                      <span>Availability</span>
                      <span />
                    </div>
                    {items.length ? (
                      items.map((item) => (
                        <div className="admin-dish-row" key={item.id}>
                          <div className="admin-dish-identity">
                            <img
                              src={item.image}
                              alt=""
                              width={60}
                              height={60}
                              onError={(e) => {
                                e.currentTarget.src = "/images/toast.jpg";
                              }}
                            />
                            <div>
                              <strong>{item.name.en}</strong>
                              <span>
                                {
                                  categories.find((c) => c.id === item.category)
                                    ?.name.en
                                }
                              </span>
                            </div>
                          </div>
                          <span className="admin-dish-price">
                            {money(item.price)} <small>MAD</small>
                          </span>
                          <button
                            type="button"
                            className={`admin-availability ${item.available ? "" : "unavailable"}`}
                            aria-pressed={item.available}
                            aria-label={`${item.name.en}: ${item.available ? "available" : "sold out"}${user ? ", toggle availability" : ""}`}
                            disabled={!user}
                            onClick={() =>
                              setCatalog((current) => ({
                                ...current,
                                items: current.items.map((row) =>
                                  row.id === item.id
                                    ? { ...row, available: !row.available }
                                    : row,
                                ),
                              }))
                            }
                          >
                            <span />
                            {item.available ? "Available" : "Sold out"}
                          </button>
                          {user ? (
                            <button
                              className="admin-edit-button"
                              type="button"
                              onClick={() => {
                                setSelectedId(item.id);
                                setLanguage("en");
                              }}
                            >
                              Edit <ChevronRight size={14} />
                            </button>
                          ) : (
                            <span className="admin-readonly">Preview</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="admin-empty">
                        <p>No dishes match your search.</p>
                        <button
                          type="button"
                          className="admin-text-button"
                          onClick={() => {
                            setSearch("");
                            setFilter("all");
                          }}
                        >
                          Show all dishes
                        </button>
                      </div>
                    )}
                  </div>
                  {!user && (
                    <p className="admin-note">
                      Sample menu for Olive & Ember. Prices and dishes are
                      editable after you sign in.
                    </p>
                  )}
                </>
              )}
              {view === "menu" && selected && (
                <div className="admin-editor">
                  <button
                    className="admin-text-button"
                    type="button"
                    onClick={() => setSelectedId(null)}
                  >
                    <ArrowLeft size={15} />
                    Back to dishes
                  </button>
                  <div className="admin-editor-layout">
                    <div className="admin-edit-fields">
                      <div
                        className="admin-language-tabs"
                        aria-label="Edit translation"
                      >
                        {languages.map((lang) => (
                          <button
                            type="button"
                            className={language === lang.id ? "active" : ""}
                            onClick={() => setLanguage(lang.id)}
                            key={lang.id}
                          >
                            {lang.label}
                          </button>
                        ))}
                      </div>
                      <label className="admin-field">
                        Dish name ·{" "}
                        {languages.find((lang) => lang.id === language)?.label}
                        <input
                          dir={language === "ar" ? "rtl" : "ltr"}
                          value={selected.name[language]}
                          maxLength={100}
                          onChange={(e) =>
                            editItem({
                              name: {
                                ...selected.name,
                                [language]: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      <label className="admin-field">
                        Description
                        <textarea
                          dir={language === "ar" ? "rtl" : "ltr"}
                          rows={3}
                          value={selected.description[language]}
                          maxLength={500}
                          onChange={(e) =>
                            editItem({
                              description: {
                                ...selected.description,
                                [language]: e.target.value,
                              },
                            })
                          }
                        />
                        <small>
                          Add the name and description in all three languages.
                        </small>
                      </label>
                      <div className="admin-field-pair">
                        <label className="admin-field">
                          Price (MAD)
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="10000"
                            step="0.01"
                            value={selected.price / 100}
                            onChange={(e) =>
                              editItem({
                                price: Math.round(Number(e.target.value) * 100),
                              })
                            }
                          />
                        </label>
                        <label className="admin-field">
                          Category
                          <select
                            value={selected.category}
                            onChange={(e) =>
                              editItem({ category: e.target.value as Category })
                            }
                          >
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name.en}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <PhotoField
                        key={selected.id}
                        value={selected.image}
                        onChange={(image) => editItem({ image })}
                      />
                      <label className="admin-field">
                        Labels
                        <input
                          value={selected.tags.join(", ")}
                          onChange={(e) =>
                            editItem({
                              tags: e.target.value
                                .split(",")
                                .map((tag) => tag.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="vegetarian, popular"
                        />
                        <small>
                          Separate labels with commas. Examples: vegetarian,
                          vegan, popular, signature.
                        </small>
                      </label>
                      <label className="admin-checkbox">
                        <input
                          type="checkbox"
                          checked={selected.available}
                          onChange={(e) =>
                            editItem({ available: e.target.checked })
                          }
                        />
                        <span>Available to order</span>
                      </label>
                      <section className="admin-options">
                        <div className="admin-section-title">
                          <h2>Extras & options</h2>
                          <button
                            type="button"
                            className="admin-text-button"
                            disabled={selected.options.length >= 12}
                            onClick={() =>
                              editItem({
                                options: [
                                  ...selected.options,
                                  {
                                    id: newId(),
                                    label: {
                                      en: "New extra",
                                      fr: "Nouveau supplément",
                                      ar: "إضافة جديدة",
                                    },
                                    price: 0,
                                  },
                                ],
                              })
                            }
                          >
                            <Plus size={15} />
                            Add extra
                          </button>
                        </div>
                        {selected.options.length ? (
                          selected.options.map((option, index) => (
                            <div className="admin-option-row" key={option.id}>
                              <label className="admin-field">
                                Name · {language.toUpperCase()}
                                <input
                                  dir={language === "ar" ? "rtl" : "ltr"}
                                  value={option.label[language]}
                                  maxLength={100}
                                  onChange={(e) =>
                                    editOption(index, {
                                      label: {
                                        ...option.label,
                                        [language]: e.target.value,
                                      },
                                    })
                                  }
                                />
                              </label>
                              <label className="admin-field">
                                Extra (MAD)
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  max="10000"
                                  step="0.01"
                                  value={option.price / 100}
                                  onChange={(e) =>
                                    editOption(index, {
                                      price: Math.round(
                                        Number(e.target.value) * 100,
                                      ),
                                    })
                                  }
                                />
                              </label>
                              <button
                                type="button"
                                className="admin-icon-button"
                                aria-label={`Remove ${option.label.en}`}
                                onClick={() =>
                                  editItem({
                                    options: selected.options.filter(
                                      (_, i) => i !== index,
                                    ),
                                  })
                                }
                              >
                                <X size={17} />
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="admin-note">
                            No extras for this dish. Add milk choices, toppings,
                            or other optional additions.
                          </p>
                        )}
                      </section>
                      <div className="admin-editor-bottom">
                        <button
                          type="button"
                          className="admin-danger-button"
                          disabled={catalog.items.length < 2}
                          onClick={deleteItem}
                        >
                          <Trash2 size={15} />
                          Delete dish
                        </button>
                        <button
                          type="button"
                          className="admin-secondary"
                          onClick={() => setSelectedId(null)}
                        >
                          Done editing <Check size={15} />
                        </button>
                      </div>
                    </div>
                    <aside className="admin-item-preview">
                      <img
                        src={selected.image}
                        alt={selected.name[language]}
                        onError={(e) => {
                          e.currentTarget.src = "/images/toast.jpg";
                        }}
                      />
                      <div dir={language === "ar" ? "rtl" : "ltr"}>
                        <span className="admin-preview-label">
                          Menu preview
                        </span>
                        <h2>{selected.name[language] || "Your dish name"}</h2>
                        <p>
                          {selected.description[language] ||
                            "Your dish description will appear here."}
                        </p>
                        <strong>{money(selected.price)} MAD</strong>
                        <span className="admin-preview-status">
                          {selected.available
                            ? "Available to order"
                            : "Currently sold out"}
                        </span>
                      </div>
                    </aside>
                  </div>
                </div>
              )}
              {view === "categories" && (
                <CategoriesPanel
                  categories={categories}
                  items={catalog.items}
                  editable={!!user}
                  newId={newId}
                  onChange={(next) => {
                    setCatalog((current) => ({ ...current, categories: next }));
                    if (!next.some((entry) => entry.id === filter))
                      setFilter("all");
                    setNotice("");
                  }}
                />
              )}
              {view === "orders" && <OrdersPanel signedIn={!!user} />}
              {view === "restaurant" && (
                <fieldset className="admin-settings" disabled={!user}>
                  <section className="admin-setting-section">
                    <div>
                      <h2>Your restaurant</h2>
                      <p>
                        Make the menu feel like your place, from the first hello
                        to the last coffee.
                      </p>
                    </div>
                    <div className="admin-setting-fields">
                      <label className="admin-field">
                        Restaurant name
                        <input
                          maxLength={100}
                          value={catalog.settings.name}
                          onChange={(e) => setting("name", e.target.value)}
                        />
                      </label>
                      <label className="admin-field">
                        Tagline
                        <input
                          maxLength={150}
                          value={catalog.settings.tagline}
                          onChange={(e) => setting("tagline", e.target.value)}
                        />
                      </label>
                      <label className="admin-field">
                        About the restaurant
                        <textarea
                          rows={4}
                          maxLength={1000}
                          value={catalog.settings.description}
                          onChange={(e) =>
                            setting("description", e.target.value)
                          }
                        />
                      </label>
                    </div>
                  </section>
                  <section className="admin-setting-section">
                    <div>
                      <h2>Find your table</h2>
                      <p>
                        Help guests plan a visit. Include your neighborhood and
                        any days you are closed.
                      </p>
                    </div>
                    <div className="admin-setting-fields">
                      <label className="admin-field">
                        Address
                        <input
                          maxLength={300}
                          value={catalog.settings.address}
                          onChange={(e) => setting("address", e.target.value)}
                        />
                      </label>
                      <label className="admin-field">
                        Opening hours
                        <input
                          maxLength={300}
                          value={catalog.settings.hours}
                          onChange={(e) => setting("hours", e.target.value)}
                        />
                      </label>
                    </div>
                  </section>
                  <section className="admin-setting-section">
                    <div>
                      <h2>WhatsApp ordering</h2>
                      <p>
                        Orders arrive as messages for your team to confirm.
                        Customers pay you directly.
                      </p>
                    </div>
                    <div className="admin-setting-fields">
                      <label className="admin-field">
                        WhatsApp number
                        <input
                          type="tel"
                          placeholder="212600000000"
                          value={catalog.settings.whatsapp}
                          onChange={(e) => setting("whatsapp", e.target.value)}
                        />
                        <small>
                          Include the country code. Leave blank to keep ordering
                          in demo mode.
                        </small>
                      </label>
                      <label className="admin-field">
                        Delivery fee (MAD)
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="1000"
                          step="0.01"
                          value={catalog.settings.deliveryFee / 100}
                          onChange={(e) =>
                            setting(
                              "deliveryFee",
                              Math.round(Number(e.target.value) * 100),
                            )
                          }
                        />
                      </label>
                      <p className="admin-note">
                        All menu prices use Moroccan dirhams (MAD).
                      </p>
                    </div>
                  </section>
                  <section className="admin-setting-section">
                    <div>
                      <h2>Your public menu</h2>
                      <p>
                        Use your published website address for printable QR
                        codes.
                      </p>
                      {user && (
                        <a
                          className="admin-text-button"
                          href={publicLink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open customer menu <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    <div className="admin-setting-fields">
                      <label className="admin-field">
                        Menu link name
                        <div className="admin-slug-input">
                          <span>/menu?shop=</span>
                          <input
                            maxLength={60}
                            placeholder={slugify(catalog.settings.name)}
                            value={catalog.settings.slug}
                            onChange={(e) =>
                              setting("slug", e.target.value.toLowerCase())
                            }
                            aria-invalid={
                              !!catalog.settings.slug &&
                              !SLUG_PATTERN.test(catalog.settings.slug)
                            }
                          />
                        </div>
                        <small>
                          A short name for your QR codes and links, like
                          olive-and-ember. Older links keep working after you
                          change it.
                        </small>
                      </label>
                      {!catalog.settings.slug &&
                        slugify(catalog.settings.name).length >= 3 && (
                          <button
                            type="button"
                            className="admin-text-button admin-slug-suggest"
                            onClick={() =>
                              setting("slug", slugify(catalog.settings.name))
                            }
                          >
                            Use “{slugify(catalog.settings.name)}”
                          </button>
                        )}
                      <label className="admin-field">
                        Website address
                        <input
                          type="url"
                          placeholder="https://your-cafe.com"
                          value={catalog.settings.publicUrl}
                          onChange={(e) => setting("publicUrl", e.target.value)}
                        />
                        <small>
                          Leave blank to use the current website address.
                        </small>
                      </label>
                    </div>
                  </section>
                </fieldset>
              )}
              {view === "qr" && (
                <>
                  <QrPanel
                    shopId={shopId}
                    publicUrl={saved.settings.publicUrl}
                    restaurantName={saved.settings.name}
                  />
                  {user && saved.revision === 0 && (
                    <p className="admin-notice">
                      Save your restaurant before sharing this code. Your menu
                      is not published yet.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
