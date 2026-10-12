// The top bar item. Resting the pointer on it shows the widgets over the
// windows for as long as it stays; a click holds them there.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

// Long enough that crossing the icon on the way elsewhere shows nothing.
const HOVER_DELAY_MS = 300;

export const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init({iconPath, onPeek, onHold, onEdit, onSettings}) {
        // Without the usual menu: a panel button opens its menu on any
        // click, and here the primary button holds the widgets instead.
        super._init(0.5, 'Ledge', true);
        this._onPeek = onPeek;
        this._onHold = onHold;
        this._pending = 0;

        this.add_child(new St.Icon({
            gicon: Gio.icon_new_for_string(iconPath),
            style_class: 'system-status-icon lg-indicator-icon',
        }));

        this._options = new PopupMenu.PopupMenu(this, 0.5, St.Side.TOP);
        this._options.addAction('Edit widgets', onEdit);
        this._options.addAction('Settings', onSettings);
        Main.uiGroup.add_child(this._options.actor);
        this._options.actor.hide();
        this._menus = new PopupMenu.PopupMenuManager(this);
        this._menus.addMenu(this._options);

        const click = new Clutter.ClickGesture();
        click.set_recognize_on_press(true);
        click.connect('recognize', () => this._clicked(click.get_button()));
        this.add_action(click);

        this.connect('notify::hover', () => this._hoverChanged());
        this.connect('destroy', () => {
            this._cancel();
            this._options.destroy();
        });
    }

    _clicked(button) {
        this._cancel();
        if (button === Clutter.BUTTON_SECONDARY) {
            this._onPeek(false);
            this._options.toggle();
            return;
        }
        this._options.close();
        this._onHold();
    }

    _hoverChanged() {
        this._cancel();
        if (!this.hover) {
            this._onPeek(false);
            return;
        }
        if (this._options.isOpen)
            return;
        this._pending = GLib.timeout_add(GLib.PRIORITY_DEFAULT, HOVER_DELAY_MS, () => {
            this._pending = 0;
            this._onPeek(true);
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancel() {
        if (this._pending)
            GLib.source_remove(this._pending);
        this._pending = 0;
    }
});
