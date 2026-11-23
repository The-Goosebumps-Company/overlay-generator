Team brand fonts (.ttf / .otf / .woff / .woff2)

Fonts in this folder are bundled into every build and load for everyone using the app
(as "Brand fonts" in the font picker). The name shown is the file name, e.g.
"Avenir-Next-Bold.otf" -> "Avenir Next Bold".

!! This repository is PUBLIC. Only add fonts whose licence allows public distribution.
   Font files here are git-ignored so a licensed font uploaded through the office
   server can't be committed by accident. To share an open-licence font with every
   build, add it on purpose: git add -f fonts/<file>
   Licensed fonts (e.g. Beaufort Pro for MMFF) go in this folder on the office server
   machine and are packed into the Mac zip, but never into git or the public website.
   Don't attach a Mac zip that contains them to a public GitHub release.
   Bricolage Grotesque (the G&G typeface) is already loaded from Google Fonts.

Anyone can also add a font just for themselves with the "Add" button next to the font picker.
