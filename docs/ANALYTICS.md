# Visitor statistics (optional, off by default)

The site ships with analytics **disabled**. With nothing configured, no beacon loads, no request leaves
the page, the Content-Security-Policy stays same-origin, and the public counter is not rendered. The site
never shows a number it did not measure.

## What is built in

- **Provider:** [GoatCounter](https://www.goatcounter.com): free for personal/non-commercial sites, open
  source, no cookies.
- **Beacon** (`src/scripts/beacon.ts`): one image request per page view to
  `https://<code>.goatcounter.com/count`. No third-party script runs. It sends only:
  - the path, without query or hash;
  - the page title;
  - the referring *site* (origin only, never the full URL);
  - the screen width.
- **Skipped entirely:** with Do Not Track or Global Privacy Control, and on any host other than
  `priyanshu92012.github.io` (local previews, staging and forks are never counted).
- **Public counter (footer, optional):** reads GoatCounter's `/counter/TOTAL.json` and shows the number
  only if it loads and is well formed. GoatCounter's documentation describes this figure as its
  **visitor** count, so the footer labels it "Visitors since …", not page views.
- **CSP:** the configured origin is added to `img-src` and `connect-src` only when the code is set
  (`scripts/csp.mjs`).

## Turn it on (owner)

1. Create a GoatCounter account and site (choose a code, e.g. `priyanshu`). The dashboard is private,
   behind your GoatCounter login: `https://<code>.goatcounter.com`.
2. Optional, for the public footer count: GoatCounter → Settings → enable **"Allow adding visitor
   counts on your website"** (off by default).
3. In GitHub → repository → Settings → Secrets and variables → Actions → **Variables** (not secrets;
   the code is public anyway), add:
   - `GOATCOUNTER_CODE` = your code;
   - `COUNTER_SINCE` = e.g. `November 2026` (only if step 2 is on; leave unset to keep the count private).
4. Run the **Deploy site** workflow. Verify on the live site:
   - the CSP contains `https://<code>.goatcounter.com`;
   - page views appear in the dashboard within a minute.

Leaving `COUNTER_SINCE` unset keeps every number private: dashboard only, nothing public.

## What the dashboard shows

- Page views and visitors over time.
- Top pages: case studies, `/security-lab/`, `/ai-lab/`.
- Referring sites.
- Browsers, operating systems and screen sizes.
- Approximate countries.

GoatCounter documents how it counts visitors without cookies. Read it before quoting numbers.

## Privacy and legal notes (not legal advice)

- No cookies, no local storage, no fingerprinting script, no IP addresses sent by the site.
- GoatCounter receives the request itself, and with it the visitor's IP address and user agent at
  network level. Its privacy policy explains what it stores. Check it before enabling.
- Germany/EU: a site operated from Germany that measures visits may need a privacy notice
  (Datenschutzerklärung) naming the processor and the purpose. A professional portfolio may also need
  an Impressum. Whether consent is required depends on the setup.
- This repository does not claim GDPR, TTDSG or DDG compliance. Get qualified advice before enabling.

## Turn it off

Delete the two repository variables and redeploy.
