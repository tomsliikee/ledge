// The settings window of the Extensions app. It offers the same settings as
// the arranging mode inside the shell and writes to the same place, so
// either can be used.

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {fromBackup, toBackup} from './lib/backup.js';
import {catalog, typeSizes} from './lib/catalog.js';
import * as Layout from './lib/layout.js';
import {newSession, searchPlaces} from './lib/sources/weather.js';
import {Store} from './lib/store.js';
import {styles} from './lib/tokens.js';

const SCREENS = ['own', 'mirror', 'primary'];
const capitalised = word => word[0].toUpperCase() + word.slice(1);

function widgetsPage(store) {
    const page = new Adw.PreferencesPage({title: 'Widgets', icon_name: 'view-grid-symbolic'});
    const group = new Adw.PreferencesGroup({
        title: 'Widgets',
        description: 'A widget that is switched on appears at a free spot on the desktop. Arrange them from the top bar icon.',
    });
    page.add(group);

    const rows = new Map();
    for (const [type, entry] of Object.entries(catalog)) {
        const row = new Adw.SwitchRow({title: entry.title, subtitle: entry.about});
        row.connect('notify::active', () => {
            // Also fires when the row is only brought in line with the setting.
            if (row.active !== Layout.isTypeEnabled(store.widgets, type))
                store.widgets = Layout.setTypeEnabled(store.widgets, type, row.active, entry);
        });
        rows.set(type, row);
        group.add(row);
    }
    const refresh = () => {
        const widgets = store.widgets;
        for (const [type, row] of rows)
            row.active = Layout.isTypeEnabled(widgets, type);
    };
    refresh();
    return {page, refresh};
}

function lookGroup(store) {
    const group = new Adw.PreferencesGroup({title: 'Look'});
    const style = new Adw.ComboRow({
        title: 'Colour',
        model: Gtk.StringList.new(styles.map(capitalised)),
    });
    style.connect('notify::selected', () => {
        if (styles[style.selected] !== store.style)
            store.style = styles[style.selected];
    });
    const expressive = new Adw.SwitchRow({
        title: 'Expressive',
        subtitle: 'Tiles in the tones of the colour scheme, and values on shapes that grow with them.',
    });
    expressive.connect('notify::active', () => {
        if (expressive.active !== store.expressive)
            store.expressive = expressive.active;
    });
    const translucent = new Adw.SwitchRow({
        title: 'See-through',
        subtitle: 'Lets the wallpaper show through the widgets.',
    });
    translucent.connect('notify::active', () => {
        if (translucent.active !== store.translucent)
            store.translucent = translucent.active;
    });
    const animations = new Adw.SwitchRow({
        title: 'Motion',
        subtitle: 'Moving hands, gliding rings and widgets that rise.',
    });
    animations.connect('notify::active', () => {
        if (animations.active !== store.animations)
            store.animations = animations.active;
    });
    const screens = new Adw.ComboRow({
        title: 'Several screens',
        subtitle: 'A screen keeps its own widgets when it is unplugged.',
        model: Gtk.StringList.new(['Each its own widgets', 'The same on every screen', 'Main screen only']),
    });
    screens.connect('notify::selected', () => {
        if (SCREENS[screens.selected] !== store.screens)
            store.screens = SCREENS[screens.selected];
    });
    group.add(style);
    group.add(expressive);
    group.add(translucent);
    group.add(animations);
    group.add(screens);
    const refresh = () => {
        screens.selected = SCREENS.indexOf(store.screens);
        style.selected = styles.indexOf(store.style);
        expressive.active = store.expressive;
        translucent.active = store.translucent;
        animations.active = store.animations;
    };
    refresh();
    return {group, refresh};
}

// Asks for the next combination of keys in a small window of its own.
function askForShortcut(parent, onChosen) {
    const dialog = new Adw.Window({
        transient_for: parent, modal: true, default_width: 380, default_height: 180, title: 'Shortcut',
    });
    dialog.set_content(new Adw.StatusPage({
        title: 'Press the keys',
        description: 'Escape leaves it as it is.',
    }));
    const keys = new Gtk.EventControllerKey();
    keys.connect('key-pressed', (_keys, keyval, _keycode, state) => {
        const modifiers = state & Gtk.accelerator_get_default_mod_mask();
        if (keyval === Gdk.KEY_Escape && modifiers === 0) {
            dialog.close();
            return true;
        }
        // A modifier on its own is the start of a combination, not one.
        if (!Gtk.accelerator_valid(keyval, modifiers))
            return true;
        onChosen(Gtk.accelerator_name(keyval, modifiers));
        dialog.close();
        return true;
    });
    dialog.add_controller(keys);
    dialog.present();
}

function behaviourGroup(store, window) {
    const group = new Adw.PreferencesGroup({title: 'Use'});
    const shortcut = new Adw.ActionRow({
        title: 'Shortcut',
        subtitle: 'Holds the widgets over the windows; pressed again, they go back.',
    });
    const keys = new Gtk.ShortcutLabel({disabled_text: 'None', valign: Gtk.Align.CENTER});
    const change = new Gtk.Button({label: 'Change', valign: Gtk.Align.CENTER});
    const reset = new Gtk.Button({icon_name: 'edit-undo-symbolic', tooltip_text: 'Back to Super+W', valign: Gtk.Align.CENTER});
    const none = new Gtk.Button({icon_name: 'edit-clear-symbolic', tooltip_text: 'No shortcut', valign: Gtk.Align.CENTER});
    change.connect('clicked', () => askForShortcut(window, accelerator => {
        store.shortcut = accelerator;
    }));
    reset.connect('clicked', () => store.resetShortcut());
    none.connect('clicked', () => {
        store.shortcut = null;
    });
    for (const widget of [keys, change, reset, none])
        shortcut.add_suffix(widget);

    const openApps = new Adw.SwitchRow({
        title: 'Open apps on click',
        subtitle: 'A click on the weather opens Weather, one on the calendar Calendar, and so on.',
    });
    openApps.connect('notify::active', () => {
        if (openApps.active !== store.openApps)
            store.openApps = openApps.active;
    });
    group.add(shortcut);
    group.add(openApps);
    const refresh = () => {
        keys.accelerator = store.shortcut ?? '';
        none.sensitive = store.shortcut !== null;
        openApps.active = store.openApps;
    };
    refresh();
    return {group, refresh};
}

function weatherGroup(store, window) {
    const group = new Adw.PreferencesGroup({
        title: 'Place for the weather',
        description: 'The search sends what you type to Open-Meteo, the forecast the coordinates of the place.',
    });
    const current = new Adw.ActionRow({title: 'Place'});
    const search = new Adw.EntryRow({title: 'Search for a town', show_apply_button: true});
    group.add(current);
    group.add(search);

    let results = [];
    const clear = () => {
        for (const row of results)
            group.remove(row);
        results = [];
    };
    const session = newSession();
    window.connect('close-request', () => {
        session.abort();
        return false;
    });
    search.connect('apply', async () => {
        clear();
        let places;
        try {
            places = await searchPlaces(session, search.text.trim());
        } catch {
            places = null;
        }
        if (!places || places.length === 0) {
            const row = new Adw.ActionRow({title: places ? 'Nothing found' : 'The search could not be reached'});
            results.push(row);
            group.add(row);
            return;
        }
        for (const place of places) {
            const row = new Adw.ActionRow({title: place.name, subtitle: place.region, activatable: true});
            row.add_suffix(new Gtk.Image({icon_name: 'go-next-symbolic'}));
            row.connect('activated', () => {
                store.place = place;
                search.text = '';
                clear();
            });
            results.push(row);
            group.add(row);
        }
    });
    const refresh = () => {
        const place = store.place;
        current.subtitle = place ? [place.name, place.region].filter(Boolean).join(', ') : 'None chosen yet';
    };
    refresh();
    return {group, refresh};
}

function photoGroup(store, window) {
    const group = new Adw.PreferencesGroup({title: 'Photo'});
    const row = new Adw.ActionRow({title: 'Folder'});
    const choose = new Gtk.Button({label: 'Choose', valign: Gtk.Align.CENTER});
    row.add_suffix(choose);
    group.add(row);
    choose.connect('clicked', () => {
        new Gtk.FileDialog({title: 'Folder of pictures'}).select_folder(window, null, (dialog, result) => {
            let folder;
            try {
                folder = dialog.select_folder_finish(result).get_path();
            } catch {
                // Closed without choosing.
                return;
            }
            store.widgets = store.widgets.map(widget => widget.type === 'photo'
                ? {...widget, options: {...widget.options, folder}}
                : widget);
        });
    });
    const refresh = () => {
        const photo = store.widgets.find(widget => widget.type === 'photo');
        row.subtitle = photo?.options.folder || (photo ? 'Your Pictures folder' : 'Switch the Photo widget on first');
        choose.sensitive = Boolean(photo);
    };
    refresh();
    return {group, refresh};
}

// Saves the arrangement to a file and brings one back, to carry it to
// another machine.
function backupGroup(store, window) {
    const group = new Adw.PreferencesGroup({
        title: 'Arrangement',
        description: 'The widgets with their places and settings, the look and the place of the weather, as one file.',
    });
    const toast = title => window.add_toast(new Adw.Toast({title}));
    const filter = new Gtk.FileFilter({name: 'Ledge arrangement'});
    filter.add_pattern('*.json');
    const filters = new Gio.ListStore({item_type: Gtk.FileFilter});
    filters.append(filter);

    const save = new Adw.ButtonRow({title: 'Save to a file…', start_icon_name: 'document-save-symbolic'});
    save.connect('activated', () => {
        new Gtk.FileDialog({title: 'Save the arrangement', initial_name: 'ledge.json', filters}).save(window, null, (dialog, result) => {
            let file;
            try {
                file = dialog.save_finish(result);
            } catch {
                // Closed without choosing.
                return;
            }
            const text = toBackup({
                widgets: store.widgets, style: store.style, expressive: store.expressive, translucent: store.translucent,
                animations: store.animations, screens: store.screens, place: store.place,
            });
            try {
                file.replace_contents(new TextEncoder().encode(text), null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
                toast(`Saved to ${GLib.path_get_basename(file.get_path())}`);
            } catch (e) {
                toast(`Could not be saved: ${e.message}`);
            }
        });
    });
    const load = new Adw.ButtonRow({title: 'Load from a file…', start_icon_name: 'document-open-symbolic'});
    load.connect('activated', () => {
        new Gtk.FileDialog({title: 'Load an arrangement', filters}).open(window, null, (dialog, result) => {
            let settings = null;
            try {
                const [, contents] = dialog.open_finish(result).load_contents(null);
                settings = fromBackup(new TextDecoder().decode(contents), typeSizes, styles);
            } catch (e) {
                if (e.matches?.(Gtk.DialogError, Gtk.DialogError.DISMISSED))
                    return;
            }
            if (!settings) {
                toast('This file is not a Ledge arrangement');
                return;
            }
            // Each value has a setter of its name on the store.
            for (const [key, value] of Object.entries(settings))
                store[key] = value;
            toast(`Loaded ${settings.widgets.length} widgets`);
        });
    });
    group.add(save);
    group.add(load);
    return {group};
}

export default class LedgePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const store = new Store(this.getSettings());
        const widgets = widgetsPage(store);
        const look = lookGroup(store);
        const behaviour = behaviourGroup(store, window);
        const weather = weatherGroup(store, window);
        const photo = photoGroup(store, window);

        const general = new Adw.PreferencesPage({title: 'General', icon_name: 'preferences-system-symbolic'});
        general.add(look.group);
        general.add(behaviour.group);
        general.add(weather.group);
        general.add(photo.group);
        general.add(backupGroup(store, window).group);
        window.add(widgets.page);
        window.add(general);

        // The shell's arranging mode may change the same settings meanwhile.
        store.onChange(() => {
            widgets.refresh();
            look.refresh();
            behaviour.refresh();
            weather.refresh();
            photo.refresh();
        });
        window.connect('close-request', () => {
            store.destroy();
            return false;
        });
    }
}
