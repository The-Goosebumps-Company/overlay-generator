#!/bin/bash
# Overlay Generator: Mac installer (no admin rights, no code signing needed).
#
# Installs into your user folder and creates "Overlay Generator" in ~/Applications.
# Because the app is built ON your Mac (not downloaded), macOS doesn't block it.
# Run it again any time to update. Nothing is installed system-wide.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
APP_HOME="$HOME/Library/Application Support/Overlay Generator"
APP_BUNDLE="$HOME/Applications/Overlay Generator.app"
RUNTIME="$APP_HOME/runtime"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
fail() { printf "\n\033[31m✗ %s\033[0m\n" "$*"; echo; read -r -n 1 -s -p "Press any key to close…" || true; exit 1; }
trap 'fail "Something went wrong on line $LINENO. Send a screenshot of this window to whoever gave you the app."' ERR

clear 2>/dev/null || true
bold "Installing Overlay Generator"
echo

[ -f "$SRC/app/server.js" ] || fail "Can't find the app files. Run this from inside the unzipped 'Overlay Generator' folder."

# 1. App files (updates replace the app, but keep your own presets, fonts and logs)
echo "→ Copying app files…"
mkdir -p "$APP_HOME/app" "$APP_HOME/logs"
rsync -a --delete --exclude 'presets/' --exclude 'fonts/' --exclude 'logs/' "$SRC/app/" "$APP_HOME/app/"
mkdir -p "$APP_HOME/app/presets" "$APP_HOME/app/fonts"
rsync -a "$SRC/app/presets/" "$APP_HOME/app/presets/" 2>/dev/null || true   # team presets (updated)
rsync -a "$SRC/app/fonts/" "$APP_HOME/app/fonts/" 2>/dev/null || true       # team fonts (updated)

# 2. A private copy of Node.js (only downloaded once, ~45 MB)
if [ ! -x "$RUNTIME/bin/node" ]; then
  echo "→ Downloading the Node.js runtime (one time only)…"
  case "$(uname -m)" in arm64) ARCH=arm64 ;; *) ARCH=x64 ;; esac
  BASE="https://nodejs.org/dist/latest-v22.x"
  SUMS="$(curl -fsSL "$BASE/SHASUMS256.txt")" || fail "No internet connection? Couldn't reach nodejs.org."
  LINE="$(printf '%s\n' "$SUMS" | grep -E " node-v[0-9.]+-darwin-$ARCH\.tar\.gz$" | head -1)"
  [ -n "$LINE" ] || fail "Couldn't find a Node.js download for this Mac ($ARCH)."
  SUM="${LINE%% *}"; FILE="${LINE##* }"
  TMP="$(mktemp -d)"
  curl -fL --progress-bar "$BASE/$FILE" -o "$TMP/$FILE"
  echo "$SUM  $TMP/$FILE" | shasum -a 256 -c --status || fail "The Node.js download was corrupted. Please run the installer again."
  tar -xzf "$TMP/$FILE" -C "$TMP"
  rm -rf "$RUNTIME"
  mv "$TMP/${FILE%.tar.gz}" "$RUNTIME"
  rm -rf "$TMP"
fi
echo "→ Runtime: $("$RUNTIME/bin/node" -v)"
xattr -dr com.apple.quarantine "$RUNTIME" 2>/dev/null || true

# 3. Launch script used by the app icon
cat > "$APP_HOME/launch.sh" <<'LAUNCH'
#!/bin/bash
# Starts the Overlay Generator (if it isn't running yet) and opens it.
APP_HOME="$HOME/Library/Application Support/Overlay Generator"
PORT="${OG_PORT:-4747}"
URL="http://localhost:$PORT"
status() { curl -fs --max-time 1 "$URL/api/status" 2>/dev/null; }
if ! status | grep -q '"local":true'; then
  if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
    osascript -e 'display alert "Overlay Generator can’t start" message "Another program is using port 4747. Quit it and try again."' >/dev/null
    exit 1
  fi
  # (if Homebrew ffmpeg exists the server finds it and exports are faster; otherwise they run in the browser)
  cd "$APP_HOME/app"
  OG_LOCAL=1 OG_IDLE_MINUTES=60 OG_LOG_DIR="$APP_HOME/logs" PORT=$PORT \
    nohup "$APP_HOME/runtime/bin/node" server.js >> "$APP_HOME/logs/server.out" 2>&1 &
  for _ in $(seq 1 50); do status >/dev/null && break; sleep 0.2; done
fi
# Prefer a clean app window (Chrome/Edge/Brave), otherwise the default browser
for b in "Google Chrome" "Microsoft Edge" "Brave Browser"; do
  if [ -d "/Applications/$b.app" ] || [ -d "$HOME/Applications/$b.app" ]; then
    open -na "$b" --args --app="$URL" && exit 0
  fi
done
open "$URL"
LAUNCH
chmod +x "$APP_HOME/launch.sh"

# 4. The clickable app in ~/Applications (built locally, so Gatekeeper is happy)
echo "→ Creating the app…"
mkdir -p "$HOME/Applications"
rm -rf "$APP_BUNDLE"
osacompile -o "$APP_BUNDLE" -e "do shell script quoted form of (POSIX path of (path to home folder) & \"Library/Application Support/Overlay Generator/launch.sh\") & \" > /dev/null 2>&1 &\""
cp "$SRC/AppIcon.icns" "$APP_BUNDLE/Contents/Resources/applet.icns"
PL="$APP_BUNDLE/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" "$PL" 2>/dev/null || true   # use our applet.icns, not the default icon
rm -f "$APP_BUNDLE/Contents/Resources/Assets.car"
/usr/libexec/PlistBuddy -c "Set :CFBundleName Overlay Generator" "$PL" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string com.overlaygenerator.launcher" "$PL" 2>/dev/null || true
# Re-seal with a local ad-hoc signature (required on Apple Silicon after editing the bundle)
codesign --force --deep --sign - "$APP_BUNDLE" >/dev/null 2>&1 || true
touch "$APP_BUNDLE"
xattr -dr com.apple.quarantine "$APP_HOME" "$APP_BUNDLE" 2>/dev/null || true

# Stop an older running copy so the update takes effect
pkill -f "$APP_HOME/runtime/bin/node server.js" 2>/dev/null || true
sleep 0.5

echo
bold "✓ Installed!"
echo "  Open “Overlay Generator” from Launchpad, Spotlight or ~/Applications."
echo "  Tip: drag it from ~/Applications to your Dock."
echo
[ -n "${OG_NO_OPEN:-}" ] || open "$APP_BUNDLE"
sleep 1
