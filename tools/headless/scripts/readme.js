// The screenshots of the README: a set-up desktop in both schemes, the look
// over a window, the arranging mode, and the colour styles.
const SIZES = {small: [160, 160], medium: [336, 160], large: [336, 336]};

// Columns of 176 from the right edge, rows of 176 from the top.
function at(column, row, type, size, options = {}) {
    return {id: `${type}-${column}-${row}`, type, size, enabled: true, monitor: null,
        x: 1600 - 24 - 176 * column - SIZES[size][0] + (size === 'small' ? 0 : 0), y: 24 + 176 * row, options};
}

export default async function ({extension, manager, store, shot, sleep, move, press, release, desktop, background, Main}) {
    const Gio = imports.gi.Gio;
    const GLib = imports.gi.GLib;
    const pictures = `${GLib.getenv('LEDGE_OUT')}/pictures`;
    const scheme = async dark => {
        desktop.set_string('color-scheme', dark ? 'prefer-dark' : 'default');
        background.set_string('color-shading-type', 'vertical');
        background.set_string('primary-color', dark ? '#1b2440' : '#cfd5ee');
        background.set_string('secondary-color', dark ? '#0f1322' : '#e9ebf6');
        await sleep(600);
    };
    store.place = {name: 'Vienna', region: 'Vienna, Austria', latitude: 48.208, longitude: 16.373, timezone: 'Europe/Vienna'};
    store.widgets = [
        at(0, 0, 'clock', 'small'), at(1, 0, 'calendar', 'small'),
        at(0, 1, 'weather', 'medium'),
        at(0, 2, 'system', 'medium'),
        at(0, 3, 'battery', 'small'), at(1, 3, 'network', 'small'),
        at(0, 4, 'worldclock', 'medium'),
        at(2, 0, 'photo', 'large', {folder: pictures}),
        at(2, 2, 'note', 'medium', {text: 'Bread, coffee, lemons\nReturn the library books'}),
        at(2, 3, 'countdown', 'small', {title: 'Holiday', date: '2026-12-24'}), at(3, 3, 'timer', 'small'),
        at(2, 4, 'daylight', 'medium'),
    ];
    await scheme(true);
    await sleep(9000);
    await shot('hero-dark');
    await scheme(false);
    await sleep(2500);
    await shot('hero-light');

    // The look over a window.
    await scheme(true);
    const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.NONE});
    launcher.setenv('WAYLAND_DISPLAY', 'ledge-test', true);
    launcher.setenv('GDK_BACKEND', 'wayland', true);
    const here = GLib.path_get_dirname(GLib.getenv('LEDGE_SCRIPT'));
    const window = launcher.spawnv(['gjs', '-m', `${here}/../window.js`]);
    await sleep(4000);
    const icon = Main.panel.statusArea['ledge@thomashaiden'];
    const [x, y] = icon.get_transformed_position();
    move(x + icon.width / 2, y + icon.height / 2);
    await sleep(1500);
    await shot('look');
    move(500, 600);
    await sleep(800);
    window.force_exit();
    await sleep(1200);

    // Arranging, with the clock selected.
    extension._edit.open();
    await sleep(800);
    const clock = manager.tiles.find(tile => tile.widget.type === 'clock');
    move(clock.x + 80, clock.y + 80); await sleep(200);
    press(); await sleep(100); release(); await sleep(900);
    move(500, 600); await sleep(300);
    await shot('edit');
    manager.hide();
    await sleep(700);

    for (const [style, dark] of [['violet', true], ['green', false], ['orange', true], ['pink', false]]) {
        await scheme(dark);
        store.style = style;
        await sleep(2500);
        await shot(`style-${style}`);
    }
    store.style = 'blue';
}
