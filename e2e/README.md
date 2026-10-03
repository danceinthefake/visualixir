# e2e

Checks of the built site in a real browser. They are assertions: each one exits non-zero when something is wrong, and CI runs them before the site is deployed.

```sh
pnpm run build:site          # builds docs/.vitepress/dist (add SITE_URL=https://visualixir.blessing.id to also check the social tags and sitemap)
pnpm e2e                     # serves it with `vitepress preview` and runs everything below
pnpm e2e site search         # or just some of them
pnpm exec playwright install chromium   # once, or use a system browser: CHROMIUM=/usr/bin/chromium pnpm e2e
```

| Check | What it asserts |
|---|---|
| `site` | all 54 pages return 200 with one description, a title, an `<h1>`, the snapshot note (not on the home page), and every diagram a named `role="img"` with no Graphviz `<title>`/prolog; 404 page; icons, `og.png` (1200×630), `robots.txt`; canonical and `og:image` when `SITE_URL` is set; sitemap size |
| `layout` | at 390px and 320px: no page scrolls sideways, diagram text stays at least 10px, a diagram that scrolls sideways is keyboard-focusable |
| `search` | ten real queries put the right section in the top three; Ctrl+K opens and focuses the box, Enter opens a result, Escape closes |
| `axe` | axe-core on every page, light and dark, desktop (1200px): no violations |
| `axe-phone` | the same at 390px, which also catches scrollable regions without keyboard access |

## Against the live site

```sh
pnpm e2e:live        # BASE_URL=https://visualixir.blessing.id: also checks what only a deployment has
```

That adds the twelve section-root redirects (`/getting-started` goes to its first page, with and without a trailing slash), the `nosniff` and `Referrer-Policy` headers, immutable caching of `/assets/*`, and the HTTP to HTTPS redirect. A local preview can't do those, because they come from Cloudflare (`docs/public/_redirects` and `_headers`).

## Not here

`scripts/audit.py` (pages against the official chapters), `scripts/upstream.mjs` (has the official docs changed?) and `scripts/og.mjs` (the social image and icons) are in `scripts/`.

## Other browsers

`BROWSER=firefox pnpm e2e` (or `webkit`) runs the same checks in another engine. Chromium is the default. WebKit's Playwright build needs Ubuntu's system libraries, so on other Linux distributions run it in CI: the `browsers` job there does Firefox and WebKit.
