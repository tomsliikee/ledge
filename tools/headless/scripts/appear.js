// How the widgets arrive over a maximised window: together, as one sheet,
// and back again when the look is taken up while they leave.
const at = (column, row, type, size) => ({
    id: `${type}-${column}-${row}`, type, size, enabled: true, monitor: 0,
    x: 24 + column * 176, y: 24 + row * 176, placed: true, options: {},
});

export default async function ({manager, store, shot, sleep, note, move, Main}) {
    const Gio = imports.gi.Gio;
    const GLib = imports.gi.GLib;
    store.place = {name: 'Vienna', region: 'Vienna, Austria', latitude: 48.208, longitude: 16.373, timezone: 'Europe/Vienna'};
    store.widgets = [
        at(0, 0, 'clock', 'small'), at(1, 0, 'calendar', 'small'), at(2, 0, 'weather', 'medium'),
        at(0, 1, 'system', 'medium'), at(2, 1, 'battery', 'small'), at(3, 1, 'timer', 'small'),
        at(4, 0, 'cpu', 'small'), at(5, 0, 'memory', 'small'), at(4, 1, 'daylight', 'medium'),
    ];
    const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.NONE});
    launcher.setenv('WAYLAND_DISPLAY', 'ledge-test', true);
    launcher.setenv('GDK_BACKEND', 'wayland', true);
    const here = GLib.path_get_dirname(GLib.getenv('LEDGE_SCRIPT'));
    const window = launcher.spawnv(['gjs', '-m', `${here}/../window.js`]);
    await sleep(4000);

    const state = label => {
        const tiles = manager.tiles.map(tile =>
            `${tile.opacity}/${tile.scale_x.toFixed(3)}/${tile.translation_y.toFixed(1)}`);
        note(`${label}: ${[...new Set(tiles)].join(' ')} (${tiles.length} tiles)`);
    };
    const icon = Main.panel.statusArea['ledge@thomashaiden'];
    const [x, y] = icon.get_transformed_position();
    move(x + icon.width / 2, y + icon.height / 2);
    await sleep(380);
    state('arriving');
    await shot('appear-1-arriving');
    await sleep(500);
    state('arrived');
    await shot('appear-2-arrived');

    move(600, 500); await sleep(90);
    state('leaving');
    manager.show(false); await sleep(60);
    state('taken up again');
    await sleep(500);
    state('back');
    note(`in the holder: ${manager.tiles.every(tile => tile.get_parent() === manager.overlay.holder)}`);

    manager.hide(true); await sleep(600);
    state('gone');
    note(`on the desktop: ${manager.tiles.every(tile => tile.get_parent() !== manager.overlay.holder)}`);
    window.force_exit();
}
