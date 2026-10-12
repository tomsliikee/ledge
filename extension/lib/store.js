// The settings, read and written as the values the code works with. They
// live in GSettings because the settings window is a process of its own
// and both sides must see a change at once.

import {typeSizes} from './catalog.js';
import {parseLayout} from './layout.js';
import {styles} from './tokens.js';
import {parsePlace} from './weather.js';

// The style whose colours are taken from the wallpaper while the shell runs.
export const WALLPAPER_STYLE = 'wallpaper';
export const allStyles = [...styles, WALLPAPER_STYLE];

export class Store {
    constructor(settings) {
        this._settings = settings;
        this._handlers = [];
    }

    // False until the first start has placed its widgets.
    get hasLayout() {
        return this._settings.get_string('widgets') !== '';
    }

    get widgets() {
        return parseLayout(this._settings.get_string('widgets'), typeSizes);
    }

    set widgets(list) {
        const text = JSON.stringify(list);
        // Writing an unchanged value would still wake every listener.
        if (text !== this._settings.get_string('widgets'))
            this._settings.set_string('widgets', text);
    }

    // Changes one widget; change gets it and returns its replacement.
    updateWidget(id, change) {
        this.widgets = this.widgets.map(widget => widget.id === id ? change(widget) : widget);
    }

    get style() {
        const style = this._settings.get_string('style');
        return allStyles.includes(style) ? style : styles[0];
    }

    set style(style) {
        this._settings.set_string('style', style);
    }

    get translucent() {
        return this._settings.get_boolean('translucent');
    }

    set translucent(value) {
        this._settings.set_boolean('translucent', value);
    }

    get animations() {
        return this._settings.get_boolean('animations');
    }

    set animations(value) {
        this._settings.set_boolean('animations', value);
    }

    get expressive() {
        return this._settings.get_boolean('expressive');
    }

    set expressive(value) {
        this._settings.set_boolean('expressive', value);
    }

    // "own", "mirror" or "primary"; see the schema.
    get screens() {
        return this._settings.get_string('screens');
    }

    set screens(value) {
        this._settings.set_string('screens', value);
    }

    // The accelerator that holds the widgets over the windows, or null.
    get shortcut() {
        return this._settings.get_strv('toggle-shortcut')[0] ?? null;
    }

    set shortcut(accelerator) {
        this._settings.set_strv('toggle-shortcut', accelerator ? [accelerator] : []);
    }

    resetShortcut() {
        this._settings.reset('toggle-shortcut');
    }

    get openApps() {
        return this._settings.get_boolean('open-apps');
    }

    set openApps(value) {
        this._settings.set_boolean('open-apps', value);
    }

    get place() {
        return parsePlace(this._settings.get_string('place'));
    }

    set place(place) {
        this._settings.set_string('place', place ? JSON.stringify(place) : '');
    }

    // Calls back with the name of each setting that changed.
    onChange(callback) {
        this._handlers.push(this._settings.connect('changed', (_settings, key) => callback(key)));
    }

    destroy() {
        for (const id of this._handlers)
            this._settings.disconnect(id);
        this._handlers = [];
    }
}
