#!/usr/bin/env bash
# Links the extension into GNOME Shell for the current user and enables it.
# Run it again after moving the repository; updating is a plain "git pull".
set -euo pipefail

UUID="ledge@thomashaiden"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$UUID"
FONT_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/fonts"
FONT="$REPO/toms-expressive-design/fonts/GoogleSansFlex.woff2"

command -v gjs >/dev/null || { echo "gjs is missing; it ships with GNOME Shell." >&2; exit 1; }
command -v glib-compile-schemas >/dev/null || { echo "glib-compile-schemas is missing; it ships with GLib." >&2; exit 1; }

# The settings are read through a compiled schema, which is not kept in git.
glib-compile-schemas --strict "$REPO/extension/schemas"

if [ -e "$TARGET" ] && [ ! -L "$TARGET" ]; then
    echo "$TARGET exists and is not a link. Move it away first." >&2
    exit 1
fi
mkdir -p "$(dirname "$TARGET")"
ln -sfn "$REPO/extension" "$TARGET"
echo "Linked $TARGET"

if ! fc-list : family | grep -q "Google Sans Flex"; then
    mkdir -p "$FONT_DIR"
    cp "$FONT" "$FONT_DIR/"
    fc-cache -f "$FONT_DIR"
    echo "Installed Google Sans Flex to $FONT_DIR"
fi
# The bundled web font carries no variable axes for fontconfig, so the wide
# and rounded cuts need the variable TTF from Google Fonts.
if ! fc-list : family variable | grep "Google Sans Flex" | grep -q "variable=True"; then
    echo "Note: for the design's wide, rounded type, install the variable"
    echo "      Google Sans Flex TTF from fonts.google.com into $FONT_DIR."
fi

# Written to the setting directly: the running shell only learns about a new
# extension at the next login, and "gnome-extensions enable" fails until then.
enabled="$(gsettings get org.gnome.shell enabled-extensions)"
if [[ "$enabled" != *"'$UUID'"* ]]; then
    if [[ "$enabled" == "@as []" || "$enabled" == "[]" ]]; then
        gsettings set org.gnome.shell enabled-extensions "['$UUID']"
    else
        gsettings set org.gnome.shell enabled-extensions "${enabled%]}, '$UUID']"
    fi
fi
echo "Enabled. Log out and back in to load it."
