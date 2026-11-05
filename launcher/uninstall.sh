#!/bin/bash
# Removes Overlay Generator from this Mac (including its private Node.js runtime).
APP_HOME="$HOME/Library/Application Support/Overlay Generator"
pkill -f "$APP_HOME/runtime/bin/node server.js" 2>/dev/null
rm -rf "$HOME/Applications/Overlay Generator.app"
echo "Removed the app. Your presets, fonts and logs are in:"
echo "  $APP_HOME"
read -r -p "Delete those too? [y/N] " a
if [[ "$a" =~ ^[Yy]$ ]]; then rm -rf "$APP_HOME"; echo "Deleted."; fi
