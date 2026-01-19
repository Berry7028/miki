import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en from "../locales/en.json";
import ja from "../locales/ja.json";

export type Locale = "en" | "ja";

type TranslationData = Record<string, any>;

type InterpolationValues = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: string) => void;
  t: (key: string, values?: InterpolationValues) => string;
};

const translations: Record<Locale, TranslationData> = {
  en,
  ja,
};

const defaultLocale: Locale = "en";
const supportedLocales: Locale[] = ["en", "ja"];

const getValue = (data: TranslationData, key: string) =>
  key.split(".").reduce((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return acc[part];
    }
    return undefined;
  }, data as any);

const interpolate = (text: string, values?: InterpolationValues) =>
  text.replace(/\{\{(\w+)\}\}/g, (_match, key) => String(values?.[key] ?? ""));

const normalizeLocale = (locale: string | undefined | null): Locale => {
  if (locale && supportedLocales.includes(locale as Locale)) {
    return locale as Locale;
  }
  return defaultLocale;
};

const translate = (locale: Locale, key: string, values?: InterpolationValues) => {
  const value = getValue(translations[locale], key) ?? getValue(translations[defaultLocale], key);
  if (typeof value !== "string") {
    return key;
  }
  return interpolate(value, values);
};

const I18nContext = createContext<I18nContextValue>({
  locale: defaultLocale,
  setLocale: () => {},
  t: (key) => key,
});

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    let active = true;
    const loadLocale = async () => {
      try {
        const value = await window.miki?.getLocale?.();
        if (active) {
          setLocaleState(normalizeLocale(value));
        }
      } catch (error) {
        console.warn("Failed to load locale:", error);
      }
    };
    loadLocale();
    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback((nextLocale: string) => {
    const normalized = normalizeLocale(nextLocale);
    setLocaleState(normalized);
    window.miki?.setLocale?.(normalized);
  }, []);

  const t = useCallback(
    (key: string, values?: InterpolationValues) => translate(locale, key, values),
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
