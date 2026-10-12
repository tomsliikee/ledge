// The monitors by their connector names ("eDP-1", "DP-2"), which stay the
// same when a monitor is unplugged and plugged in again; their numbers do not.

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Connector name of every monitor, by monitor number.
export function connectors() {
    const names = [];
    for (const logical of global.backend.get_monitor_manager().get_logical_monitors())
        names[logical.get_number()] = logical.get_monitors()[0]?.get_connector() ?? `monitor-${logical.get_number()}`;
    return names;
}

export function primaryIndex() {
    return Math.max(0, Main.layoutManager.primaryIndex);
}

export function workArea(index) {
    return Main.layoutManager.getWorkAreaForMonitor(index);
}

// The monitor that holds the middle of a rectangle in stage coordinates.
export function monitorAt(x, y, width, height) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const found = Main.layoutManager.monitors.find(m =>
        cx >= m.x && cx < m.x + m.width && cy >= m.y && cy < m.y + m.height);
    return found ? found.index : primaryIndex();
}
