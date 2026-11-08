# Developer guide

How Overlay Generator is built, run, deployed and released. For using the app, see the [README](../README.md).

- [At a glance](#at-a-glance)
- [Project layout](#project-layout)
- [How it works](#how-it-works)
- [Three ways to run it](#three-ways-to-run-it)
- [Build and deploy](#build-and-deploy)
- [Releasing](#releasing)
- [Logging and debugging](#logging-and-debugging)
- [Gotchas and decisions](#gotchas-and-decisions)

## At a glance

- Plain HTML, CSS and JavaScript (ES modules). **No npm dependencies** and no bundler.
- **Live site:** https://the-goosebumps-company.github.io/overlay-generator/. GitHub Pages deploys every push to `main` ([`.github/workflows/pages.yml`](../.github/workflows/pages.yml)).
- **Mac zip:** attached to each [GitHub Release](https://github.com/The-Goosebumps-Company/overlay-generator/releases).
- Requires Node 18+ for the optional server and the build script, and ffmpeg for fast native exports.

## Project layout

```
public/                 The app (everything the browser loads)
  index.html            Layout: templates, controls, stage, export panel, dialogs
  style.css             G&G design system (tokens at the top)
  app.js                UI, templates, undo/redo, export + batch, PWA, startup recovery
  renderer.js           Draws one frame at time t — shared by preview and export
  presets.js            Built-in templates (G&G, then generic, then event libraries)
  events.js             Event libraries: per-event palettes, gradients and names
  encode-wasm.js        In-browser ProRes/QT Animation encoding via ffmpeg.wasm
  zip.js                Fast PNG encoder, gzip and a store-only ZIP writer
  log.js                Client logging (console + server log when available)
  fonts-store.js        Keeps uploaded fonts in IndexedDB (no-server mode)
  safezones.js          Platform safe zones: margins + skeleton UI drawn as SVG over the preview
  sw.js                 Service worker: offline support and caching
  vendor/ffmpeg/        ffmpeg.wasm 0.12.10 (wrapper + 32 MB core)
  brand/, icons/        G&G logo and app icons
server.js               Optional server: static files, shared templates and fonts, native ffmpeg, logs
scripts/build.mjs       Builds dist/web (website) and the Mac zip
launcher/               Mac installer (install.sh), uninstaller, icon, instructions
presets/                Team templates (.json), bundled into every build
fonts/                  Team brand fonts, bundled into every build (repo is public!)
```

## How it works

### Rendering
`renderer.js` exports `drawFrame(ctx, state, t, W, H)`. It draws one frame of the overlay at time `t` on a 2D canvas:
- **Glow box:** a rounded rectangle filled with the gradient. The soft transparent centre is cut out with a blurred `destination-out` shadow, and moving light blobs are drawn on top.
- **Text and badge:** each character is drawn individually so the reveal styles can animate it. The badge digits scramble as it appears.
- **Animation timeline:** in (line → box, fade, pop, slide), hold, then out.

The live preview and the export call the same function, so what you see is what you get. Layout works in "design units" relative to 1080 px on the short side, so the same design scales cleanly to 4K, portrait or square.

### Export paths
| Situation | What happens |
|---|---|
| **PNG sequence** | Frames are rendered and encoded to PNG in the browser (custom encoder, because `canvas.toBlob` is very slow), then zipped. |
| **.mov with a server that has ffmpeg** | Raw RGBA frames are gzipped and uploaded to `server.js`, which pipes them into native ffmpeg (`prores_ks` 4444 or `qtrle`). Takes a few seconds. |
| **.mov without a server** | Frames go to ffmpeg.wasm in the browser. About 50 s for a 5-second 1080p overlay. |

**Alpha:** `.mov` frames are **premultiplied** before encoding (`premultiply()` in `app.js`), matching After Effects ProRes 4444 renders. PNG frames stay straight. Don't change this: straight alpha in a `.mov` shows as a hard-edged colour band in Resolve and in players that ignore alpha.

**Resolve and FFmpeg ProRes:** Resolve doesn't always auto-detect alpha in ProRes 4444 files written by FFmpeg (it does for Apple-made files), so it may import them with *Alpha Mode: None*, which shows as a black background. The file is fine; the fix is Clip Attributes → Video → Alpha Mode: Premultiplied. Confirmed in Resolve 21.2.

**Safe zones** (`safezones.js`) are an SVG layer over the preview canvas, never passed to `drawFrame`, so they can't end up in an export. Margins are on a 1080-wide reference and scale with the frame's short side. `computeLayout()` gives the overlay's box to check against the safe rectangle; *Move it inside* adjusts `layout.offsetX/Y` (and `scale` if it doesn't fit).

**Batch export** runs `renderToFile()` once per row. In Chrome and Edge it writes files through the File System Access API (`showDirectoryPicker`); elsewhere it downloads them one by one.

## Three ways to run it

| Mode | How | Server? | Templates and fonts |
|---|---|---|---|
| **Web app (PWA)** | GitHub Pages | No `/api`, so the app runs standalone | Built-in + team (`shared/library.json`) + saved in the browser |
| **Mac app** | `launcher/install.sh` builds `~/Applications/Overlay Generator.app` | Private `server.js` on `127.0.0.1:4747`, quits after 60 min idle | Stored in `~/Library/Application Support/Overlay Generator/app/{presets,fonts}` |
| **Office server** | `npm start` (or `Start Overlay Generator.command`) on one machine | Shared on the LAN at port 4321 | Shared through the server's `presets/` and `fonts/` folders |

The app detects which mode it's in from `GET /api/status` (`{ ok, ffmpeg, local }`). If that call fails, it runs standalone.

### Server options (environment variables)
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4321` | Port to listen on |
| `HOST` | `0.0.0.0` (`127.0.0.1` when `OG_LOCAL=1`) | Network interface |
| `OG_LOCAL` | — | `1` = personal install: only this computer can connect |
| `OG_IDLE_MINUTES` | off | Quit after this many minutes without requests |
| `OG_LOG_DIR` | `./logs` | Where `app.log` is written |
| `FFMPEG` | auto-detect | Path to ffmpeg (Homebrew paths are checked automatically) |
| `EXPORT_COPY_DIR` | — | Keep a copy of every `.mov` the server renders |

### Server API
`GET /api/status` · `POST /api/log` · `GET|POST|DELETE /api/presets` · `GET|POST /api/fonts` · `POST /api/render` → `PUT /api/render/:id/:frame` (gzipped RGBA) → `POST /api/render/:id/finish` (returns the `.mov`).

## Build and deploy

```bash
npm run build              # dist/web + dist/Overlay Generator (Mac).zip
node scripts/build.mjs --web-only   # what CI runs
```

The build:
1. Copies `public/` to `dist/web/`.
2. **Stamps the version** on every script and stylesheet reference (`app.js?v=1.3.1-…`) and on the service worker cache name. This is why updates can't mix old and new files.
3. Bundles `presets/*.json` and `fonts/*` into `dist/web/shared/` (`library.json` lists them).
4. Packages the Mac zip (app + server + installer + icon).

**Deploy** = push to `main`. The Pages workflow builds `dist/web` and publishes it. Check runs with `gh run list`.

## Releasing

1. Bump `version` in `package.json`.
2. Add an entry to [`CHANGELOG.md`](../CHANGELOG.md).
3. Commit and push to `main`, then wait for the Pages deploy: `gh run watch <id> --exit-status`.
4. Build the zip and publish it:
   ```bash
   npm run build && cp "dist/Overlay Generator (Mac).zip" dist/Overlay-Generator-Mac.zip
   gh release create vX.Y.Z dist/Overlay-Generator-Mac.zip --title "Overlay Generator X.Y.Z · Title" --notes "…"
   ```
   Keep the asset name `Overlay-Generator-Mac.zip`: the README's "latest" download link depends on it.
5. Check the live site, e.g. `curl -s https://the-goosebumps-company.github.io/overlay-generator/ | grep app-version`.

Before releasing, scan for things that shouldn't be public: client names, commercial figures, fonts without a public licence, personal details.

## Logging and debugging

- **Browser:** every action and error is logged to the console with the prefix `[overlay]`. Uncaught errors, failed API calls and failed resource loads are captured automatically (`log.js`).
- **Server:** request log, render jobs, ffmpeg errors and the browser logs it receives, all in `logs/app.log` (`~/Library/Application Support/Overlay Generator/logs/` for the Mac app).
  ```bash
  tail -f logs/app.log
  ```
- **Startup recovery:** if `init()` fails, `recover()` clears the `og-shell-*` caches and reloads once. A second failure shows *Couldn't start*.

## Gotchas and decisions

- **GitHub Pages caches files for 10 minutes** (`max-age=600`). Version-stamped URLs and the service worker's `cache: 'no-cache'` revalidation keep updates consistent. Don't remove either.
- **`prompt()` and `confirm()` don't work** in installed apps or embedded browsers. Use the in-app `ask()` dialog.
- **`canvas.toBlob` is slow** (seconds per 1080p frame). Use `getImageData` with the custom `encodePNG` or `gzip` in `zip.js`.
- **The Mac app is built on the user's Mac** with `osacompile` and ad-hoc signed (`codesign -s -`) after its Info.plist is edited. Without the re-sign, Apple Silicon refuses to open it.
- **The Mac app uses port 4747**, so it can't clash with an office server on 4321 on the same machine.
- **The repo is public** because GitHub Pages on the free plan requires it. Built-in templates use neutral example text, and the brand master file's commercial data is deliberately left out.
