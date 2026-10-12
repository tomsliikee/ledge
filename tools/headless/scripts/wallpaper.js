// The style taken from the wallpaper: a plain colour, a picture, a
// wallpaper that changes through the day, and a picture that cannot be read.
const at = (id, type, size, x, y, options = {}) => ({id, type, size, enabled: true, placed: true, monitor: null, x, y, options});

export default async function ({manager, store, shot, sleep, note, background, desktop}) {
    const GLib = imports.gi.GLib;
    const GdkPixbuf = imports.gi.GdkPixbuf;
    const out = GLib.getenv('LEDGE_OUT');
    const {colors} = await import(`file://${GLib.getenv('LEDGE_SCRIPT').replace('tools/headless/scripts/wallpaper.js', 'extension/lib/tokens.js')}`);
    void colors;
    store.widgets = [
        at('clock-1', 'clock', 'small', 24, 24), at('calendar-1', 'calendar', 'small', 200, 24),
        at('cpu-1', 'cpu', 'small', 376, 24), at('note-1', 'note', 'small', 552, 24, {text: 'Colours from the wallpaper'}),
        at('timer-1', 'timer', 'medium', 24, 200), at('battery-1', 'battery', 'small', 376, 200),
    ];
    store.style = 'wallpaper';
    await sleep(2500);
    const wallpaper = manager._wallpaper;
    const state = label => note(`${label}: seeds ${JSON.stringify(wallpaper.seeds)}, theme ${manager.theme}, ` +
        `tile class "${manager._desktop.style_class.split(' ')[0]}", loaded=${wallpaper._loadedInto !== null}`);
    state('plain colour #1d2433');

    // A picture: mostly a warm orange, with grey.
    const picture = `${out}/orange.png`;
    const pixbuf = GdkPixbuf.Pixbuf.new(GdkPixbuf.Colorspace.RGB, false, 8, 320, 200);
    pixbuf.fill(0x808080ff);
    pixbuf.new_subpixbuf(0, 0, 220, 200).fill(0xe8742cff);
    pixbuf.savev(picture, 'png', [], []);
    const green = `${out}/green.png`;
    const other = GdkPixbuf.Pixbuf.new(GdkPixbuf.Colorspace.RGB, false, 8, 320, 200);
    other.fill(0x1f8a4cff);
    other.savev(green, 'png', [], []);

    background.set_string('picture-options', 'zoom');
    background.set_string('picture-uri', `file://${picture}`);
    background.set_string('picture-uri-dark', `file://${green}`);
    await sleep(1500);
    state('orange for light, green for dark');
    await shot('wallpaper-dark');
    desktop.set_string('color-scheme', 'default'); await sleep(1200);
    state('light scheme');
    await shot('wallpaper-light');
    desktop.set_string('color-scheme', 'prefer-dark'); await sleep(900);

    // A wallpaper that changes through the day: orange for an hour from now on.
    const start = new Date(Date.now() - 60000);
    const pad = n => String(n).padStart(2, '0');
    const xml = `<background><starttime><year>${start.getFullYear()}</year><month>${pad(start.getMonth() + 1)}</month><day>${pad(start.getDate())}</day>` +
        `<hour>${pad(start.getHours())}</hour><minute>${pad(start.getMinutes())}</minute><second>${pad(start.getSeconds())}</second></starttime>` +
        `<static><duration>3600.0</duration><file>${picture}</file></static><static><duration>3600.0</duration><file>${green}</file></static></background>`;
    GLib.file_set_contents(`${out}/timed.xml`, xml);
    background.set_string('picture-uri-dark', `file://${out}/timed.xml`);
    await sleep(1500);
    state('timed wallpaper for dark');
    note(`reads again in ${wallpaper._until === null ? 'never' : Math.round((wallpaper._until - Date.now()) / 60000)} min, timer set=${wallpaper._next !== 0}`);

    background.set_string('picture-uri-dark', 'file:///nowhere/missing.png');
    await sleep(1500);
    state('a picture that is not there');

    store.style = 'violet'; await sleep(900);
    state('back to violet');
    background.set_string('picture-uri-dark', `file://${green}`); await sleep(1200);
    state('wallpaper changed while violet');
    background.set_string('picture-options', 'none');
    background.reset('picture-uri'); background.reset('picture-uri-dark');
}
