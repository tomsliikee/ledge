// A mixed desktop in the expressive look, dark and light, then the same in
// the calm one.
const SIZES = {small: [160, 160], medium: [336, 160], large: [336, 336]};

function at(column, row, type, size, options = {}) {
    return {id: `${type}-${column}-${row}`, type, size, enabled: true, monitor: null,
        x: 1600 - 24 - 176 * column - SIZES[size][0], y: 24 + 176 * row, options};
}

export default async function ({store, shot, sleep, desktop, background}) {
    const pictures = `${imports.gi.GLib.getenv('LEDGE_OUT')}/pictures`;
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
        at(4, 0, 'cpu', 'small'), at(5, 0, 'memory', 'small'), at(4, 1, 'disk', 'small'), at(5, 1, 'temperature', 'small'),
        at(4, 2, 'media', 'medium'), at(4, 3, 'calendar', 'large'),
    ];
    for (const expressive of [true, false]) {
        store.expressive = expressive;
        for (const dark of [true, false]) {
            desktop.set_string('color-scheme', dark ? 'prefer-dark' : 'default');
            background.set_string('color-shading-type', 'vertical');
            background.set_string('primary-color', dark ? '#1b2440' : '#cfd5ee');
            background.set_string('secondary-color', dark ? '#0f1322' : '#e9ebf6');
            await sleep(expressive && dark ? 9000 : 5000);
            await shot(`${expressive ? 'expressive' : 'calm'}-${dark ? 'dark' : 'light'}`);
        }
    }
}
