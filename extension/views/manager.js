// Owns the widgets: creates them from the stored layout, puts them on the
// desktop or over the windows, lets them be dragged, and gives readings
// only to those that can be seen.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {STARTERS, catalog} from '../lib/catalog.js';
import * as Layout from '../lib/layout.js';
import {snap} from '../lib/snap.js';
import {coveredMonitors, shownWidgets} from '../lib/visibility.js';
import * as Monitors from './monitors.js';
import {LAYOUT_MS, STATE_MS, ease, setMotion} from './motion.js';
import {Overlay} from './overlay.js';
import {pressedControl} from './parts.js';
import {Tile} from './tile.js';
import {builders} from './widgets/index.js';

// A press that moves less than this is a click, not a drag.
const DRAG_THRESHOLD = 6;
const LIFTED_SCALE = 1.03;
const APPEAR_SCALE = 0.96;
const APPEAR_RISE = 12;

export class Manager {
    constructor({store, hub, idle, power}) {
        this._power = power;
        this._store = store;
        this._hub = hub;
        this._idle = idle;
        this._tiles = new Map();
        this._drag = null;
        this._recount = 0;
        this._covered = new Set();
        this._signals = [];
        // The monitor new widgets go to; set while arranging.
        this.targetMonitor = null;

        this._interface = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});

        // On the wallpaper, beneath every window.
        this._desktop = new St.Widget();
        const background = Main.layoutManager._backgroundGroup;
        background.add_child(this._desktop);
        this._ghost = new St.Widget({style_class: 'lg-ghost', visible: false});
        this._desktop.add_child(this._ghost);

        this._overlay = new Overlay({
            onClose: () => this.hide(),
            onEdit: () => this._onEdit?.(),
        });

        this._services = {
            hub,
            theme: () => this._theme,
            expressive: () => this._store.expressive,
            twelveHour: () => this._interface.get_string('clock-format') === '12h',
            place: () => store.place,
            notify: (title, body) => Main.notify(title, body),
            setOptions: (id, patch, rebuild = true) => this._setOptions(id, patch, rebuild),
        };

        this._connect(this._interface, 'changed::color-scheme', () => this._restyle());
        this._connect(this._interface, 'changed::clock-format', () => this._restyle());
        // The shell adds a fresh wallpaper on top when the monitors change.
        this._connect(background, 'child-added', () => background.set_child_above_sibling(this._desktop, null));
        this._connect(Main.layoutManager, 'monitors-changed', () => this._sync());
        this._connect(global.display, 'workareas-changed', () => this._relayout());
        this._connect(Main.overview, 'showing', () => this._updateLive());
        this._connect(Main.overview, 'hidden', () => this._updateLive());
        this._connect(global.display, 'restacked', () => this._queueRecount());
        this._connect(global.window_manager, 'size-changed', () => this._queueRecount());
        this._connect(global.window_manager, 'minimize', () => this._queueRecount());
        this._connect(global.window_manager, 'switch-workspace', () => this._queueRecount());

        // Widgets may be set to step aside on battery.
        this._stopPower = power.listen(() => this._sync());

        store.onChange(key => {
            if (key === 'widgets' || key === 'screens')
                this._sync();
            else if (key === 'place')
                hub.restart('weather');
            else
                this._restyle();
        });

        // Colours first: a tile cannot be built before its theme is known.
        this._restyle();
        if (!store.hasLayout)
            store.widgets = this._starters();
        this._recountCovered();
    }

    // The edit mode registers here; it is built apart from the manager.
    set onEdit(callback) {
        this._onEdit = callback;
    }

    get overlay() {
        return this._overlay;
    }

    get theme() {
        return this._theme;
    }

    get hasBattery() {
        return this._power.battery?.present === true;
    }

    get tiles() {
        return [...this._tiles.values()];
    }

    _connect(object, signal, handler) {
        this._signals.push([object, object.connect(signal, handler)]);
    }

    _starters() {
        const index = Monitors.primaryIndex();
        const area = Monitors.workArea(index);
        const widgets = [];
        for (const [type, size] of STARTERS) {
            const spot = Layout.freeSpot(size, widgets.map(Layout.rectOf), area);
            widgets.push({
                id: Layout.newId(type, widgets),
                type, size,
                enabled: true,
                placed: true,
                monitor: Monitors.connectors()[index] ?? null,
                ...spot,
                options: {},
            });
        }
        return widgets;
    }

    // Colours, type and motion changed: every widget is drawn anew.
    _restyle() {
        const dark = this._interface.get_string('color-scheme') === 'prefer-dark';
        this._theme = `${this._store.style}-${dark ? 'dark' : 'light'}`;
        setMotion(this._store.animations);
        const classes = [`lg-root-${this._theme}`, this._store.translucent ? 'lg-translucent' : '',
            this._store.expressive ? 'lg-expressive' : ''].join(' ');
        this._desktop.style_class = classes;
        this._overlay.actor.style_class = classes;
        for (const tile of this._tiles.values())
            tile.rebuild(tile.widget);
        this._sync();
    }

    // Brings the tiles in line with the stored layout. A widget has one tile
    // on its own monitor, one on the primary monitor, or one on every
    // monitor, as the screens setting says.
    _sync() {
        if (this._placeNew())
            return;
        const names = Monitors.connectors();
        const primary = Monitors.primaryIndex();
        const screens = this._store.screens;
        const wanted = new Map();
        for (const widget of shownWidgets(this._store.widgets, {onBattery: this._power.onBattery})) {
            if (screens === 'mirror') {
                for (const monitor of Main.layoutManager.monitors)
                    wanted.set(`${widget.id}@${monitor.index}`, {widget, index: monitor.index});
            } else if (screens === 'primary') {
                wanted.set(widget.id, {widget, index: primary});
            } else {
                const index = Math.max(0, names.indexOf(Layout.monitorFor(widget, names, names[primary])));
                wanted.set(widget.id, {widget, index});
            }
        }
        for (const [key, tile] of this._tiles) {
            if (!wanted.has(key)) {
                tile.destroy();
                this._tiles.delete(key);
            }
        }
        for (const [key, {widget, index}] of wanted) {
            let tile = this._tiles.get(key);
            if (!tile) {
                tile = new Tile({widget, definition: catalog[widget.type], build: builders[widget.type], services: this._services});
                tile.connect('button-press-event', (_tile, event) => this._pressed(tile, event));
                this._container().add_child(tile);
                this._tiles.set(key, tile);
            } else if (tile.widget.size !== widget.size ||
                JSON.stringify(tile.widget.options) !== JSON.stringify(widget.options)) {
                tile.rebuild(widget);
            } else {
                tile.widget = widget;
            }
            tile.monitorIndex = index;
        }
        this._relayout();
        this._updateLive();
        this._onSynced?.();
    }

    // Gives widgets that were added without a place a free spot, on the
    // monitor that is being arranged or else on the primary one. True when the layout was rewritten for it; that
    // write brings the next sync.
    _placeNew() {
        const widgets = this._store.widgets;
        if (widgets.every(widget => widget.placed))
            return false;
        const names = Monitors.connectors();
        const index = this._store.screens === 'own' ? this.targetMonitor ?? Monitors.primaryIndex() : Monitors.primaryIndex();
        const area = Monitors.workArea(index);
        const placed = [];
        for (const widget of widgets) {
            if (widget.placed) {
                placed.push(widget);
                continue;
            }
            const taken = placed
                .filter(other => other.enabled && Layout.monitorFor(other, names, names[index]) === names[index])
                // As they are shown: a widget stored beyond the edge lies inside it.
                .map(other => Layout.clamp(Layout.rectOf(other), area));
            placed.push({...widget, placed: true, monitor: names[index] ?? null, ...Layout.freeSpot(widget.size, taken, area)});
        }
        this._store.widgets = placed;
        return true;
    }

    set onSynced(callback) {
        this._onSynced = callback;
    }

    _container() {
        return this._overlay.shown ? this._overlay.holder : this._desktop;
    }

    _relayout() {
        const {width, height} = global.stage;
        this._desktop.set_size(width, height);
        this._overlay.resize();
        for (const tile of this._tiles.values()) {
            if (tile === this._drag?.tile)
                continue;
            const area = Monitors.workArea(tile.monitorIndex);
            const rect = Layout.clamp(Layout.rectOf(tile.widget), area);
            tile.set_position(area.x + rect.x, area.y + rect.y);
        }
    }

    _setOptions(tile, patch, rebuild) {
        const id = tile.widget.id;
        // A widget that changed its own content (a note being typed) must
        // not be rebuilt under the user's hands.
        if (!rebuild)
            tile.widget = {...tile.widget, options: {...tile.widget.options, ...patch}};
        this._store.updateWidget(id, widget => ({...widget, options: {...widget.options, ...patch}}));
    }

    // --- what can be seen ---------------------------------------------

    _queueRecount() {
        if (this._recount)
            return;
        this._recount = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._recount = 0;
            this._recountCovered();
            return GLib.SOURCE_REMOVE;
        });
    }

    _recountCovered() {
        const workspace = global.workspace_manager.get_active_workspace();
        const windows = global.get_window_actors().map(actor => actor.meta_window)
            .filter(window => window.get_window_type() === Meta.WindowType.NORMAL)
            .map(window => ({
                monitor: window.get_monitor(),
                covers: window.is_fullscreen() || window.is_maximized(),
                minimized: window.minimized,
                onActiveWorkspace: window.located_on_workspace(workspace),
            }));
        this._covered = coveredMonitors(windows);
        this._updateLive();
    }

    // Called by the idle watch as well.
    _updateLive() {
        const desktopSeen = !this._idle.isIdle() && !Main.overview.visible;
        for (const tile of this._tiles.values())
            tile.setLive(this._overlay.shown || (desktopSeen && !this._covered.has(tile.monitorIndex)));
    }

    updateLive() {
        this._updateLive();
    }

    // --- over the windows ---------------------------------------------

    // pinned: held and usable. Without it, a look that ends with hide().
    show(pinned) {
        // A look never takes over from held widgets.
        if (this._overlay.pinned && !pinned)
            return;
        const first = !this._overlay.shown;
        this._overlay.show(pinned);
        if (!first)
            return;
        for (const tile of this._tiles.values()) {
            // Shown again while they were leaving: they are here already and
            // come back from wherever they got to.
            const leaving = tile.get_parent() === this._overlay.holder;
            if (!leaving) {
                this._desktop.remove_child(tile);
                this._overlay.holder.add_child(tile);
            }
            // A tile on a free desktop is in view already and stays as it
            // is. Those behind a window arrive together, as one sheet.
            if (!leaving && this._covered.has(tile.monitorIndex)) {
                tile.set({
                    opacity: 0, translation_y: APPEAR_RISE,
                    scale_x: APPEAR_SCALE, scale_y: APPEAR_SCALE,
                });
            }
            ease(tile, {opacity: 255, translation_y: 0, scale_x: 1, scale_y: 1},
                LAYOUT_MS, Clutter.AnimationMode.EASE_OUT_QUINT);
        }
        this._moveGhost(this._overlay.holder);
        this._updateLive();
    }

    // peek: end only a look, and leave held widgets alone.
    hide(peek = false) {
        if (!this._overlay.shown || (peek && this._overlay.pinned))
            return;
        this._onHide?.();
        for (const tile of this._tiles.values()) {
            if (this._covered.has(tile.monitorIndex)) {
                ease(tile, {opacity: 0, scale_x: APPEAR_SCALE, scale_y: APPEAR_SCALE},
                    STATE_MS, Clutter.AnimationMode.EASE_IN_CUBIC);
            }
        }
        this._overlay.hide(() => {
            for (const tile of this._tiles.values()) {
                tile.remove_all_transitions();
                this._overlay.holder.remove_child(tile);
                this._desktop.add_child(tile);
                tile.set({opacity: 255, translation_y: 0, scale_x: 1, scale_y: 1});
            }
            this._moveGhost(this._desktop);
            this._updateLive();
        });
    }

    set onHide(callback) {
        this._onHide = callback;
    }

    _moveGhost(container) {
        this._ghost.get_parent().remove_child(this._ghost);
        container.insert_child_at_index(this._ghost, 0);
    }

    // --- dragging ------------------------------------------------------

    _pressed(tile, event) {
        if (event.get_button() !== Clutter.BUTTON_PRIMARY || this._drag)
            return Clutter.EVENT_PROPAGATE;
        // Left to travel on: a button recognises its click from the whole
        // press, and stopping the press here would cancel it.
        if (pressedControl(event, tile))
            return Clutter.EVENT_PROPAGATE;
        const [pointerX, pointerY] = event.get_coords();
        const drag = {
            tile,
            offsetX: tile.x - pointerX,
            offsetY: tile.y - pointerY,
            startX: pointerX,
            startY: pointerY,
            moved: false,
            grab: global.stage.grab(tile),
        };
        drag.motion = tile.connect('motion-event', (_tile, e) => this._dragged(e));
        drag.release = tile.connect('button-release-event', () => this._dropped());
        this._drag = drag;
        return Clutter.EVENT_STOP;
    }

    // Where a tile at stage position x, y would come to rest.
    _target(tile, x, y) {
        // Only with a layout of its own per monitor can a widget change
        // monitors; otherwise it is moved within the one it was picked up on.
        const index = this._store.screens === 'own' ? Monitors.monitorAt(x, y, tile.width, tile.height) : tile.monitorIndex;
        const area = Monitors.workArea(index);
        const others = this.tiles
            .filter(other => other !== tile && other.visible && other.monitorIndex === index)
            .map(other => ({x: other.x - area.x, y: other.y - area.y, width: other.width, height: other.height}));
        const rect = snap({x: x - area.x, y: y - area.y, width: tile.width, height: tile.height}, others, area);
        return {index, area, x: rect.x, y: rect.y};
    }

    _dragged(event) {
        const drag = this._drag;
        const [pointerX, pointerY] = event.get_coords();
        if (!drag.moved) {
            if (Math.hypot(pointerX - drag.startX, pointerY - drag.startY) < DRAG_THRESHOLD)
                return Clutter.EVENT_STOP;
            drag.moved = true;
            drag.tile.get_parent().set_child_above_sibling(drag.tile, null);
            ease(drag.tile, {scale_x: LIFTED_SCALE, scale_y: LIFTED_SCALE});
            this._ghost.set_size(drag.tile.width, drag.tile.height);
            this._ghost.show();
        }
        const x = pointerX + drag.offsetX;
        const y = pointerY + drag.offsetY;
        drag.tile.set_position(x, y);
        const target = this._target(drag.tile, x, y);
        this._ghost.set_position(target.area.x + target.x, target.area.y + target.y);
        return Clutter.EVENT_STOP;
    }

    _dropped() {
        const drag = this._drag;
        this._drag = null;
        drag.grab.dismiss();
        drag.tile.disconnect(drag.motion);
        drag.tile.disconnect(drag.release);
        this._ghost.hide();
        if (!drag.moved) {
            // While arranging a click selects; otherwise it opens the app.
            if (!this._onTileClicked?.(drag.tile))
                this._open(drag.tile);
            return Clutter.EVENT_STOP;
        }
        const target = this._target(drag.tile, drag.tile.x, drag.tile.y);
        drag.tile.monitorIndex = target.index;
        ease(drag.tile, {
            x: target.area.x + target.x, y: target.area.y + target.y, scale_x: 1, scale_y: 1,
        }, LAYOUT_MS);
        const monitor = Monitors.connectors()[target.index] ?? null;
        // The monitor a widget belongs to is only rewritten where it shows;
        // the other modes keep it for the way back.
        this._store.updateWidget(drag.tile.widget.id, widget => this._store.screens === 'own'
            ? {...widget, monitor, x: target.x, y: target.y}
            : {...widget, x: target.x, y: target.y});
        this._updateLive();
        return Clutter.EVENT_STOP;
    }

    // Opens the app that belongs to a widget, if there is one installed.
    _open(tile) {
        if (!this._store.openApps)
            return;
        for (const name of catalog[tile.widget.type].opens) {
            if (name === 'player') {
                this._hub.act('media', 'Raise');
            } else {
                const app = Shell.AppSystem.get_default().lookup_app(`${name}.desktop`);
                if (!app)
                    continue;
                app.activate();
            }
            this.hide();
            return;
        }
    }

    // callback returns true when it took the click.
    set onTileClicked(callback) {
        this._onTileClicked = callback;
    }

    destroy() {
        this._stopPower();
        if (this._recount)
            GLib.source_remove(this._recount);
        if (this._drag)
            this._drag.grab.dismiss();
        for (const [object, id] of this._signals)
            object.disconnect(id);
        this._signals = [];
        for (const tile of this._tiles.values())
            tile.destroy();
        this._tiles.clear();
        this._overlay.destroy();
        this._desktop.destroy();
    }
}
