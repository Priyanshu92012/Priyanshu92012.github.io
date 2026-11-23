# Releasing V2 (owner actions only)

Nothing in this repository deploys by itself. There is **no AI service to deploy**: the public site is static and its
portfolio guide runs in the browser. `worker/` holds an experimental LLM Worker that is not deployed and is not used by
the site (see `worker/README.md`).

## Current state (checked 2026-11-19)

| Thing | State |
|---|---|
| Production | GitHub Pages, **Deploy from a branch** (`main`, `/`, legacy build), serving v1 **plus** `/prototypes/` (PR #1, merge `92a2ee6`) |
| V2 | Local branch `feat/v2-hero-prototypes`, 14+ commits on top of the PR #1 content; **not pushed** (the remote branch was deleted after PR #1) |
| Backup tag | `portfolio-v1-backup` → `953f03b` (last pure-v1 commit), **local only** |
| v1 AI Worker | `portfolio-ai` still exists and is still called by the **current production** v1 terminal (paid). V2 never calls it. |

## 0. Before staging

1. Decide every row of table A in [CONTENT_APPROVAL.md](CONTENT_APPROVAL.md).
2. Locally: `npm ci && npm run ci` (type check, 97 unit tests, build + gates, worker bundle, 107 browser tests).

## 1. Access-protected staging (never public)

Staging builds (`npm run staging:build` → `.staging/site`, git-ignored) are `noindex` on every page, show a
“Staging preview · not public” badge, and pass both gates (content + dist). Nothing in staging requires pushing.

### 1a. Local staging — ready now (this Mac + phones on the same Wi-Fi)

```bash
npm run staging            # build + start the server on port 4400 (Ctrl+C to stop)
```

- Desktop: open `http://localhost:4400/` and sign in with user `staging` and the printed password
  (also saved in `.staging/credentials.txt`; set `STAGING_PASS=…` to choose your own).
- Phone: join the same Wi-Fi, open the printed `http://<your-mac-LAN-IP>:4400/`, sign in. If macOS asks whether
  `node` may accept incoming connections, allow it. Don’t enable router port-forwarding: it must stay LAN-only.
- Protection: HTTP Basic Auth on every request, lockout after 10 failed logins per device, `noindex`, `no-store`,
  no framing, read-only (GET/HEAD), path-traversal safe. Plain HTTP on the LAN: use a trusted network.

### 1b. Remote staging — Cloudflare Pages behind Cloudflare Access (you run it; protect **before** uploading)

1. `npx wrangler login`
2. `npx wrangler pages project create priyanshu-exe-staging --production-branch production`
   (never deploy to `production`, so the project’s root URL stays empty; staging goes to a preview branch)
3. Cloudflare dashboard → Workers & Pages → `priyanshu-exe-staging` → Settings → enable the **Access policy for
   preview deployments**, then in Zero Trust → Access → Applications make sure it allows **only your e-mail**
   (one-time PIN).
4. `npm run staging:build`
5. `npx wrangler pages deploy .staging/site --project-name priyanshu-exe-staging --branch staging`
6. Open the printed `https://staging.priyanshu-exe-staging.pages.dev` in a **private window**: you must see the
   Cloudflare Access login, not the site. If the site loads without a login, delete the project at once:
   `npx wrangler pages project delete priyanshu-exe-staging`.
7. Phone: open the same URL, request the PIN to your e-mail, sign in.

Smoke checklist (both options): home 3D lab and `?3d=0`, one lab per case study, `/skills/` 2D/3D, `/recruiter/`,
the guide (`/` key, suggested questions, a typed question, an unknown question, “Match a job”), terminal (`` ` ``),
paper mode (`P`); `/v1/` and `/gmre_architecture_v3.html` must redirect. Devtools → Network: no other hosts.

## 2. Production (after approvals and staging)

```bash
git push origin portfolio-v1-backup                  # keep the rollback point on GitHub
git push -u origin feat/v2-hero-prototypes           # CI runs on the push
gh pr create --base main --head feat/v2-hero-prototypes --title "PRIYANSHU.EXE V2"
```

1. Wait for CI to pass on the PR, review, merge.
2. Settings → Pages → Source: **GitHub Actions** (from “Deploy from a branch”).
3. Actions → **Deploy site** → Run workflow on `main`, type `deploy`.
4. Check `/`, a case study, `/robots.txt`, `/og.png`, and that `/v1/` and `/gmre_architecture_v3.html` redirect.
5. Stop paid usage of the old Worker: once V2 is live, nothing on the site calls `portfolio-ai`. Delete it
   (`npx wrangler delete portfolio-ai`, try `--dry-run` first) or at least revoke its API key in the Anthropic Console.

## Rollback

- Fast: Actions → **Deploy site** → re-run an earlier successful run (redeploys that build).
- Full return to the pre-V2 site: revert the V2 merge commit on `main` in a pull request (this restores the v1 files
  and `/prototypes/` at the repository root, i.e. `92a2ee6`; note this also brings back the old wording), then set Pages → Source back to **Deploy from a branch**
  (`main`, `/`). Do not switch the source back while `main` still holds V2: its root is source code, not a site.
- `portfolio-v1-backup` (`953f03b`) marks the last commit before any V2 work.

## Social card

`public/og.png` is a 1200×630 capture of `/og-card/` (template page, `noindex`, not in the sitemap). Regenerate after
design changes: `npm run build && npm run preview`, open `http://localhost:4321/og-card/` at 1200×630, save a screenshot
to `public/og.png`.
