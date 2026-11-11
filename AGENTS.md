# GéoFR

GéoFR is the first game of the Géo Europe collection. The engine stays separate from the content in `content/<country>/`, so that the other countries can reuse it.

Next.js 16 has breaking changes: read `node_modules/next/dist/docs/` before writing Next code.

## Commands
- `npm run dev`: development server
- `npm run check`: lint, types, emoji and content checks
- `npm run build`: web build, with server routes
- `npm run build:export`: static export to `out/`, for Capacitor, without server routes. A Play release needs `NEXT_PUBLIC_API_BASE_URL=https://geofr.appsgeo.com`, or Gradle refuses `bundleRelease` (marker `out/geo-export.json`)
- `GEO_COUNTRY=fr`: selects the country at build time, `fr` by default
- `node scripts/build-map.mjs <country>`: regenerates `content/<country>/map.json` from `map.config.json`. Run once per country, the result is committed.

## Where things live
- `src/engine/`: types and game logic, with no React, Next, Firebase or UI import
- `content/<country>/`: country config, regions, media credits, content translations
- `content/<country>/editions.ts`: the five editions and their prices, the only place a price may be written. See `docs/editions.md`.
- `content/<country>/legal/`: the five legal documents copied from JavaChrist-Legal-Kit by `scripts/sync-legal.mjs`. Never edit them by hand. See `docs/juridique.md`.
- `src/i18n/locales/`: interface text shared by every country
- `src/ui/`: shared components, including the modal system
- `src/features/`: screens and features
- `src/services/`: external services and `AppError`. The only place allowed to import Firebase.
- Payments and access rights: see `docs/paiements.md`. Every lock reads `useEntitlements()`.
- Online withdrawal (`/retractation`, public, no login): see `docs/retractation.md`. It never refunds or removes rights; `withdrawals` is server-only.
- Offered access (free Family edition without ads for authorized emails): see `docs/acces-offerts.md`. `grants` and `admins` are server-only; admins are created only by `scripts/admin.mjs`.
- Android app (Capacitor on `out/`) and the AdMob banner: see `docs/admob.md`. App id and name in `content/<country>/android.json`, ad units in `ads` of `country.ts`. Only the Google demo publisher or JavaChrist's publisher are accepted, and `ads.mode` stays `test` (test ads only) until Christian validates; `check:ads` and Gradle refuse anything else. No ad and no ad request for `adsRemoved` or `granted`.
- `content/<country>/mail/templates.json`: email templates copied from JavaChrist-Mail-Kit by `scripts/sync-mail.mjs`. Never edit them by hand. Emails are sent only by the server (`src/services/mail/`). See `docs/courriels.md`.

## Rules (lint and scripts enforce most of them)
- No emoji anywhere in the app. Lucide React for icons, SVG for regions, photos for media.
- No `alert`, `confirm` or `prompt`. Use `useModal()`.
- No hardcoded text in components. Use `t()` for interface keys and `tContent()` for content keys.
- Prices live only in `content/<country>/editions.ts`, as one-time purchases or free, never a subscription. The Legal Kit catalog is produced by `scripts/export-catalog.mjs`, never typed by hand. Paid editions are all `planned` or all `active`; going `active` needs Christian's validation (done for the GéoFR web sale).
- Legal texts come only from JavaChrist-Legal-Kit. No legal text in the locales, no second legal system, never fill the kit's `review` fields.
- Show `modal.error(error)` for failures, never a technical message.
- Server-only routes are named `route.server.ts`, so the static export leaves them out.
- Never unlock a paid edition from a browser result. Never expose a Firebase Admin key in the browser.
- Mollie mode follows the key: `test_` always accepted, `live_` only when every paid edition is `active`. Google Play stays in test mode (`PLAY_MODE`) until Christian validates it. Never Mollie in the Android build.
- Never put country-specific code in `src/`. Add content or config under `content/<country>/`.

## Not to do without Christian's validation
- Deploy to production, create a Firebase project, or activate a paid service or a real payment.
- Replace part of the stack, or add a significant dependency.
- Modify other JavaChrist projects, including JavaChrist-Promotions.

## Before the first production deploy
Remove `/api/health`, which is the example server route. `/demo` is a development tool: it answers 404 in every build and no menu links to it. Complete the points the Legal Kit still flags, have Christian review the documents and fill `review` in the kit himself, then copy the `reviewed` version with `scripts/sync-legal.mjs`. The draft banner then disappears.
