#!/bin/bash
# Double-click this file on the office Mac to start the Overlay Generator.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org (LTS) and try again."
  read -n 1 -s -r -p "Press any key to close"; exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1 && [ ! -x /opt/homebrew/bin/ffmpeg ] && [ ! -x /usr/local/bin/ffmpeg ]; then
  echo "Note: ffmpeg not found. Only PNG-sequence export will work. Install with:  brew install ffmpeg"
fi
(sleep 1.5; open "http://localhost:${PORT:-4321}") &
node server.js
