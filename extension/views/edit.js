// The arranging mode: a panel beside the held widgets to switch widgets on
// and off, set up the one that was clicked, and choose how they all look.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {parseDate} from '../lib/calendar.js';
import {catalog, typeSizes} from '../lib/catalog.js';
import * as Layout from '../lib/layout.js';
import * as Stack from '../lib/stack.js';
import {newSession, searchPlaces} from '../lib/sources/weather.js';
import {styles} from '../lib/tokens.js';
import {entry, group, item, itemButton, section, segments, switchItem} from './controls.js';
import * as Monitors from './monitors.js';
import {LAYOUT_MS, ease} from './motion.js';
import {CENTER, iconButton, row} from './parts.js';
import {Swatch} from './swatch.js';
import {text} from './text.js';

const WIDTH = 360;
const EDGE = 16;
const SELECTED_SCALE = 1.03;
const SIZE_NAMES = {small: 'Small', medium: 'Medium', large: 'Large'};
const MAX_CITIES = 6;

// "<Super>w" as "Super + W".
function shortcutLabel(accelerator) {
    if (!accelerator)
        return 'None';
    const parts = accelerator.replace(/[<>]/g, ' ').trim().split(/\s+/);
    return parts.map(part => part.length === 1 ? part.toUpperCase() : part).join(' + ');
}

export class EditMode {
    constructor({manager, store}) {
        this._manager = manager;
        this._store = store;
        this._overlay = manager.overlay;
        this._selected = null;
        this._session = null;
        this.active = false;

        this._content = new St.BoxLayout({vertical: true, style_class: 'lg-panel-content'});
        this._scroll = new St.ScrollView({
            style_class: 'lg-panel',
            child: this._content,
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            reactive: true,
            visible: false,
        });
        this._overlay.controls.add_child(this._scroll);

        manager.onEdit = () => this.open();
        manager.onHide = () => this.close();
        manager.onTileClicked = tile => {
            if (this.active)
                this._select(tile.widget.id);
            return this.active;
        };
        manager.onSynced = () => {
            if (!this.active)
                return;
            // A stack was turned: what is selected is what shows.
            const selected = this._widgets().find(widget => widget.id === this._selected);
            if (selected?.stack && !selected.top)
                this._selected = Stack.topOf(Stack.membersOf(this._widgets(), selected.stack)).id;
            this._fill();
        };
    }

    open() {
        if (this.active)
            return;
        this.active = true;
        this._manager.arranging = true;
        this._manager.show(true);
        this._overlay.setEditPillVisible(false);
        this._place();
        this._scroll.show();
        this._fill();
    }

    close() {
        if (!this.active)
            return;
        this.active = false;
        this._manager.arranging = false;
        this._manager.targetMonitor = null;
        this._select(null);
        this._scroll.hide();
        this._overlay.setEditPillVisible(true);
        this._session?.abort();
        this._session = null;
    }

    // On the monitor the pointer is on, at the side where fewer widgets lie.
    // New widgets go to that monitor too.
    _place() {
        const [x, y] = global.get_pointer();
        const index = Monitors.monitorAt(x, y, 0, 0);
        this._manager.targetMonitor = index;
        const area = Monitors.workArea(index);
        const middle = area.x + area.width / 2;
        const tiles = this._manager.tiles.filter(tile => tile.monitorIndex === index);
        const right = tiles.filter(tile => tile.x + tile.width / 2 > middle).length;
        const onLeft = right > tiles.length - right;
        this._scroll.set_size(WIDTH, area.height - 2 * EDGE);
        this._scroll.set_position(onLeft ? area.x + EDGE : area.x + area.width - WIDTH - EDGE, area.y + EDGE);
    }

    _select(id) {
        if (id === this._selected)
            return;
        for (const tile of this._manager.tiles) {
            const scale = tile.widget.id === id ? SELECTED_SCALE : 1;
            ease(tile, {scale_x: scale, scale_y: scale}, LAYOUT_MS, Clutter.AnimationMode.EASE_OUT_BACK);
        }
        this._selected = id;
        if (this.active)
            this._fill();
    }

    _widgets() {
        return this._store.widgets;
    }

    _update(id, change) {
        this._store.updateWidget(id, change);
    }

    _setOption(id, patch) {
        this._update(id, widget => ({...widget, options: {...widget.options, ...patch}}));
    }

    // Draws the whole panel anew; it is small and changes rarely.
    _fill() {
        const theme = this._manager.theme;
        this._content.destroy_all_children();
        const add = actor => this._content.add_child(actor);

        const done = new St.Button({
            style_class: 'lg-pill lg-pill-loud',
            child: text('nav-label', {content: 'Done'}),
            can_focus: true,
            y_align: CENTER,
        });
        done.connect('clicked', () => this._manager.hide());
        const head = row({children: [text('headline', {expand: true, content: 'Widgets'}), done]});
        add(head);

        const selected = this._widgets().find(widget => widget.id === this._selected && widget.enabled);
        if (selected) {
            add(section(`Selected: ${catalog[selected.type].title}`));
            add(this._selectedGroup(selected));
            if (selected.stack) {
                add(section('In this stack'));
                add(group(Stack.membersOf(this._widgets(), selected.stack).map(member => {
                    const out = iconButton('list-remove-symbolic', () => {
                        this._store.widgets = Stack.leave(this._widgets(), member.id);
                    }, {small: true, kind: 'quiet', label: `Take ${catalog[member.type].title} out of the stack`});
                    return item(catalog[member.type].title, member.top ? 'Showing' : null, out);
                })));
                add(text('aside', {tone: 'muted', wrap: true, content: 'Turn the stack with the wheel or its dots. A widget taken out goes to a free spot.'}));
            }
        } else {
            add(text('label', {tone: 'muted', wrap: true, content: 'Drag a widget to move it, or onto the middle of another to stack them. Click one to set it up.'}));
        }

        add(section('All widgets'));
        add(group(Object.entries(catalog).map(([type, entry_]) => {
            const more = entry_.multiple && Layout.isTypeEnabled(this._widgets(), type)
                ? iconButton('list-add-symbolic', () => this._add(type), {small: true, kind: 'quiet', label: `Another ${entry_.title}`})
                : null;
            return switchItem(entry_.title, entry_.about, theme, Layout.isTypeEnabled(this._widgets(), type),
                on => this._toggle(type, on), more);
        })));

        add(section('Look'));
        const swatches = new St.BoxLayout({style_class: 'lg-swatches', y_align: CENTER});
        const scheme = theme.split('-')[1];
        for (const style of styles) {
            const swatch = new Swatch({style, theme: scheme});
            swatch.setSelected(style === this._store.style);
            const button = new St.Button({style_class: 'lg-swatch', child: swatch, can_focus: true, accessible_name: style});
            button.connect('clicked', () => {
                this._store.style = style;
            });
            swatches.add_child(button);
        }
        add(group([
            item('Colour', null, swatches),
            switchItem('Expressive', 'Tiles in the tones of the colour scheme, and values on shapes that grow with them.', theme, this._store.expressive,
                on => {
                    this._store.expressive = on;
                }),
            switchItem('See-through', 'Lets the wallpaper show through the widgets.', theme, this._store.translucent,
                on => {
                    this._store.translucent = on;
                }),
            switchItem('Motion', 'Moving hands, gliding rings and widgets that rise.', theme, this._store.animations,
                on => {
                    this._store.animations = on;
                }),
        ]));

        add(section('Use'));
        add(group([
            switchItem('Open apps on click', 'A click on the weather opens Weather, one on the calendar Calendar, and so on.', theme, this._store.openApps,
                on => {
                    this._store.openApps = on;
                }),
            item('Shortcut', 'Holds the widgets over the windows. Change it in the settings window.',
                text('label', {tone: 'muted', content: shortcutLabel(this._store.shortcut)})),
        ]));

        if (Main.layoutManager.monitors.length > 1) {
            add(section('Screens'));
            const about = {
                own: 'Each screen has its own widgets. New ones go to the screen this panel is on.',
                mirror: 'Every widget shows on every screen, at the same place.',
                primary: 'All widgets show on the main screen only.',
            };
            const choice = segments([['own', 'Own'], ['mirror', 'Mirrored'], ['primary', 'Main only']],
                this._store.screens, screens => {
                    this._store.screens = screens;
                });
            const box = new St.BoxLayout({vertical: true, style_class: 'lg-item lg-column', x_expand: true});
            box.add_child(choice);
            box.add_child(text('label', {tone: 'muted', wrap: true, content: about[this._store.screens]}));
            add(group([box]));
        }

        add(section('Place for the weather'));
        const place = this._store.place;
        add(group([
            place ? item(place.name, place.region) : null,
            this._search('Search for a town', found => {
                this._store.place = found;
                this._fill();
            }),
        ]));
        add(text('aside', {tone: 'muted', wrap: true, content: 'The search sends what you type to Open-Meteo, the forecast the coordinates of the place.'}));
    }

    // What can be set on the widget that was clicked.
    _selectedGroup(widget) {
        const entry_ = catalog[widget.type];
        const options = {...entry_.defaults, ...widget.options};
        const choice = (title, key, choices) => item(title, null,
            segments(choices, options[key], value => this._setOption(widget.id, {[key]: value})));
        const rows = [];

        // In a stack: the sizes all its widgets offer, set for all of them.
        const offered = Stack.sharedSizes(this._widgets(), widget.id, typeSizes);
        if (offered.length > 1) {
            rows.push(item('Size', null, segments(
                ['small', 'medium', 'large'].filter(size => offered.includes(size)).map(size => [size, SIZE_NAMES[size]]),
                widget.size, size => {
                    this._store.widgets = Stack.setShared(this._widgets(), widget.id, {size});
                })));
        }

        if (widget.type === 'clock')
            rows.push(choice('Face', 'face', [['analog', 'Hands'], ['digital', 'Figures']]));
        if (widget.type === 'processes')
            rows.push(choice('Ranked by', 'by', [['cpu', 'CPU'], ['memory', 'Memory']]));
        if (widget.type === 'timer') {
            rows.push(choice('Kind', 'mode', [['timer', 'Timer'], ['stopwatch', 'Stopwatch']]));
            if (options.mode === 'timer')
                rows.push(choice('Minutes', 'minutes', [5, 15, 25, 45].map(m => [m, String(m)])));
        }
        if (widget.type === 'pomodoro') {
            rows.push(choice('Focus', 'work', [15, 25, 45, 50].map(m => [m, String(m)])));
            rows.push(choice('Break', 'rest', [5, 10, 15].map(m => [m, String(m)])));
        }
        if (widget.type === 'countdown') {
            rows.push(item('Title', null, entry(options.title, 'Holiday', title => this._setOption(widget.id, {title}))));
            rows.push(item('Date', parseDate(options.date) ? null : 'As year-month-day, like 2026-12-24.',
                entry(options.date, '2026-12-24', date => this._setOption(widget.id, {date: date.trim()}))));
        }
        if (widget.type === 'photo') {
            rows.push(item('Folder', 'Empty means your Pictures folder.',
                entry(options.folder, '/home/you/Pictures', folder => this._setOption(widget.id, {folder: folder.trim()}))));
        }
        if (widget.type === 'worldclock') {
            options.cities.forEach((city, i) => {
                const remove = iconButton('list-remove-symbolic',
                    () => this._setOption(widget.id, {cities: options.cities.filter((_c, j) => j !== i)}),
                    {small: true, kind: 'quiet', label: `Remove ${city.name}`});
                rows.push(item(city.name, city.timezone, remove));
            });
            if (options.cities.length < MAX_CITIES) {
                rows.push(this._search('Add a city', found => {
                    if (found.timezone)
                        this._setOption(widget.id, {cities: [...options.cities, {name: found.name, timezone: found.timezone}]});
                }));
            }
        }

        if (this._manager.hasBattery) {
            rows.push(switchItem('Hide on battery', 'Steps aside while the machine is not plugged in.', this._manager.theme,
                options.hideOnBattery === true, on => this._setOption(widget.id, {hideOnBattery: on})));
        }

        rows.push(itemButton('Remove', null, () => {
            const id = widget.id;
            this._select(null);
            // The only widget of a type is switched off and keeps its place;
            // one of several is taken away for good.
            const several = this._widgets().filter(w => w.type === widget.type).length > 1;
            this._store.widgets = several
                ? Layout.removeWidget(this._widgets(), id)
                : this._widgets().map(w => w.id === id ? {...w, enabled: false} : w);
        }, 'user-trash-symbolic'));
        return group(rows);
    }

    // A search field with the places it found beneath it.
    _search(hintText, onPick) {
        const results = new St.BoxLayout({vertical: true, style_class: 'lg-group'});
        const field = entry('', hintText, async name => {
            results.destroy_all_children();
            if (name.trim().length < 2)
                return;
            this._session ??= newSession();
            let places;
            try {
                places = await searchPlaces(this._session, name.trim());
            } catch {
                places = null;
            }
            // The panel may have been drawn anew while the answer travelled.
            if (!results.get_stage())
                return;
            if (!places || places.length === 0) {
                results.add_child(text('label', {tone: 'muted', content: places ? 'Nothing found.' : 'The search could not be reached.'}));
                return;
            }
            for (const found of places)
                results.add_child(itemButton(found.name, found.region, () => onPick(found)));
        });
        const box = new St.BoxLayout({vertical: true, style_class: 'lg-item lg-column', x_expand: true});
        box.add_child(field);
        box.add_child(results);
        return box;
    }


    _toggle(type, on) {
        this._store.widgets = Layout.setTypeEnabled(this._widgets(), type, on, catalog[type]);
    }

    _add(type) {
        this._store.widgets = Layout.addWidget(this._widgets(), type, catalog[type]);
    }

    destroy() {
        this._session?.abort();
        this._scroll.destroy();
    }
}
