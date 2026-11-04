# GéoFR

GéoFR is the first game of the Géo Europe collection. The engine stays separate from the content in `content/<country>/`, so that the other countries can reuse it.

Next.js 16 has breaking changes: read `node_modules/next/dist/docs/` before writing Next code.

## Commands
- `npm run dev`: development server
- `npm run check`: lint, types, emoji and content checks
- `npm run build`: web build, with server routes
- `npm run build:export`: static export to `out/`, for Capacitor, without server routes
- `GEO_COUNTRY=fr`: selects the country at build time, `fr` by default
- `node scripts/build-map.mjs <country>`: regenerates `content/<country>/map.json` from `map.config.json`. Run once per country, the result is committed.

## Where things live
- `src/engine/`: types and game logic, with no React, Next, Firebase or UI import
- `content/<country>/`: country config, regions, media credits, content translations
- `content/_shared/`: publisher and web host shared by every country. Not a country: `check-content` skips folders starting with `_`.
- `src/i18n/locales/`: interface text shared by every country
- `src/ui/`: shared components, including the modal system
- `src/features/`: screens and features
- `src/services/`: external services and `AppError`. The only place allowed to import Firebase.

## Rules (lint and scripts enforce most of them)
- No emoji anywhere in the app. Lucide React for icons, SVG for regions, photos for media.
- No `alert`, `confirm` or `prompt`. Use `useModal()`.
- No hardcoded text in components. Use `t()` for interface keys and `tContent()` for content keys.
- Show `modal.error(error)` for failures, never a technical message.
- Server-only routes are named `route.server.ts`, so the static export leaves them out.
- Never unlock Premium from a browser result. Never expose a Firebase Admin key in the browser.
- Never put country-specific code in `src/`. Add content or config under `content/<country>/`.

## Not to do without Christian's validation
- Deploy to production, create a Firebase project, or activate a paid service or a real payment.
- Replace part of the stack, or add a significant dependency.
- Modify other JavaChrist projects, including JavaChrist-Promotions.

## Before the first production deploy
Remove `/api/health`, which is the example server route. `/demo` is a development tool: it answers 404 in every build and no menu links to it. Fill every `legal` field left at `null` in `content/<country>/country.ts` and `content/_shared/legal.ts`. Confirm the `RCS Toulouse` registry against the official extract. Confirm the VAT regime and the mediator membership, then set `legal.vat.confirmed` and `legal.mediator.confirmed` to `true`, which removes the warning shown on screen. Have the legal texts reviewed.
