# Overlay Generator

A self-serve tool for video editors: type the text, pick a preset, and export an animated title overlay with a **transparent background**, an **in animation** and an **out animation**. It's ready to drop into **DaVinci Resolve, Premiere Pro or After Effects**. The design team creates presets once; editors make as many overlays as they need.

## Sharing it with people (no server, no code signing)

Run `npm run build`. It creates two things in `dist/`:

### Option A: a website people install as an app (recommended)
Upload **`dist/web/`** to any free static host: Netlify, Cloudflare Pages or GitHub Pages. Everyone opens the link and clicks **⤓ Install app** (Chrome/Edge) or **File → Add to Dock** (Safari). It works on Mac and Windows and runs offline after the first visit. Updates arrive automatically when you upload a new build. Nobody's computer has to stay on.

### Option B: a Mac app you send as a zip
Send **`dist/Overlay Generator (Mac).zip`**. The colleague unzips it, opens Terminal, types `bash `, drags in `install.sh` and presses Enter (see *HOW TO INSTALL.txt* inside). The installer:
- puts the app in `~/Library/Application Support/Overlay Generator` (no admin rights needed),
- downloads a private copy of Node.js once, checksum-verified,
- builds **Overlay Generator.app** in `~/Applications` *on their Mac*, so Gatekeeper doesn't block it and no Apple signing is needed.

After that they open it like any app. It runs a server that only their own computer can reach, on port 4747, which quits after an hour without use, and opens a clean app window. To update, send a new zip and they run the installer again; their own presets and fonts are kept.

### How exports work without a server
When there's no office server, ProRes 4444 and QuickTime Animation are encoded **in the browser** with ffmpeg.wasm (`public/vendor/ffmpeg`). This is slower: about 50 s for a 5.5 s 1080p overlay, versus about 3 s with native ffmpeg. If the Mac has Homebrew ffmpeg, the Mac app uses it automatically.

### Team presets and brand fonts in the packages
Put preset `.json` files in `presets/` (use **Download .json** in the app) and font files in `fonts/`, then run `npm run build`. Both packages include them as **Team presets**.

## Running it as an office server (optional)

On one Mac in the office (it needs [Node.js](https://nodejs.org) 18+ and, for .mov export, ffmpeg):

```bash
brew install node ffmpeg
```

Then double-click **`Start Overlay Generator.command`**, or run:

```bash
npm start
```

The terminal prints two addresses. Share the **Office network** one (e.g. `http://192.168.1.20:4321`) with everyone. They open it in Chrome, Safari or Edge, and nobody else needs to install anything.

Keep that Mac awake while people use it. Change the port with `PORT=8080 npm start`.

## Export formats

| Format | Use it when | Notes |
| --- | --- | --- |
| **ProRes 4444 + alpha (.mov)** | Default for everything | Smooth playback in Resolve, Premiere and After Effects |
| QuickTime Animation (.mov) | You want the same codec the design team used | Lossless but huge, and can stutter in Resolve |
| PNG sequence (.zip) | No server, or another app | Works everywhere. Import as an image sequence |

**DaVinci Resolve:** put the clip on a track above your footage. If the edges look dark, right-click → *Clip Attributes → Alpha mode → Straight*.
**Premiere / After Effects:** transparency is picked up automatically.

## What's in it

- **Live preview** that matches the export exactly, frame for frame. You can preview over a checkerboard, a solid colour, or your own image or clip.
- **Editable:** text, font (Google fonts, or upload brand fonts), size, spacing, glow colours and gradient, glow depth and softness, corner radius, padding, moving light blobs, and an optional badge (e.g. a time like `14:10`) with digit scramble.
- **In / Out animations:** line → box, fade, pop or slide in and out, with letter cascade, word, line, typewriter or fade text reveals. You can turn each one on or off and set its length.
- **Responsive:** the box sizes itself to the text, and you can render 16:9, 1:1, 4:5, 9:16, 4K or a custom size. The layout scales with the frame and shrinks to fit inside the safe margins.
- **Batch export:** paste a list (straight from Google Sheets or Excel) and get one overlay per row, numbered and saved into a folder you pick. Columns become lines on screen; the first column can be the badge (e.g. a time).
- **Shared presets:** "Save preset" stores the design on the server (`presets/`) so the whole office sees it. "Download .json" / "Open .json" moves designs around by hand.
- **Shared fonts:** uploaded fonts are saved to `fonts/` and load for everyone.

## How it works

`public/renderer.js` draws each frame on an HTML canvas as a function of time. The same code drives the preview and the export. To export, the browser renders every frame, gzips the raw RGBA pixels and sends them to `server.js`. The server pipes them into ffmpeg (`prores_ks` 4444 with straight alpha, or `qtrle` ARGB) and returns the .mov. PNG-sequence export happens entirely in the browser.

No npm dependencies. Set `EXPORT_COPY_DIR=/some/folder` to keep a copy of every export on the server.

## Licences

The in-browser encoder in `public/vendor/ffmpeg` is [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm): the wrapper is MIT, and the ffmpeg core build is GPL. That's fine for internal use. Check with legal before selling or distributing the app outside the company.
