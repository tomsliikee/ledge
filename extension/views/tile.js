// One widget on the desktop: the rounded surface, and the life of what is
// shown on it. A tile only receives readings while it can be seen.

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import St from 'gi://St';

import {SIZES} from '../lib/layout.js';
import {sizes} from '../lib/tokens.js';

export const Tile = GObject.registerClass(
class Tile extends St.Widget {
    // services: what a widget may use beyond drawing; see Manager.
    _init({widget, definition, build, services}) {
        super._init({
            layout_manager: new Clutter.BinLayout(),
            reactive: true,
            // Scaled from the middle when it appears or is picked up.
            pivot_point: new Graphene.Point({x: 0.5, y: 0.5}),
        });
        this.widget = widget;
        this._definition = definition;
        this._build = build;
        this._services = services;
        this._watchers = new Set();
        this._live = false;
        this._view = null;
        this.connect('destroy', () => this._clear());
        this.rebuild(widget);
    }

    // Builds the content anew, for another size, other options or colours.
    rebuild(widget) {
        this._clear();
        this.widget = widget;
        const {width, height} = SIZES[widget.size];
        this.set_size(width, height);
        const expressive = this._services.expressive();
        const tone = expressive ? this._definition.tone : null;
        this.style_class = ['lg-tile', this._definition.bare ? 'lg-tile-bare' : '', tone ? `lg-tile-${tone}` : ''].join(' ');
        this.visible = true;

        const padding = this._definition.bare ? 0 : 2 * sizes['space-4'];
        this._view = this._safely(() => this._build({
            id: widget.id,
            size: widget.size,
            width: width - padding,
            height: height - padding,
            options: {...this._definition.defaults, ...widget.options},
            theme: this._services.theme(),
            expressive,
            // The tone the marks of this tile are drawn in.
            accent: tone ?? 'primary',
            twelveHour: this._services.twelveHour(),
            place: () => this._services.place(),
            watch: (key, handler) => this._watch(key, handler),
            act: (key, command) => this._services.hub.act(key, command),
            setOptions: (patch, rebuild = true) => this._services.setOptions(this, patch, rebuild),
            notify: (title, body) => this._services.notify(title, body),
            // A widget with nothing to show on this machine steps aside.
            hide: hidden => {
                this.visible = !hidden;
            },
        }));
        // A bin only stretches a child that asks for the room.
        this._view.actor.x_expand = true;
        this._view.actor.y_expand = true;
        this.add_child(this._view.actor);
    }

    // One widget that fails to build must not take the others with it.
    _safely(build) {
        try {
            return build();
        } catch (e) {
            console.error(`Ledge: the ${this.widget.type} widget could not be built: ${e.message}\n${e.stack}`);
            return {actor: new St.Label({text: 'This widget could not be shown.', style_class: 'lg-muted'})};
        }
    }

    _watch(key, handler) {
        const watcher = {key, handler, stop: null};
        this._watchers.add(watcher);
        if (this._live)
            watcher.stop = this._services.hub.subscribe(key, handler);
        return () => {
            watcher.stop?.();
            this._watchers.delete(watcher);
        };
    }

    // live: whether anyone can see the tile right now.
    setLive(live) {
        if (live === this._live)
            return;
        this._live = live;
        for (const watcher of this._watchers) {
            if (live) {
                watcher.stop = this._services.hub.subscribe(watcher.key, watcher.handler);
            } else {
                watcher.stop?.();
                watcher.stop = null;
            }
        }
    }

    _clear() {
        for (const watcher of this._watchers)
            watcher.stop?.();
        this._watchers.clear();
        this._view?.destroy?.();
        this._view = null;
        this.destroy_all_children();
    }
});
