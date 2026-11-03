import { type Locale, useLocales } from 'expo-localization';
import { useMemo } from 'react';

import { ar } from './locales/ar';
import { bn } from './locales/bn';
import { en, type TranslationKey, type Translations } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { hi } from './locales/hi';
import { id } from './locales/id';
import { pt } from './locales/pt';
import { ru } from './locales/ru';
import { zh } from './locales/zh';

export type { TranslationKey };

const LOCALES = { en, zh, hi, es, ar, fr, bn, pt, ru, id } satisfies Record<string, Translations>;

export type Language = keyof typeof LOCALES;

type Params = Record<string, string | number>;

/** Picks the first of the user's preferred languages that the app supports, else English. */
export function resolveLanguage(locales: readonly Locale[]): Language {
  for (const locale of locales) {
    const code = locale.languageCode?.toLowerCase();
    if (code && code in LOCALES) return code as Language;
  }
  return 'en';
}

function format(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

type PluralBase<K = TranslationKey> = K extends `${infer B}_one` ? B : never;

export function createTranslator(language: Language) {
  const strings = LOCALES[language];
  const t = (key: TranslationKey, params?: Params) => format(strings[key] ?? en[key], params);
  /** Picks `<key>_one` for a count of 1 and `<key>_other` otherwise; `{count}` is filled in. */
  const tn = (key: PluralBase, count: number, params?: Params) =>
    t(`${key}_${count === 1 ? 'one' : 'other'}` as TranslationKey, { count, ...params });
  return { t, tn, language };
}

export type Translator = ReturnType<typeof createTranslator>;

/** Translator for the device language; re-renders when the system language changes. */
export function useT(): Translator {
  const language = resolveLanguage(useLocales());
  return useMemo(() => createTranslator(language), [language]);
}
