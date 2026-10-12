// Every widget in every size, in the dark and the light scheme and in both looks.

const GAP = 16;
const UNIT = 160;
const SIZES = {small: [UNIT, UNIT], medium: [2 * UNIT + GAP, UNIT], large: [2 * UNIT + GAP, 2 * UNIT + GAP]};

// Lays the widgets out in rows, left to right.
function pack(items, width) {
    let x = 24;
    let y = 24;
    let rowHeight = 0;
    return items.map(([type, size, options = {}], i) => {
        const [w, h] = SIZES[size];
        if (x + w > width - 24) {
            x = 24;
            y += rowHeight + GAP;
            rowHeight = 0;
        }
        const widget = {id: `${type}-${i}`, type, size, enabled: true, monitor: null, x, y, options};
        x += w + GAP;
        rowHeight = Math.max(rowHeight, h);
        return widget;
    });
}

const PAGES = {
    small: [
        ['clock', 'small'], ['clock', 'small', {face: 'digital'}], ['calendar', 'small'], ['weather', 'small'],
        ['cpu', 'small'], ['gpu', 'small'], ['memory', 'small'], ['temperature', 'small'], ['battery', 'small'],
        ['network', 'small'], ['disk', 'small'], ['media', 'small'], ['claude', 'small'], ['worldclock', 'small'],
        ['timer', 'small'], ['timer', 'small', {mode: 'stopwatch'}], ['note', 'small', {text: 'Call the plumber about the tap.'}],
        ['daylight', 'small'], ['countdown', 'small', {title: 'Holiday', date: '2026-12-24'}], ['photo', 'small'],
        ['countdown', 'small'], ['note', 'small'],
    ],
    medium: [
        ['clock', 'medium'], ['clock', 'medium', {face: 'digital'}], ['calendar', 'medium'], ['weather', 'medium'],
        ['system', 'medium'], ['cpu', 'medium'], ['gpu', 'medium'], ['memory', 'medium'],
        ['temperature', 'medium'], ['battery', 'medium'], ['network', 'medium'], ['disk', 'medium'],
        ['media', 'medium'], ['claude', 'medium'], ['worldclock', 'medium'], ['timer', 'medium'],
        ['daylight', 'medium'], ['processes', 'medium'], ['countdown', 'medium', {title: 'Holiday', date: '2026-12-24'}], ['photo', 'medium'],
    ],
    large: [
        ['clock', 'large'], ['clock', 'large', {face: 'digital'}], ['calendar', 'large'], ['weather', 'large'],
        ['system', 'large'], ['media', 'large'], ['worldclock', 'large'], ['processes', 'large', {by: 'memory'}],
    ],
    large2: [
        ['note', 'large', {text: 'Things for the weekend\n\nBread, coffee, lemons\nReturn the library books\nOil the bike chain'}],
        ['photo', 'large'], ['timer', 'medium', {mode: 'stopwatch'}], ['note', 'medium', {text: 'A wider note.'}],
    ],
};

export default async function ({manager, store, shot, sleep, desktop, background, note}) {
    store.place = {name: 'Vienna', region: 'Vienna, Austria', latitude: 48.208, longitude: 16.373, timezone: 'Europe/Vienna'};
    let first = true;
    const pictures = `${imports.gi.GLib.getenv('LEDGE_OUT')}/pictures`;
    for (const expressive of [true, false]) {
        store.expressive = expressive;
        for (const [scheme, colour] of [['prefer-dark', '#1d2433'], ['default', '#c9cbd6']]) {
            desktop.set_string('color-scheme', scheme);
            background.set_string('primary-color', colour);
            for (const [page, items] of Object.entries(PAGES)) {
                store.widgets = pack(items.map(([type, size, options]) =>
                    [type, size, type === 'photo' ? {folder: pictures} : options]), 1600);
                await sleep(first ? 9000 : 6500);
                first = false;
                await shot(`${expressive ? 'expressive' : 'calm'}-${scheme === 'default' ? 'light' : 'dark'}-${page}`);
            }
        }
    }
    note('gallery done');
}
