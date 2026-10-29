import type { Language, LocalizedText } from "./types";

/**
 * Owners may write only some translations. Show the requested language,
 * then English, French and Arabic, so customers never see a blank.
 */
export function pickText(text: LocalizedText, language: Language): string {
  return text[language] || text.en || text.fr || text.ar || "";
}
