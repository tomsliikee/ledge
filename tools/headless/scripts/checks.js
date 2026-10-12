// Checks that need a running shell: the settings window writes through,
// the idle pause, switching the extension off and on, what the widgets
// cost, and two monitors.
export default async function ({extension, manager, hub, store, shot, sleep, note, move, press, release, Main}) {
    const GLib = imports.gi.GLib;
    const live = () => `${manager.tiles.filter(tile => tile._live).length}/${manager.tiles.length}`;
    const base = `file://${GLib.getenv('XDG_DATA_HOME')}/gnome-shell/extensions/ledge@thomashaiden`;

    // --- two monitors ---
    const {connectors} = await import(`${base}/views/monitors.js`);
    note(`monitors: ${JSON.stringify(connectors())}, primary ${Main.layoutManager.primaryIndex}, ` +
        `geometry ${JSON.stringify(Main.layoutManager.monitors.map(m => [m.x, m.y, m.width, m.height]))}`);
    if (Main.layoutManager.monitors.length > 1) {
        const other = Main.layoutManager.monitors.find(m => m.index !== Main.layoutManager.primaryIndex);
        const tile = manager.tiles[0];
        move(tile.x + 60, tile.y + 60); await sleep(200);
        press(); await sleep(150);
        for (let step = 1; step <= 12; step++) {
            move(tile.x + 60 + (other.x + 300 - tile.x - 60) * step / 12, tile.y + 60 + (other.y + 300 - tile.y - 60) * step / 12);
            await sleep(40);
        }
        release(); await sleep(800);
        const stored = store.widgets.find(w => w.id === tile.widget.id);
        note(`dragged ${stored.id} to the other monitor: stored on ${stored.monitor} at ${stored.x},${stored.y}; shown at ${tile.x},${tile.y}`);
        // A monitor that is gone: its widget must show on the primary one.
        store.updateWidget(stored.id, w => ({...w, monitor: 'DP-99'}));
        await sleep(500);
        const primary = Main.layoutManager.primaryMonitor;
        const shown = manager.tiles.find(t => t.widget.id === stored.id);
        note(`same widget stored on a missing monitor shows at ${shown.x},${shown.y} (primary spans x ${primary.x}..${primary.x + primary.width})`);
        await shot('monitors-1-own');

        store.screens = 'mirror';
        await sleep(900);
        note(`mirrored: ${manager.tiles.length} tiles for ${store.widgets.filter(w => w.enabled).length} widgets; ` +
            `per monitor ${JSON.stringify(Main.layoutManager.monitors.map(m => manager.tiles.filter(t => t.monitorIndex === m.index).length))}`);
        // Drag a copy on the other monitor; every copy must follow.
        const copy = manager.tiles.find(t => t.monitorIndex === other.index && t.widget.type === 'calendar');
        const was = [copy.widget.x, copy.widget.y];
        move(copy.x + 60, copy.y + 60); await sleep(200);
        press(); await sleep(150);
        for (let step = 1; step <= 8; step++) {
            move(copy.x + 60 - 30, copy.y + 60 + 25); await sleep(40);
        }
        release(); await sleep(900);
        const moved = store.widgets.find(w => w.type === 'calendar');
        const copies = manager.tiles.filter(t => t.widget.type === 'calendar').map(t => {
            const m = Main.layoutManager.monitors[t.monitorIndex];
            return [t.x - m.x, t.y - m.y - 32];
        });
        note(`mirrored calendar moved from ${was} to ${moved.x},${moved.y} (monitor kept: ${moved.monitor}); copies now at ${JSON.stringify(copies)}`);
        manager.show(true); await sleep(900);
        await shot('monitors-2-mirrored-held');
        manager.hide(); await sleep(600);
        store.screens = 'primary'; await sleep(700);
        note(`main screen only: ${manager.tiles.length} tiles, on monitors ${JSON.stringify(manager.tiles.map(t => t.monitorIndex))}`);
        store.screens = 'own'; await sleep(700);
        note(`own again: ${manager.tiles.length} tiles, on monitors ${JSON.stringify(manager.tiles.map(t => t.monitorIndex))}; ` +
            `stored ${JSON.stringify(store.widgets.map(w => w.monitor))}`);
        return;
    }

    // --- cost ---
    const ticks = () => Number(GLib.file_get_contents('/proc/self/stat')[1].toString().split(') ')[1].split(' ')[11]) +
        Number(new TextDecoder().decode(GLib.file_get_contents('/proc/self/stat')[1]).split(') ')[1].split(' ')[12]);
    const measure = async (label, seconds) => {
        const before = ticks();
        await sleep(seconds * 1000);
        note(`cost ${label}: ${((ticks() - before) / seconds).toFixed(2)} % of one core over ${seconds} s, live ${live()}`);
    };
    await sleep(3000);
    await measure('four starter widgets, motion on', 20);
    store.animations = false; await sleep(1000);
    await measure('four starter widgets, motion off', 20);
    store.animations = true;
    Main.overview.show(); await sleep(1500);
    await measure('nothing live (overview open)', 20);
    Main.overview.hide(); await sleep(1500);

    const started = GLib.get_monotonic_time();
    const {readText} = await import(`${base}/lib/sources/system.js`);
    let count = 0;
    const directory = GLib.Dir.open('/proc', 0);
    for (let name = directory.read_name(); name !== null; name = directory.read_name()) {
        if (/^\d+$/.test(name)) {
            readText(`/proc/${name}/stat`);
            count++;
        }
    }
    note(`reading ${count} processes took ${((GLib.get_monotonic_time() - started) / 1000).toFixed(1)} ms`);

    // --- idle ---
    const {IdleWatch} = await import(`${base}/lib/idle.js`);
    const real = manager._idle;
    manager._idle = new IdleWatch({thresholdMs: 2000, onIdle: () => manager.updateLive(), onActive: () => manager.updateLive()});
    manager.updateLive();
    note(`before idle: live ${live()}`);
    await sleep(3000);
    note(`after 3 s without input (threshold 2 s): live ${live()}, running ${[...hub._entries.values()].filter(e => e.running).length}`);
    move(700, 600); await sleep(600);
    note(`after pointer motion: live ${live()}`);
    manager._idle.destroy();
    manager._idle = real;

    // --- settings window ---
    extension.openPreferences();
    await sleep(6000);
    const window = global.get_window_actors().map(a => a.meta_window).find(w => w.get_title() === 'Ledge');
    const frame = window.get_frame_rect();
    note(`cpu widget before: ${store.widgets.some(w => w.type === 'cpu' && w.enabled)}`);
    // The CPU row's switch, as laid out in the 640px wide window.
    move(frame.x + 548, frame.y + 340); await sleep(300);
    press(); await sleep(80); release(); await sleep(1200);
    const cpu = store.widgets.find(w => w.type === 'cpu');
    note(`cpu widget after clicking its switch in the window: ${JSON.stringify(cpu)}`);
    window.delete(global.get_current_time());
    await sleep(800);

    // --- off and on, as the lock screen does ---
    Main.extensionManager.disableExtension('ledge@thomashaiden');
    await sleep(1000);
    note(`disabled: state ${Main.extensionManager.lookup('ledge@thomashaiden').state}, icon ${Boolean(Main.panel.statusArea['ledge@thomashaiden'])}`);
    Main.extensionManager.enableExtension('ledge@thomashaiden');
    await sleep(2500);
    const again = Main.extensionManager.lookup('ledge@thomashaiden');
    note(`enabled again: state ${again.state}, tiles ${again.stateObj._manager.tiles.length}, error ${again.error ?? 'none'}`);
}
