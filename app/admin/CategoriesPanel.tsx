"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { pickText } from "../../lib/text";
import type { Language, MenuCategory, MenuItem } from "../../lib/types";
import { useAdminCopy } from "./admin-copy";

const languages: Language[] = ["en", "fr", "ar"];
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
  const { t, language: uiLanguage } = useAdminCopy();
  const nameOf = (entry: MenuCategory) => pickText(entry.name, uiLanguage);
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
          <p className="admin-note">{t.sectionsNote}</p>
          <button
            type="button"
            className="admin-secondary"
            disabled={categories.length >= MAX_CATEGORIES}
            onClick={() =>
              onChange([
                ...categories,
                {
                  id: newId(),
                  name: { en: "", fr: "", ar: "", [uiLanguage]: t.newSection },
                },
              ])
            }
          >
            <Plus size={16} />
            {t.addSection}
          </button>
        </div>
        {categories.map((entry, index) => {
          const count = used(entry.id);
          return (
            <section className="admin-category-row" key={entry.id}>
              <div className="admin-category-fields">
                {languages.map((language) => (
                  <label className="admin-field" key={language}>
                    {t.translationLanguages[language]}
                    <input
                      dir={language === "ar" ? "rtl" : "ltr"}
                      maxLength={60}
                      value={entry.name[language]}
                      placeholder={pickText(entry.name, language)}
                      onChange={(e) => update(index, language, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <div className="admin-category-meta">
                <span>{t.dishesInSection(count)}</span>
                <button
                  type="button"
                  className="admin-icon-button"
                  aria-label={t.moveUp(nameOf(entry))}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  className="admin-icon-button"
                  aria-label={t.moveDown(nameOf(entry))}
                  disabled={index === categories.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  className="admin-icon-button admin-danger-button"
                  aria-label={t.deleteSection(nameOf(entry))}
                  title={count ? t.sectionInUse : undefined}
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
