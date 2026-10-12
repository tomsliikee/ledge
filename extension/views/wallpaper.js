// The colour style that follows the wallpaper. It reads the picture of the
// light and of the dark scheme, takes the colour that carries each, and
// makes the scheme's colours and stylesheet from it while the shell runs.

import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {rolesFor, parseHex, seedOf} from '../lib/scheme.js';
import {schemeSheet} from '../lib/sheet.js';
import {parseSlideshow, slideAt} from '../lib/slideshow.js';
import {WALLPAPER_STYLE} from '../lib/store.js';
import {themed} from '../lib/template.js';
import {colors, sizes, styles} from '../lib/tokens.js';

// Small enough to read in a moment, large enough to keep the colours.
const SAMPLE = 64;
const PICTURE_KEYS = {light: 'picture-uri', dark: 'picture-uri-dark'};
const THEMES = ['light', 'dark'];

export class WallpaperStyle {
    // onChange: the colours of the style are others now.
    constructor({onChange}) {
        this._onChange = onChange;
        this._background = new Gio.Settings({schema_id: 'org.gnome.desktop.background'});
        this._cancellable = null;
        this._next = 0;
        this._until = null;
        this._seeds = {};
        this._file = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_cache_dir(), 'ledge', 'wallpaper.css']));
        this._loadedInto = null;
        // Until the picture is read, the default style stands in.
        for (const theme of THEMES)
            colors[`${WALLPAPER_STYLE}-${theme}`] = {...colors[`${styles[0]}-${theme}`]};

        this._context = St.ThemeContext.get_for_stage(global.stage);
        // A new shell theme starts without this stylesheet.
        this._contextId = this._context.connect('changed', () => this._load());
        this._backgroundId = this._background.connect('changed', () => this._read());
        this._read();
    }

    // The seeds in use, for a look from outside: {light, dark} as "#rrggbb".
    get seeds() {
        return {...this._seeds};
    }

    async _read() {
        this._cancellable?.cancel();
        const cancellable = this._cancellable = new Gio.Cancellable();
        const seeds = {};
        this._until = null;
        // Both schemes often share one picture; it is read once.
        const read = new Map();
        for (const theme of THEMES) {
            const uri = this._background.get_string(PICTURE_KEYS[theme]);
            if (!read.has(uri))
                read.set(uri, await this._seedFor(theme, cancellable));
            seeds[theme] = read.get(uri);
        }
        // The wallpaper changed again meanwhile; that reading has the say.
        if (cancellable.is_cancelled())
            return;
        this._wait();
        if (THEMES.every(theme => seeds[theme] === this._seeds[theme]))
            return;
        this._seeds = seeds;
        this._apply();
    }

    // The colour that carries the picture of a theme. Without a picture, or
    // with one that cannot be read, the wallpaper's plain colour.
    async _seedFor(theme, cancellable) {
        const plain = parseHex(this._background.get_string('primary-color')) === null
            ? null : this._background.get_string('primary-color').toLowerCase();
        const uri = this._background.get_string(PICTURE_KEYS[theme]);
        if (!uri || this._background.get_string('picture-options') === 'none')
            return plain;
        try {
            const picture = uri.endsWith('.xml') ? await this._slide(uri, cancellable) : Gio.File.new_for_uri(uri);
            if (!picture)
                return plain;
            const pixbuf = await new Promise((resolve, reject) => {
                picture.read_async(GLib.PRIORITY_LOW, cancellable, (file, opened) => {
                    try {
                        GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(file.read_finish(opened), SAMPLE, SAMPLE, true, cancellable,
                            (_source, loaded) => {
                                try {
                                    resolve(GdkPixbuf.Pixbuf.new_from_stream_finish(loaded));
                                } catch (e) {
                                    reject(e);
                                }
                            });
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            return seedOf(pixbuf.get_pixels(), {
                width: pixbuf.get_width(),
                height: pixbuf.get_height(),
                channels: pixbuf.get_n_channels(),
                rowstride: pixbuf.get_rowstride(),
            }) ?? plain;
        } catch (e) {
            if (!cancellable.is_cancelled())
                console.debug(`Ledge: the wallpaper could not be read: ${e.message}`);
            return plain;
        }
    }

    // The picture a wallpaper that changes through the day shows right now.
    async _slide(uri, cancellable) {
        const contents = await new Promise((resolve, reject) => {
            Gio.File.new_for_uri(uri).load_contents_async(cancellable, (file, result) => {
                try {
                    resolve(file.load_contents_finish(result)[1]);
                } catch (e) {
                    reject(e);
                }
            });
        });
        const show = parseSlideshow(new TextDecoder().decode(contents));
        if (!show)
            return null;
        const slide = slideAt(show, Date.now());
        this._until = Math.min(this._until ?? Infinity, slide.until);
        return Gio.File.new_for_path(slide.file);
    }

    // Reads again when the wallpaper shows its next picture.
    _wait() {
        if (this._next)
            GLib.source_remove(this._next);
        this._next = 0;
        if (this._until === null)
            return;
        const seconds = Math.max(1, Math.ceil((this._until - Date.now()) / 1000) + 1);
        this._next = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, seconds, () => {
            this._next = 0;
            this._read();
            return GLib.SOURCE_REMOVE;
        });
    }

    _apply() {
        const sheets = [];
        for (const theme of THEMES) {
            const scheme = `${WALLPAPER_STYLE}-${theme}`;
            const base = colors[`${styles[0]}-${theme}`];
            const seed = this._seeds[theme];
            // In place: the drawn marks hold on to this very object.
            Object.assign(colors[scheme], base, seed ? rolesFor(seed)[theme] : {});
            sheets.push(schemeSheet(themed, scheme, sizes, colors[scheme]));
        }
        try {
            GLib.mkdir_with_parents(this._file.get_parent().get_path(), 0o755);
            this._file.replace_contents(new TextEncoder().encode(`${sheets.join('\n\n')}\n`), null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            this._unload();
            this._load();
        } catch (e) {
            console.error(`Ledge: the wallpaper's stylesheet could not be written: ${e.message}`);
        }
        this._onChange();
    }

    _load() {
        const theme = this._context.get_theme();
        if (this._loadedInto === theme || !this._file.query_exists(null))
            return;
        // Set first: loading announces a changed theme, which leads back here.
        this._loadedInto = theme;
        theme.load_stylesheet(this._file);
    }

    _unload() {
        this._loadedInto?.unload_stylesheet(this._file);
        this._loadedInto = null;
    }

    destroy() {
        this._cancellable?.cancel();
        if (this._next)
            GLib.source_remove(this._next);
        this._background.disconnect(this._backgroundId);
        this._context.disconnect(this._contextId);
        this._unload();
        for (const theme of THEMES)
            delete colors[`${WALLPAPER_STYLE}-${theme}`];
    }
}
