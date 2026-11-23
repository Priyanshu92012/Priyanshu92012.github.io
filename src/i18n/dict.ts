// Page dictionaries: German must have exactly the English keys (type-checked here, value-checked in tests).
import type { Locale } from './index';
export type Dict<K extends string> = { en: Record<K, string>; de: Record<K, string> };
export function dict<K extends string>(d: { en: Record<K, string>; de: Record<NoInfer<K>, string> }): Dict<K> { return d; }
/** Translator for one page: missing keys are impossible by type; `vars` fill {placeholders}. */
export function pick<K extends string>(d: Dict<K>, lang: Locale) {
  return (k: K, vars?: Record<string, string | number>) => {
    let s = d[lang][k];
    if (vars) for (const [n, v] of Object.entries(vars)) s = s.replaceAll(`{${n}}`, String(v));
    return s;
  };
}
