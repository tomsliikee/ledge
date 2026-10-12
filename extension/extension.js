import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {Hub} from './lib/hub.js';
import {IdleWatch} from './lib/idle.js';
import {Power} from './lib/power.js';
import {factories} from './lib/sources/index.js';
import {Store} from './lib/store.js';
import {EditMode} from './views/edit.js';
import {Indicator} from './views/indicator.js';
import {Manager} from './views/manager.js';
import {disposeThumbs} from './views/thumb.js';

const IDLE_AFTER_MS = 20 * 60 * 1000;
// On battery every source reads half as often.
const BATTERY_PACE = 2;

export default class LedgeExtension extends Extension {
    enable() {
        this._store = new Store(this.getSettings());
        this._power = new Power();
        this._hub = new Hub(factories, {
            power: this._power,
            place: () => this._store.place,
            helperPath: name => `${this.path}/helpers/${name}`,
        });
        this._stopPower = this._power.listen(() => this._hub.setPace(this._power.onBattery ? BATTERY_PACE : 1));
        this._idle = new IdleWatch({
            thresholdMs: IDLE_AFTER_MS,
            onIdle: () => this._manager.updateLive(),
            onActive: () => this._manager.updateLive(),
        });
        this._manager = new Manager({store: this._store, hub: this._hub, idle: this._idle});
        this._edit = new EditMode({manager: this._manager, store: this._store});

        this._indicator = new Indicator({
            iconPath: `${this.path}/icons/ledge-symbolic.svg`,
            onPeek: show => show ? this._manager.show(false) : this._manager.hide(true),
            onHold: () => this._manager.overlay.pinned ? this._manager.hide() : this._manager.show(true),
            onEdit: () => this._edit.open(),
            onSettings: () => this.openPreferences(),
        });
        // Directly left of the system menu.
        const rightBox = Main.panel._rightBox;
        const systemMenu = Main.panel.statusArea.quickSettings?.container;
        const position = Math.max(0, rightBox.get_children().indexOf(systemMenu));
        Main.panel.addToStatusArea(this.uuid, this._indicator, position, 'right');
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
        this._edit.destroy();
        this._edit = null;
        this._manager.destroy();
        this._manager = null;
        this._idle.destroy();
        this._idle = null;
        this._stopPower();
        this._hub.destroy();
        this._hub = null;
        this._power.destroy();
        this._power = null;
        this._store.destroy();
        this._store = null;
        disposeThumbs();
    }
}
