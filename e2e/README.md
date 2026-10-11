# e2e

These checks run the built site in a real browser. Each check is an assertion. It exits with a non-zero code when something is wrong. CI runs the checks before it deploys the site.

```sh
pnpm run build:site          # builds docs/.vitepress/dist (add SITE_URL=https://visualixir.blessing.id to also check the social tags and sitemap)
pnpm e2e                     # serves the site with `vitepress preview` and runs all checks below
pnpm e2e site search         # runs only some of the checks
pnpm exec playwright install chromium   # run once, or use a system browser: CHROMIUM=/usr/bin/chromium pnpm e2e
```

| Check | What it asserts |
|---|---|
| `site` | Every page returns 200 with one description, a title, an `<h1>`, and the snapshot note (not on the home page). Every diagram has a named `role="img"` and no Graphviz `<title>` or prolog. The 404 page, the icons, `og.png` (1200×630), and `robots.txt` exist. When `SITE_URL` is set, the canonical link, `og:image`, and the sitemap size are correct. |
| `layout` | At 390px and 320px, no page scrolls sideways. Diagram text is at least 10px. A diagram that scrolls sideways can receive keyboard focus. |
| `diagrams` | The first diagram of each page opens in the Enlarge dialog, zooms, closes on Escape, and returns focus. Each `<Diagram steps>` highlights one arrow per step, announces it, and resets. Axe passes with a dialog open and with a diagram half-stepped. |
| `glossary` | Each term card opens on hover, Enter, and tap. It stays on screen. It closes on Escape or on a tap elsewhere. It links to a term on `/glossary`. Axe passes with a card open. |
| `pagetools` | Each page shows the "Read first" and "Related pages" links that `related.json` lists, and all links go to real pages. On a page with several Under the hood sections, Open all, Close all, and "Always open them" work, and the browser remembers the choice. |
| `check` | Each page in `quiz.json` ends with its Check yourself questions. Each answer opens and closes. |
| `paths` | Mark as read toggles, survives a reload, ticks the sidebar and `/paths`, and Clear my progress clears it. The reading paths in `paths.json` name only real pages. |
| `theme` | A click on the theme switch changes the page and the diagram colors, and a second click restores them. The knob sits inside the switch. |
| `search` | Ten real queries put the right section in the top three results. Ctrl+K opens the box and focuses it. Enter opens a result. Escape closes the box. |
| `axe` | Axe-core finds no violations on every page, in light and dark, on desktop (1200px). |
| `axe-phone` | The same check at 390px. It also finds scrollable regions without keyboard access. |

## Against the live site

```sh
pnpm e2e:live        # BASE_URL=https://visualixir.blessing.id: also checks what only a deployment has
```

This command adds these checks: the twelve section-root redirects, the `nosniff` and `Referrer-Policy` headers, immutable caching of `/assets/*`, and the HTTP to HTTPS redirect. For example, `/getting-started` goes to its first page, with and without a trailing slash. A local preview cannot do these checks, because they come from Cloudflare (`docs/public/_redirects` and `_headers`).

## Not in this directory

The directory `scripts/` holds three other tools. `scripts/audit.py` compares pages with the official chapters. `scripts/upstream.mjs` finds changes in the official docs. `scripts/og.mjs` makes the social image and the icons.

## Other browsers

To run the same checks in another engine, set `BROWSER=firefox` or `BROWSER=webkit`, for example `BROWSER=firefox pnpm e2e`. Chromium is the default. The WebKit build of Playwright needs the system libraries of Ubuntu. On other Linux distributions, run WebKit in CI. The `browsers` job there runs Firefox and WebKit.
