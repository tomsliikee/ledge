#!/usr/bin/env bash
# Runs the extension in a GNOME Shell without a screen, with its own
# settings, and lets a script drive it and take screenshots.
#
#   tools/headless/run.sh <script> [seconds] [monitor arguments...]
#
# <script> is a file in tools/headless/scripts, without ".js". Screenshots
# and the log go to $LEDGE_OUT (default: a folder in the system's temp).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
export LEDGE_OUT="${LEDGE_OUT:-${TMPDIR:-/tmp}/ledge-headless}"
ENV="$LEDGE_OUT/env"
EXTENSIONS="$ENV/data/gnome-shell/extensions"

mkdir -p "$EXTENSIONS" "$ENV/config" "$ENV/cache" "$LEDGE_OUT/shots"
ln -sfn "$REPO/extension" "$EXTENSIONS/ledge@thomashaiden"
ln -sfn "$HERE/driver" "$EXTENSIONS/ledge-driver@test"
# The scratch data folder has no fonts of its own.
ln -sfn "${XDG_DATA_HOME:-$HOME/.local/share}/fonts" "$ENV/data/fonts"
glib-compile-schemas "$REPO/extension/schemas"

export LEDGE_SCRIPT="$HERE/scripts/$1.js"
export LEDGE_SECONDS="${2:-60}"
shift; shift || true
export LEDGE_MONITORS="${*:---virtual-monitor 1600x1000}"
export XDG_CONFIG_HOME="$ENV/config" XDG_CACHE_HOME="$ENV/cache" XDG_DATA_HOME="$ENV/data"
# Shows what the extension reports with console.debug.
export G_MESSAGES_DEBUG=Gjs-Console
unset WAYLAND_DISPLAY DISPLAY

exec dbus-run-session -- bash -c '
gsettings set org.gnome.shell enabled-extensions "[\"ledge@thomashaiden\", \"ledge-driver@test\"]"
gsettings set org.gnome.shell disable-user-extensions false
gsettings set org.gnome.shell welcome-dialog-last-shown-version "99"
gsettings set org.gnome.desktop.interface color-scheme prefer-dark
gsettings set org.gnome.desktop.interface enable-hot-corners false
gsettings set org.gnome.desktop.background picture-options none
gsettings set org.gnome.desktop.background color-shading-type solid
gsettings set org.gnome.desktop.background primary-color "#1d2433"
timeout "$LEDGE_SECONDS" gnome-shell --headless $LEDGE_MONITORS --wayland-display ledge-test --no-x11 2>&1'
