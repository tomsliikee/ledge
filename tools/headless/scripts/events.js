// "Up next" with a calendar stood in for: the test shell has no accounts.
const at = (id, size, x, y) => ({id, type: 'events', size, enabled: true, placed: true, monitor: null, x, y, options: {}});

export default async function ({store, hub, shot, sleep, note, desktop, Main}) {
    const real = Main.panel.statusArea.dateMenu._eventSource;
    note(`the shell's source: ${real?.constructor.name}, getEvents=${typeof real?.getEvents}, hasCalendars=${real?.hasCalendars}`);
    store.widgets = [at('events-1', 'medium', 24, 24), at('events-2', 'large', 376, 24)];
    await sleep(2500);
    note(`with the real source: ${JSON.stringify(hub._entries.get('events')?.value)}`);
    await shot('events-none');

    const now = new Date();
    const day = (offset, hour, minute = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute);
    const entries = [
        {summary: 'Review with the design team', date: new Date(now.getTime() - 20 * 60000), end: new Date(now.getTime() + 40 * 60000)},
        {summary: 'Dinner at the lake', date: new Date(now.getTime() + 90 * 60000), end: new Date(now.getTime() + 180 * 60000)},
        {summary: 'National holiday', date: day(1, 0), end: day(2, 0)},
        {summary: 'Dentist', date: day(1, 9, 30), end: day(1, 10)},
        {summary: 'Train to Salzburg', date: day(3, 7, 12), end: day(3, 9, 40)},
        {summary: 'Concert', date: day(3, 20), end: day(3, 22)},
        {summary: 'Too far', date: day(9, 20), end: day(9, 22)},
    ];
    const handlers = new Map();
    const fake = {
        hasCalendars: true,
        getEvents: (begin, end) => entries.filter(e => e.end > begin && e.date < end),
        connect: (_signal, handler) => { handlers.set(1, handler); return 1; },
        disconnect: id => handlers.delete(id),
    };
    Main.panel.statusArea.dateMenu._eventSource = fake;
    hub.restart('events');
    await sleep(800);
    for (const expressive of [true, false]) {
        store.expressive = expressive;
        for (const dark of [true, false]) {
            desktop.set_string('color-scheme', dark ? 'prefer-dark' : 'default');
            await sleep(900);
            await shot(`events-${expressive ? 'expressive' : 'calm'}-${dark ? 'dark' : 'light'}`);
        }
    }
    entries.unshift({summary: 'Added just now', date: new Date(now.getTime() + 30 * 60000), end: new Date(now.getTime() + 60 * 60000)});
    handlers.get(1)();
    await sleep(500);
    note(`after the calendar changed: ${hub._entries.get('events').value.events.length} entries, first "${hub._entries.get('events').value.events[0].summary}"`);
    store.widgets = [];
    await sleep(500);
    note(`listening after the widgets left: ${handlers.size}`);
    Main.panel.statusArea.dateMenu._eventSource = real;
}
