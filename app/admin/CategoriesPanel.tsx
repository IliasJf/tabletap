"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { Language, MenuCategory, MenuItem } from "../../lib/types";

const languages: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "fr", label: "French" },
  { id: "ar", label: "Arabic" },
];
export const MAX_CATEGORIES = 20;

export default function CategoriesPanel({
  categories,
  items,
  editable,
  newId,
  onChange,
}: {
  categories: MenuCategory[];
  items: MenuItem[];
  editable: boolean;
  newId: () => string;
  onChange: (categories: MenuCategory[]) => void;
}) {
  const used = (id: string) =>
    items.filter((item) => item.category === id).length;
  function update(index: number, language: Language, value: string) {
    onChange(
      categories.map((entry, i) =>
        i === index
          ? { ...entry, name: { ...entry.name, [language]: value } }
          : entry,
      ),
    );
  }
  function move(index: number, by: -1 | 1) {
    const next = [...categories];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  }

  return (
    <fieldset className="admin-settings" disabled={!editable}>
      <div className="admin-categories">
        <div className="admin-section-title">
          <p className="admin-note">
            Sections appear on your menu in this order. A section shows up for
            customers once it has at least one dish.
          </p>
          <button
            type="button"
            className="admin-secondary"
            disabled={categories.length >= MAX_CATEGORIES}
            onClick={() =>
              onChange([
                ...categories,
                {
                  id: newId(),
                  name: {
                    en: "New section",
                    fr: "Nouvelle rubrique",
                    ar: "قسم جديد",
                  },
                },
              ])
            }
          >
            <Plus size={16} />
            Add section
          </button>
        </div>
        {categories.map((entry, index) => {
          const count = used(entry.id);
          return (
            <section className="admin-category-row" key={entry.id}>
              <div className="admin-category-fields">
                {languages.map((language) => (
                  <label className="admin-field" key={language.id}>
                    {language.label}
                    <input
                      dir={language.id === "ar" ? "rtl" : "ltr"}
                      maxLength={60}
                      value={entry.name[language.id]}
                      onChange={(e) =>
                        update(index, language.id, e.target.value)
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="admin-category-meta">
                <span>
                  {count} {count === 1 ? "dish" : "dishes"}
                </span>
                <button
                  type="button"
                  className="admin-icon-button"
                  aria-label={`Move ${entry.name.en} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  className="admin-icon-button"
                  aria-label={`Move ${entry.name.en} down`}
                  disabled={index === categories.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  className="admin-icon-button admin-danger-button"
                  aria-label={`Delete ${entry.name.en}`}
                  title={
                    count
                      ? "Move or delete its dishes before removing this section."
                      : undefined
                  }
                  disabled={count > 0 || categories.length < 2}
                  onClick={() =>
                    onChange(categories.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </fieldset>
  );
}
