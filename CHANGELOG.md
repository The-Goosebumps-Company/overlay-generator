# Changelog

Each release has a Mac zip attached on the [releases page](https://github.com/The-Goosebumps-Company/overlay-generator/releases). The web app updates itself.

## 1.10.0 · MMFF text only
- New crest **Layout: Text only**: the MMFF lettering (script and Beaufort capitals) with no crest behind it, on a transparent background. Pick the colour under **Text colour**.
- Three new MMFF templates: *Text only, cream / forest / pink*, set to "Magical Marble / FAMILY FEST". In batch export every column becomes a line.

## 1.9.0 · One-text MMFF crest
- New crest **Layout: One text**: the outer crest without the inner shield, with a single block of text in the middle. It comes in Solid, Outline and Overlay like the two-part crest.
- Like the two-part crest it only grows taller: past five lines the crest stretches, and long lines shrink to fit.
- Three new MMFF templates: *Solid / Outline / Overlay crest, one text*. In batch export every column becomes a line.

## 1.8.3 · LMC clean-up
- Removed the LMC *Countdown*, *Act lower third* and *Show time* box templates. LMC now holds just the Evophoria 2026 gold text.

## 1.8.2 · Beaufort Pro Heavy
- MMFF crest capitals use **Beaufort Pro Heavy**, as in the artwork. Light, Medium, Bold and Heavy come with the office server and the Mac app.
- The public website doesn't include them; there, add `BeaufortPro-Heavy.otf` with **Add** once (Fraunces stands in until then).

## 1.8.1 · Beaufort Pro for MMFF
- MMFF crest capitals now use **Beaufort Pro Bold** as soon as it's added with **Add** (as `BeaufortPro-Bold.otf`). Fraunces still stands in until then. The font is licensed, so it isn't bundled with the app.
- Font files in `fonts/` are now git-ignored, so a licensed font uploaded through the office server can't be published by accident. Open-licence fonts can still be shared on purpose with `git add -f`.

## 1.8.0 · MMFF crests and PNG stills
- **New library: Magical Marble Family Fest (MMFF).** A two-part crest traced from *MMFF_2027_Overlays.ai*: top text sits in the shield, bottom text below it. Three styles: **Solid** (mint, pink and cream), **Outline** (cream lines, see-through) and **Overlay** (outline over a 15% dark tint).
- The crest only grows **taller**: add lines to the top or bottom text and it stretches; long lines shrink to fit instead of making it wider.
- Words with lowercase letters are set in Snell Roundhand, ALL-CAPS words in Fraunces 900, a free stand-in for Beaufort Pro Heavy. Add the real font with **Add** next to *Capitals font*.
- **PNG stills:** designs that don't move (gold text, crests, or anything with in/out and moving light off) now export as one transparent **PNG** at full size instead of a video. The format switches automatically, and the button reads *Export PNG*. Batch export makes one PNG per row.
- Batch export for crests: the first column is the top text, the second is the bottom, and ` / ` inside a cell starts a new line.

## 1.7.0 · Libraries for everyone
- Template libraries no longer need `?events=1`: the app opens on the **G&G** and **LMC** folders.
- The general templates (Blue glass title, Purple schedule, Lower third – left) are now in the G&G folder.
- Big Week, Rage Festival and Shimza & Friends are hidden while they're being finished. Open the app with `?events=all` to see them, and `?events=0` to hide them again.

## 1.6.0 · Library folders and gold text
- **Library folders** (with `?events=1`): templates are now browsed like a gallery. Each event is a folder with a cover preview. Open it to see its templates and any folders inside (for example LMC → Evophoria 2026). Breadcrumbs and the back button take you up a level, and the app remembers where you were.
- **Gold glitter text:** a new *Look* next to the glow box. It recreates the LMC "Evophoria" Photoshop lettering in the app: a glitter-gold fill, rough Dissolve-style edges, a soft bevel and a plum drop shadow, set on a tilt with an italic slant. Type anything you like.
- Lowercase words can be set in a script font ("step OUT of the ORDINARIOUS"). Snell Roundhand is used on Macs, with Great Vibes as the fallback elsewhere.
- Finishes: Pale gold, Evophoria (orange gold), Rose gold and Silver. Tilt, slant, extra weight, glitter size, sparkle, rough edges, bevel and shadow can all be adjusted.
- Three LMC → Evophoria 2026 templates: *Title*, *Step out* and *Tickets on sale*. They're static by default; switch on *Animate in/out* for a fade.
- *Save template* files new designs in whichever folder is open.

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
