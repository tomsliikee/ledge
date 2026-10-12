// The battery, shared by the battery widget and by the pace of all sources.

import UPower from 'gi://UPowerGlib';

const STATES = {
    [UPower.DeviceState.CHARGING]: 'charging',
    [UPower.DeviceState.PENDING_CHARGE]: 'charging',
    [UPower.DeviceState.DISCHARGING]: 'discharging',
    [UPower.DeviceState.PENDING_DISCHARGE]: 'discharging',
    [UPower.DeviceState.EMPTY]: 'discharging',
    [UPower.DeviceState.FULLY_CHARGED]: 'full',
};

export class Power {
    constructor() {
        this._listeners = new Set();
        this._client = null;
        this._device = null;
        this._destroyed = false;
        UPower.Client.new_async(null, (_source, result) => {
            let client;
            try {
                client = UPower.Client.new_finish(result);
            } catch (e) {
                console.debug(`Ledge: no power service: ${e.message}`);
                return;
            }
            if (this._destroyed)
                return;
            this._client = client;
            this._device = client.get_display_device();
            this._clientId = client.connect('notify::on-battery', () => this._changed());
            this._deviceId = this._device.connect('notify', () => this._changed());
            this._changed();
        });
    }

    get onBattery() {
        return this._client?.on_battery ?? false;
    }

    // null until the service answered; present is false on a machine without a battery.
    get battery() {
        const device = this._device;
        if (!device)
            return null;
        const state = STATES[device.state] ?? 'unknown';
        const seconds = state === 'charging' ? device.time_to_full : device.time_to_empty;
        return {
            present: device.is_present,
            percent: device.percentage,
            state,
            remaining: seconds > 0 ? seconds * 1000 : null,
        };
    }

    listen(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }

    _changed() {
        for (const callback of [...this._listeners])
            callback();
    }

    destroy() {
        this._destroyed = true;
        if (this._clientId)
            this._client.disconnect(this._clientId);
        if (this._deviceId)
            this._device.disconnect(this._deviceId);
        this._listeners.clear();
        this._client = null;
        this._device = null;
    }
}
