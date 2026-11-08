# Changelog

Each release has a Mac zip attached on the [releases page](https://github.com/The-Goosebumps-Company/overlay-generator/releases). The web app updates itself.

## 1.5.1 · Event libraries behind a flag
- Event libraries are hidden by default while they're being finished. Open the app with `?events=1` to turn them on (remembered on that computer) and `?events=0` to turn them off again.

## 1.5.0 · Event libraries
- **Event libraries:** pick an event above the templates (G&G, Big Week, Rage Festival, Luxurious Marble Circus, Shimza & Friends) to see its templates. The colour swatches and gradients switch to that event's palette.
- Three templates per event (title, lower third and a set-time or countdown card), styled from each event's artwork and style guide. LMC uses its official colours and Josefin Sans.
- **Save template** files new designs under the event that's open.
- **Resolve:** if an overlay shows a black background, set Media Pool → Clip Attributes → Video → Alpha Mode to Premultiplied. The file is fine; Resolve sometimes doesn't detect the alpha. The steps are now in the app's help and the README.

## 1.4.0 · Social safe zones
- **Safe zones** in the preview for Instagram Reels, TikTok, YouTube Shorts, Instagram & Facebook Stories, Facebook Reels, LinkedIn video, the YouTube player, LinkedIn and Instagram feed, and TV title safe (90%).
- Each one shows a skeleton of the app's buttons, captions and bars over your preview, so you can see what will be covered. It's never part of the export.
- A note under the preview tells you whether your overlay is clear. If it isn't, **Move it inside** nudges (and if needed shrinks) it into the safe area. ⌘Z undoes it.
- Only the platforms that fit the current shape are listed, and your choice is remembered per shape.

## 1.3.1 · Reliable updates
- **Fixed:** reloading the installed app right after an update could combine the new page with an old cached script, so the app hung on *Checking…* with no templates.
- Every build now stamps its version on all script and stylesheet links, and the offline cache always checks with the server for the latest copy.
- If startup ever fails, the app clears its cache and reloads once, then shows a clear message instead of hanging.

## 1.3.0 · Simpler output sizes
- The size dropdown is now two plain choices: **Shape** (Landscape, Portrait, Square, Feed), each with an icon and a note on where it's used, and **Quality** (HD / 4K).
- The pixel size is shown underneath, and **Custom size** is still available.
- Simpler frame-rate labels, with a hint to match your edit.

## 1.2.1 · Alpha fix
- **Fixed:** `.mov` exports now use **premultiplied alpha**, the same as After Effects ProRes 4444 renders and the design team's files. Before, Resolve and players that ignore transparency showed a hard-edged colour band instead of the soft glow.
- PNG sequences stay straight, as the PNG format requires. (If Resolve shows a black background, set Clip Attributes → Alpha Mode to Premultiplied; see the README.)

## 1.2.0 · Batch export
- **Batch export from a list:** paste rows (straight from Google Sheets or Excel) to get one overlay per row. Columns become lines, and the first column can be the badge (e.g. a time).
- Live preview of each row. In Chrome and Edge, files are saved straight into a folder you pick; other browsers download them one by one.
- Single and batch exports share one render engine; cancel works mid-batch.

## 1.1.0 · G&G design
- The app now follows the G&G Brand Guideline: Backline Blue, Pyro Amber, Bricolage Grotesque, glass surfaces, the G&G logo and new app icons.
- New G&G templates: *Pyro title*, *Frequency lower third* and *Schedule with time*.
- A template gallery with live thumbnails, undo/redo, reset to template, cancel export, brand colour swatches and gradients, and in-app dialogs.
- Accessibility: proper labels, visible focus outlines, reduced-motion support.

## 1.0.0 · First release
- Live editor for animated overlays: text, font, glow box, moving light, time badge, in and out animations, position and safe margins.
- Exports: ProRes 4444 + alpha, QuickTime Animation and PNG sequence.
- Runs three ways: as an installable offline web app (GitHub Pages, with exports encoded in the browser by ffmpeg.wasm), as an office server, or as a Mac app built locally by a no-signing installer.
- Shared templates and brand fonts, logging, and fast exports (raw frames compressed and streamed to native ffmpeg).
