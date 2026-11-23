// English/German support. English is the default and keeps the existing URLs; German lives under /de/.
// Pages render from shared views with a `lang` prop; UI strings come from ./ui.ts. A missing German
// key is a test failure (tests/unit/i18n.test.ts), never a silent fallback.
import { UI, type UiKey } from './ui';

export const LOCALES = ['en', 'de'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_NAME: Record<Locale, string> = { en: 'English', de: 'Deutsch' };
export const OG_LOCALE: Record<Locale, string> = { en: 'en_GB', de: 'de_DE' };

/** Routes that exist in both languages (German at /de + path). Anything else is English-only. */
export const LOCALIZED_ROUTES = ['/', '/work/', '/skills/', '/lab/', '/about/', '/recruiter/', '/resume/', '/security-lab/', '/ai-lab/', '/xray/', '/privacy/'];

export function localeFromPath(pathname: string): Locale {
  return pathname === '/de' || pathname.startsWith('/de/') ? 'de' : 'en';
}

/** The language-neutral path ("/de/work/x/" → "/work/x/"). */
export function basePath(pathname: string): string {
  if (pathname === '/de' || pathname === '/de/') return '/';
  return pathname.startsWith('/de/') ? pathname.slice(3) : pathname;
}

export function isLocalized(path: string): boolean {
  const p = basePath(path);
  return LOCALIZED_ROUTES.includes(p) || /^\/work\/[a-z0-9-]+\/$/.test(p);
}

/** The same page in another language (falls back to that language's home for English-only pages). */
export function localizePath(path: string, lang: Locale): string {
  const [p, hash] = path.split('#');
  const base = basePath(p);
  const target = lang === 'en' ? base : isLocalized(base) ? `/de${base}` : '/de/';
  return hash ? `${target}#${hash}` : target;
}

export function t(lang: Locale, key: UiKey, vars?: Record<string, string | number>): string {
  let s: string = UI[lang][key] ?? UI.en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Bound translator for a page or component. */
export const useT = (lang: Locale) => (key: UiKey, vars?: Record<string, string | number>) => t(lang, key, vars);

export type { UiKey };
