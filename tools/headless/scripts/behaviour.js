// What runs when: readings stop behind a maximised window and in the
// overview; the top bar icon shows the widgets on hover and holds them on click.
export default async function ({extension, manager, hub, store, shot, sleep, note, move, press, release, Main}) {
    const Gio = imports.gi.Gio;
    const GLib = imports.gi.GLib;
    store.place = {name: 'Vienna', region: 'Vienna, Austria', latitude: 48.208, longitude: 16.373, timezone: 'Europe/Vienna'};
    const state = label => {
        const running = [...hub._entries.entries()].filter(([, entry]) => entry.running).map(([key]) => key);
        note(`${label}: live tiles ${manager.tiles.filter(tile => tile._live).length}/${manager.tiles.length}, ` +
            `running sources [${running.join(', ')}], overlay shown=${manager.overlay.shown} pinned=${manager.overlay.pinned}`);
    };
    await sleep(2500);
    state('free desktop');

    Main.overview.show(); await sleep(1200);
    state('overview open');
    Main.overview.hide(); await sleep(1200);
    state('overview closed');

    const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.NONE});
    launcher.setenv('WAYLAND_DISPLAY', 'ledge-test', true);
    launcher.setenv('GDK_BACKEND', 'wayland', true);
    const here = GLib.path_get_dirname(GLib.getenv('LEDGE_SCRIPT'));
    const window = launcher.spawnv(['gjs', '-m', `${here}/../window.js`]);
    await sleep(4000);
    state('maximised window');
    await shot('behaviour-1-covered');

    const icon = Main.panel.statusArea['ledge@thomashaiden'];
    const [x, y] = icon.get_transformed_position();
    move(x + icon.width / 2, y + icon.height / 2); await sleep(150);
    state('pointer on the icon, before the delay');
    await sleep(800);
    state('pointer on the icon, after the delay');
    await shot('behaviour-2-look');

    move(600, 500); await sleep(700);
    state('pointer moved away');
    await shot('behaviour-3-away');

    move(x + icon.width / 2, y + icon.height / 2); await sleep(100);
    press(); await sleep(80); release(); await sleep(900);
    state('icon clicked');
    move(600, 500); await sleep(500);
    state('held, pointer moved away');
    await shot('behaviour-4-held');

    // A button inside a held widget must work: start the timer.
    press(); await sleep(80); release(); await sleep(700);
    state('clicked into the open');

    window.force_exit();
    await sleep(1500);
    state('window closed');
}
