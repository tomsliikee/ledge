// The layer that shows the widgets over the windows: a scrim, the widgets
// at the places they have on the desktop, and the controls for arranging.

import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {LAYOUT_MS, STATE_MS, ease} from './motion.js';
import {pressedActor} from './parts.js';
import {text} from './text.js';

const EDGE = 28;

export class Overlay {
    // onClose: the user dismissed it. onEdit: the user asked to arrange.
    constructor({onClose, onEdit}) {
        this._onClose = onClose;
        this._onEdit = onEdit;
        this._grab = null;
        this.shown = false;
        this.pinned = false;

        this.actor = new St.Widget({visible: false, reactive: true, can_focus: true});
        this._scrim = new St.Widget({style_class: 'lg-scrim', opacity: 0});
        // Holds the widgets while they are shown here.
        this.holder = new St.Widget();
        this._controls = new St.Widget();
        this.actor.add_child(this._scrim);
        this.actor.add_child(this.holder);
        this.actor.add_child(this._controls);

        this._edit = this._pill('Edit widgets', () => this._onEdit());
        this._controls.add_child(this._edit);

        this.actor.connect('button-press-event', (_actor, event) => {
            // A button does not stop the press it is clicked with, so a press
            // on a control arrives here too. Only one into the open closes.
            if (pressedActor(event) !== this.actor)
                return Clutter.EVENT_PROPAGATE;
            this._onClose();
            return Clutter.EVENT_STOP;
        });
        this.actor.connect('key-press-event', (_actor, event) => {
            if (event.get_key_symbol() !== Clutter.KEY_Escape)
                return Clutter.EVENT_PROPAGATE;
            this._onClose();
            return Clutter.EVENT_STOP;
        });

        // Beneath the top bar, so its icon stays reachable and undimmed.
        Main.layoutManager.uiGroup.insert_child_below(this.actor, Main.layoutManager.panelBox);
        this.resize();
    }

    _pill(label, onClick, loud = false) {
        const button = new St.Button({
            style_class: loud ? 'lg-pill lg-pill-loud' : 'lg-pill',
            child: text('nav-label', {content: label}),
            can_focus: true,
        });
        button.connect('clicked', onClick);
        return button;
    }

    // Extra controls of the arranging mode, laid over the widgets.
    get controls() {
        return this._controls;
    }

    setEditPillVisible(visible) {
        this._edit.visible = visible;
    }

    resize() {
        const {width, height} = global.stage;
        for (const actor of [this.actor, this._scrim, this.holder, this._controls])
            actor.set_size(width, height);
        const area = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
        const [, pillWidth] = this._edit.get_preferred_width(-1);
        const [, pillHeight] = this._edit.get_preferred_height(-1);
        // In the bottom right corner, clear of a dock in the middle. Floating
        // controls rest 28px from the edge.
        this._edit.set_position(
            area.x + area.width - pillWidth - EDGE,
            area.y + area.height - pillHeight - EDGE);
    }

    // pinned: held open and usable; otherwise only a look while hovering.
    show(pinned) {
        if (!this.shown) {
            this.shown = true;
            this.actor.show();
            ease(this._scrim, {opacity: 255}, LAYOUT_MS);
        }
        this._controls.visible = pinned;
        // Set before the grab: taking it ends the hover on the top bar icon,
        // which must find the widgets held already and leave them.
        this.pinned = pinned;
        if (pinned && !this._grab) {
            this._grab = Main.pushModal(this.actor, {actionMode: Shell.ActionMode.SYSTEM_MODAL});
            this.actor.grab_key_focus();
        }
        this.resize();
    }

    // onHidden runs once the scrim is gone and the widgets can go back.
    hide(onHidden) {
        if (!this.shown)
            return;
        this.shown = false;
        this.pinned = false;
        this._release();
        ease(this._scrim, {
            opacity: 0,
            onComplete: () => {
                // Shown again while it faded: stay.
                if (this.shown)
                    return;
                this.actor.hide();
                onHidden();
            },
        }, STATE_MS);
    }

    _release() {
        if (this._grab)
            Main.popModal(this._grab);
        this._grab = null;
    }

    destroy() {
        this._release();
        this.actor.destroy();
    }
}
