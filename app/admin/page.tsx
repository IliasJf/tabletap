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
import { formatPrice } from "../../lib/cart";
import { pickText } from "../../lib/text";
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
import {
  ADMIN_LANGUAGE_KEY,
  AdminCopyContext,
  adminCopy,
  initialAdminLanguage,
} from "./admin-copy";
import "./admin.css";

type View = "menu" | "categories" | "orders" | "restaurant" | "qr";
const languages: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
  { id: "ar", label: "العربية" },
];
/** Owners read names in the dashboard's language, falling back like customers do. */
const label = (text: Catalog["items"][number]["name"], language: Language) =>
  pickText(text, language);
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
  // The dashboard's own language, separate from the dish translation being edited.
  const [uiLanguage, setUiLanguage] = useState<Language>("en");
  const t = adminCopy[uiLanguage];
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
      if (!session.ok) throw new Error(t.errorSignIn);
      const sessionData = (await session.json()) as { user: AppUser | null };
      setUser(sessionData.user);
      if (sessionData.user) {
        const response = await fetch("/api/admin/catalog", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error((data as { error?: string }).error || t.errorLoad);
        setCatalog(validateCatalog(data));
        setSaved(validateCatalog(data));
      } else {
        const demo = createSeedCatalog();
        setCatalog(demo);
        setSaved(demo);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.errorLoad);
    } finally {
      setLoading(false);
    }
    // Messages follow the dashboard language at the time of loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setUiLanguage(initialAdminLanguage());
  }, []);
  function changeUiLanguage(next: Language) {
    setUiLanguage(next);
    try {
      localStorage.setItem(ADMIN_LANGUAGE_KEY, next);
    } catch {}
  }
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
      name: { en: "", fr: "", ar: "", [uiLanguage]: t.newDish },
      description: { en: "", fr: "", ar: "" },
      price: 0,
      image: "/images/toast.jpg",
      tags: [],
      available: true,
      options: [],
    };
    setCatalog((current) => ({ ...current, items: [...current.items, item] }));
    setSelectedId(item.id);
    setLanguage(uiLanguage);
    setNotice("");
  }
  function deleteItem() {
    if (
      !selected ||
      !window.confirm(t.confirmDelete(label(selected.name, uiLanguage)))
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
      setError(cause instanceof Error ? cause.message : t.errorFields);
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
        throw new Error((data as { error?: string }).error || t.errorSave);
      }
      setCatalog(validateCatalog(data));
      setSaved(validateCatalog(data));
      setNotice(t.savedNotice);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.errorSave);
    } finally {
      setSaving(false);
    }
  }
  async function signOut() {
    if (dirty && !window.confirm(t.confirmSignOut)) return;
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
        ? t.titleEditDish
        : t.titleMenu
      : view === "categories"
        ? t.titleSections
        : view === "orders"
          ? t.titleOrders
          : view === "restaurant"
            ? t.titleRestaurant
            : t.titleQr;

  return (
    <AdminCopyContext.Provider value={{ t, language: uiLanguage }}>
      <div
        className="admin-app"
        data-ui
        lang={uiLanguage}
        dir={uiLanguage === "ar" ? "rtl" : "ltr"}
      >
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
              <span>{user ? t.yourRestaurant : t.demoRestaurant}</span>
            </div>
          </div>
          <nav aria-label={t.ownerNavigation}>
            <button
              type="button"
              className={view === "menu" ? "active" : ""}
              onClick={() => switchView("menu")}
            >
              <LayoutList size={18} />
              {t.navMenu}
              <ChevronRight size={15} />
            </button>
            <button
              type="button"
              className={view === "categories" ? "active" : ""}
              onClick={() => switchView("categories")}
            >
              <ListOrdered size={18} />
              {t.navSections}
              <ChevronRight size={15} />
            </button>
            <button
              type="button"
              className={view === "orders" ? "active" : ""}
              onClick={() => switchView("orders")}
            >
              <ReceiptText size={18} />
              {t.navOrders}
              <ChevronRight size={15} />
            </button>
            <button
              type="button"
              className={view === "restaurant" ? "active" : ""}
              onClick={() => switchView("restaurant")}
            >
              <Settings size={18} />
              {t.navRestaurant}
              <ChevronRight size={15} />
            </button>
            <button
              type="button"
              className={view === "qr" ? "active" : ""}
              onClick={() => switchView("qr")}
            >
              <QrCode size={18} />
              {t.navQr}
              <ChevronRight size={15} />
            </button>
          </nav>
          <div className="admin-sidebar-bottom">
            <a href={publicLink} target="_blank" rel="noopener noreferrer">
              {t.viewCustomerMenu} <ArrowUpRight size={17} />
            </a>
            <div className="admin-account">
              <span>{user?.name?.slice(0, 1).toUpperCase() || "D"}</span>
              <div>
                <strong>{user?.name || t.demoWorkspace}</strong>
                <small>
                  {user ? t.signedInByEmail : t.exploreBeforeSignIn}
                </small>
              </div>
            </div>
            {user && (
              <button
                type="button"
                className="admin-signout"
                onClick={() => void signOut()}
              >
                {t.signOut}
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
              aria-label={navigationOpen ? t.closeNavigation : t.openNavigation}
              aria-expanded={navigationOpen}
            >
              {navigationOpen ? <X size={20} /> : <LayoutList size={20} />}
            </button>
            <span>{t.workspace}</span>
            <label className="admin-ui-language">
              <span className="sr-only">{t.dashboardLanguage}</span>
              <select
                value={uiLanguage}
                onChange={(e) => changeUiLanguage(e.target.value as Language)}
              >
                {languages.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </label>
            <a href="/">
              {t.backToCafe} <ArrowUpRight size={14} />
            </a>
          </header>
          <main className="admin-sheet">
            <div className="admin-title-row">
              <div>
                <h1>{title}</h1>
                <p>
                  {view === "menu"
                    ? t.introMenu
                    : view === "categories"
                      ? t.introSections
                      : view === "orders"
                        ? t.introOrders
                        : view === "restaurant"
                          ? t.introRestaurant
                          : t.introQr}
                </p>
              </div>
              {user && view !== "orders" && (
                <button
                  type="button"
                  className="admin-primary"
                  onClick={() => void save()}
                  disabled={
                    loading || saving || (!dirty && catalog.revision > 0)
                  }
                >
                  <Save size={16} />
                  {saving
                    ? t.saving
                    : dirty
                      ? t.saveChanges
                      : catalog.revision === 0
                        ? t.saveYourMenu
                        : t.saved}
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
                      if (window.confirm(t.confirmReloadSaved)) {
                        setSelectedId(null);
                        void load();
                      }
                    }}
                  >
                    {t.reloadSaved}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!dirty || window.confirm(t.confirmReload))
                        void load();
                    }}
                  >
                    <RefreshCw size={14} />
                    {t.retryLoading}
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
            {dirty && <p className="admin-unsaved">{t.unsaved}</p>}
            {loading ? (
              <div className="admin-loading" role="status">
                <p>{t.opening}</p>
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
                {user && catalog.revision === 0 && view !== "orders" && (
                  <p className="admin-notice">{t.sampleStart}</p>
                )}
                {view === "menu" && !selected && (
                  <>
                    <div
                      className="admin-category-tabs"
                      aria-label={t.filterCategories}
                    >
                      <button
                        type="button"
                        className={filter === "all" ? "active" : ""}
                        onClick={() => setFilter("all")}
                      >
                        {t.allDishes}
                      </button>
                      {categories.map((category) => (
                        <button
                          type="button"
                          key={category.id}
                          className={filter === category.id ? "active" : ""}
                          onClick={() => setFilter(category.id)}
                        >
                          {label(category.name, uiLanguage)}
                        </button>
                      ))}
                    </div>
                    <div className="admin-list-toolbar">
                      <label className="admin-search">
                        <Search size={17} />
                        <input
                          type="search"
                          aria-label={t.searchDishes}
                          placeholder={t.findDish}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                      <div>
                        <span>{t.dishCount(items.length)}</span>
                        {user && (
                          <button
                            className="admin-secondary"
                            type="button"
                            onClick={addItem}
                            disabled={catalog.items.length >= 100}
                          >
                            <Plus size={16} />
                            {t.addDish}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="admin-dish-list">
                      <div className="admin-dish-head">
                        <span>{t.columnDish}</span>
                        <span>{t.columnPrice}</span>
                        <span>{t.columnAvailability}</span>
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
                                <strong>{label(item.name, uiLanguage)}</strong>
                                <span>
                                  {(() => {
                                    const section = categories.find(
                                      (c) => c.id === item.category,
                                    );
                                    return section
                                      ? label(section.name, uiLanguage)
                                      : "";
                                  })()}
                                </span>
                              </div>
                            </div>
                            <span className="admin-dish-price">
                              {formatPrice(item.price, uiLanguage)}
                            </span>
                            <button
                              type="button"
                              className={`admin-availability ${item.available ? "" : "unavailable"}`}
                              aria-pressed={item.available}
                              aria-label={t.availabilityLabel(
                                label(item.name, uiLanguage),
                                item.available,
                                !!user,
                              )}
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
                              {item.available ? t.available : t.soldOut}
                            </button>
                            {user ? (
                              <button
                                className="admin-edit-button"
                                type="button"
                                onClick={() => {
                                  setSelectedId(item.id);
                                  setLanguage(uiLanguage);
                                }}
                              >
                                {t.edit} <ChevronRight size={14} />
                              </button>
                            ) : (
                              <span className="admin-readonly">
                                {t.preview}
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="admin-empty">
                          <p>{t.noMatches}</p>
                          <button
                            type="button"
                            className="admin-text-button"
                            onClick={() => {
                              setSearch("");
                              setFilter("all");
                            }}
                          >
                            {t.showAll}
                          </button>
                        </div>
                      )}
                    </div>
                    {!user && <p className="admin-note">{t.sampleNote}</p>}
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
                      {t.backToDishes}
                    </button>
                    <div className="admin-editor-layout">
                      <div className="admin-edit-fields">
                        <div
                          className="admin-language-tabs"
                          aria-label={t.editTranslation}
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
                          {t.dishName} ·{" "}
                          {
                            languages.find((lang) => lang.id === language)
                              ?.label
                          }
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
                          {t.description}
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
                          <small>{t.translationHint}</small>
                        </label>
                        <div className="admin-field-pair">
                          <label className="admin-field">
                            {t.priceDh}
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              max="10000"
                              step="0.01"
                              value={selected.price / 100}
                              onChange={(e) =>
                                editItem({
                                  price: Math.round(
                                    Number(e.target.value) * 100,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label className="admin-field">
                            {t.section}
                            <select
                              value={selected.category}
                              onChange={(e) =>
                                editItem({
                                  category: e.target.value as Category,
                                })
                              }
                            >
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {label(category.name, uiLanguage)}
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
                          {t.labels}
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
                            placeholder={t.labelsPlaceholder}
                          />
                          <small>{t.labelsHint}</small>
                        </label>
                        <label className="admin-checkbox">
                          <input
                            type="checkbox"
                            checked={selected.available}
                            onChange={(e) =>
                              editItem({ available: e.target.checked })
                            }
                          />
                          <span>{t.availableToOrder}</span>
                        </label>
                        <section className="admin-options">
                          <div className="admin-section-title">
                            <h2>{t.extrasTitle}</h2>
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
                                        en: "",
                                        fr: "",
                                        ar: "",
                                        [language]: t.newExtra,
                                      },
                                      price: 0,
                                    },
                                  ],
                                })
                              }
                            >
                              <Plus size={15} />
                              {t.addExtra}
                            </button>
                          </div>
                          {selected.options.length ? (
                            selected.options.map((option, index) => (
                              <div className="admin-option-row" key={option.id}>
                                <label className="admin-field">
                                  {t.extraName} · {language.toUpperCase()}
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
                                  {t.extraDh}
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
                                  aria-label={t.removeExtra(
                                    label(option.label, uiLanguage),
                                  )}
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
                            <p className="admin-note">{t.noExtras}</p>
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
                            {t.deleteDish}
                          </button>
                          <button
                            type="button"
                            className="admin-secondary"
                            onClick={() => setSelectedId(null)}
                          >
                            {t.doneEditing} <Check size={15} />
                          </button>
                        </div>
                      </div>
                      <aside className="admin-item-preview">
                        <img
                          src={selected.image}
                          alt={label(selected.name, language)}
                          onError={(e) => {
                            e.currentTarget.src = "/images/toast.jpg";
                          }}
                        />
                        <div dir={language === "ar" ? "rtl" : "ltr"}>
                          <span className="admin-preview-label">
                            {t.menuPreview}
                          </span>
                          {/* Shows exactly what customers see, fallbacks included. */}
                          <h2>
                            {label(selected.name, language) || t.previewName}
                          </h2>
                          <p>
                            {label(selected.description, language) ||
                              t.previewDescription}
                          </p>
                          <strong>
                            {formatPrice(selected.price, language)}
                          </strong>
                          <span className="admin-preview-status">
                            {selected.available
                              ? t.availableToOrder
                              : t.currentlySoldOut}
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
                      setCatalog((current) => ({
                        ...current,
                        categories: next,
                      }));
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
                        <h2>{t.yourRestaurantTitle}</h2>
                        <p>{t.yourRestaurantIntro}</p>
                      </div>
                      <div className="admin-setting-fields">
                        <label className="admin-field">
                          {t.restaurantName}
                          <input
                            maxLength={100}
                            value={catalog.settings.name}
                            onChange={(e) => setting("name", e.target.value)}
                          />
                        </label>
                        <label className="admin-field">
                          {t.tagline}
                          <input
                            maxLength={150}
                            value={catalog.settings.tagline}
                            onChange={(e) => setting("tagline", e.target.value)}
                          />
                        </label>
                        <label className="admin-field">
                          {t.about}
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
                        <h2>{t.findTableTitle}</h2>
                        <p>{t.findTableIntro}</p>
                      </div>
                      <div className="admin-setting-fields">
                        <label className="admin-field">
                          {t.address}
                          <input
                            maxLength={300}
                            value={catalog.settings.address}
                            onChange={(e) => setting("address", e.target.value)}
                          />
                        </label>
                        <label className="admin-field">
                          {t.hours}
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
                        <h2>{t.whatsappTitle}</h2>
                        <p>{t.whatsappIntro}</p>
                      </div>
                      <div className="admin-setting-fields">
                        <label className="admin-field">
                          {t.whatsappNumber}
                          <input
                            type="tel"
                            placeholder="212600000000"
                            value={catalog.settings.whatsapp}
                            onChange={(e) =>
                              setting("whatsapp", e.target.value)
                            }
                          />
                          <small>{t.whatsappHint}</small>
                        </label>
                        <label className="admin-field">
                          {t.deliveryFee}
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
                        <p className="admin-note">{t.pricesInDh}</p>
                      </div>
                    </section>
                    <section className="admin-setting-section">
                      <div>
                        <h2>{t.publicMenuTitle}</h2>
                        <p>{t.publicMenuIntro}</p>
                        {user && (
                          <a
                            className="admin-text-button"
                            href={publicLink}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t.openCustomerMenu} <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                      <div className="admin-setting-fields">
                        <label className="admin-field">
                          {t.linkName}
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
                          <small>{t.linkNameHint}</small>
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
                              {t.useSuggestion(slugify(catalog.settings.name))}
                            </button>
                          )}
                        <label className="admin-field">
                          {t.websiteAddress}
                          <input
                            type="url"
                            placeholder="https://your-cafe.com"
                            value={catalog.settings.publicUrl}
                            onChange={(e) =>
                              setting("publicUrl", e.target.value)
                            }
                          />
                          <small>{t.websiteHint}</small>
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
                      <p className="admin-notice">{t.saveBeforeSharing}</p>
                    )}
                  </>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </AdminCopyContext.Provider>
  );
}
