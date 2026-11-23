// Privacy-conscious analytics (GoatCounter: no cookies, no fingerprinting script), OFF unless the build
// sets PUBLIC_GOATCOUNTER_CODE. When off, nothing loads, no request leaves the page and the public
// counter stays hidden: the site never shows a number it did not measure.
//   PUBLIC_GOATCOUNTER_CODE=yourcode   → https://yourcode.goatcounter.com (private dashboard behind your login)
//   PUBLIC_COUNTER_SINCE="November 2026" → label for the public visitor count (shown only if the count loads)
const code = String(import.meta.env.PUBLIC_GOATCOUNTER_CODE ?? '').trim().toLowerCase();
export const ANALYTICS_ON = /^[a-z0-9][a-z0-9-]{1,49}$/.test(code);
export const ANALYTICS_ORIGIN = ANALYTICS_ON ? `https://${code}.goatcounter.com` : null;
export const COUNTER_SINCE = String(import.meta.env.PUBLIC_COUNTER_SINCE ?? '').trim();
/** Only the production host is ever counted (never local previews, staging or forks). */
export const COUNTED_HOST = 'priyanshu92012.github.io';
