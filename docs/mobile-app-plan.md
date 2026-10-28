# Plan: iOS & Android apps with Capacitor

Goal: ship PlayMakeFlag as native iOS and Android apps built from the same codebase as the web version,
with the exported playbook `.html` file working interchangeably between web and app.

**Estimate:** ~2–3 weeks of work, plus ~2 weeks of waiting for Google Play's mandatory closed test.
A first build running on our own phones takes about 1 day.

## Phase 1 — Wrap and run on devices (~1 day)

- [ ] Add `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`; `webDir: 'dist'`
- [ ] Make the Vite `base` depend on the target: `/PlayMakeFlag/` for GitHub Pages, `./` for the app build
- [ ] App icon and splash screen from `public/logo.png` (`@capacitor/assets`)
- [ ] Status bar / notch: safe-area padding (`viewport-fit=cover` is already set)
- [ ] Build scripts, e.g. `npm run build:app && npx cap sync`
- Requires Xcode (iOS) and Android Studio (Android)

## Phase 2 — Replace browser-only features (~4–7 days)

| Area | Problem in a native WebView | Change | Effort |
|---|---|---|---|
| Storage (`usePlaybook.ts`, `localStorage`) | iOS may evict WebView storage under storage pressure — data loss risk | Persist via `@capacitor/preferences` or a JSON file (`@capacitor/filesystem`); loading becomes async, the hook needs a loading state | 1 day |
| Print (`window.print()` in `App.tsx`) | No-op on Android, unreliable on iOS | Native print plugin, or render the print view to PDF and share/print it | 1–2 days |
| Export & Share (`navigator.share` with files, `a.download` fallback) | File sharing unsupported in Android WebView; download fallback works on neither | Write the file with `@capacitor/filesystem`, open the native share sheet with `@capacitor/share` | 0.5–1 day |
| Import (see below) | Share files open the web app, not the native app | "Import file" button + "Open with PlayMakeFlag" | 1–1.5 days |
| Touch gaps | HTML5 drag & drop (play reorder in the folder tree), hover-only delete on saved routes, mouse-only sidebar resize handles | Long-press / explicit buttons; hide resize handles on touch | 0.5–1 day |
| Layout | Phone layout (tabs) and tablet layout (desktop ≥768px) not tested since the route panel moved below the field | Test and polish on real devices | 1–2 days |

## Playbook file compatibility (web ⇄ app)

The exported `.html` file stays the single exchange format. It is self-contained: the minified, deflated,
Base64URL playbook is embedded as `const PLAYBOOK_DATA = "..."` (`generateRedirectHtml` in `src/lib/shareUtils.ts`).

- **App → web:** unchanged. The app generates the identical file and hands it to the native share sheet.
  Opening it in a browser shows "Open Playbook", which opens the GitHub Pages app and imports via `postMessage`.
- **Web → app:** the app reads the file itself — extract `PLAYBOOK_DATA` and pass it to the existing
  import path (`processData` in `App.tsx`). Two entry points:
  - [ ] **Import file** button with a file picker (Files / Downloads). Add it to the web version too, so both work the same (~0.5 day)
  - [ ] **Open with PlayMakeFlag**: register the app for `.html` files (Android intent filter for `text/html`,
        iOS document type `public.html`), receive the file via `@capacitor/app` and read it (~1 day).
        Downside: the app is offered for every HTML file, not only playbooks.
- **Limitation:** tapping the file in a chat usually opens it in the browser → web version. Getting it into the
  app needs "Open with…"/share-to-app or the import button. Universal Links / App Links would fix this but need
  a verification file at the domain root, which a GitHub Pages *project* site (`maierhjakob.github.io/PlayMakeFlag`)
  cannot serve — only possible with a custom domain.
- **Versioning rule:** store releases lag behind web deploys, so older app versions will receive files from newer
  web versions. Keep the share format (currently minified v3) backwards compatible; bump the version marker and
  keep reading old versions when it changes.

## Phase 3 — Store release (~2–4 days of work + waiting)

- [ ] Apple Developer Program ($99/year), Google Play Console ($25 once)
- [ ] Google Play: new personal accounts need a **closed test with 12 testers for 14 days** before production
- [ ] Privacy policy URL (no data collected, all local), store screenshots and descriptions, Play data-safety form
- [ ] Signing, TestFlight (iOS) and internal testing track (Android)
- [ ] Apple guideline 4.2 (minimum functionality): offline use plus native share/print keep it clear of "just a website"

## Ongoing

- Every app update is a store release (build → `npx cap sync` → upload → review, usually ~1 day),
  instead of the one-command web deploy. Consider CI builds once it is set up.
- Three targets to keep working: web, iOS, Android.

## Cheaper alternative: PWA (~0.5 day)

Web app manifest + service worker: installable to the home screen and usable offline on both platforms,
no store, fees or reviews. No store presence, the same iOS storage-eviction risk, and print/share stay as limited
as today. Reasonable first step if the main goal is getting it onto the team's phones.
