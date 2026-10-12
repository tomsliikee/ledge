// The README picture of the widgets of the second round. The calendar and
// the brightness are stood in for: the test shell has neither.
const at = (id, type, size, x, y, options = {}, rest = {}) =>
    ({id, type, size, enabled: true, placed: true, monitor: null, x, y, options, ...rest});

export default async function ({store, hub, shot, sleep, note, desktop, background, Main}) {
    const now = new Date();
    const day = (offset, hour, minute = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute);
    const entries = [
        {summary: 'Review with the design team', date: new Date(now.getTime() - 20 * 60000), end: new Date(now.getTime() + 40 * 60000)},
        {summary: 'National holiday', date: day(1, 0), end: day(2, 0)},
        {summary: 'Dentist', date: day(1, 9, 30), end: day(1, 10)},
        {summary: 'Train to Salzburg', date: day(3, 7, 12), end: day(3, 9, 40)},
        {summary: 'Concert', date: day(3, 20), end: day(3, 22)},
    ];
    const dateMenu = Main.panel.statusArea.dateMenu;
    const real = dateMenu._eventSource;
    dateMenu._eventSource = {
        hasCalendars: true, getEvents: (begin, end) => entries.filter(e => e.end > begin && e.date < end),
        connect: () => 1, disconnect: () => {},
    };
    const level = {value: 0.7, connect: () => 1, disconnect: () => {}};
    // On the object itself: the manager clears its own field whenever it
    // looks for screens and finds none that can be dimmed.
    Object.defineProperty(Main.brightnessManager, 'globalScale', {get: () => level, configurable: true});

    store.style = 'blue';
    store.expressive = true;
    store.translucent = false;
    desktop.set_string('color-scheme', 'prefer-dark');
    background.set_string('picture-options', 'none');
    background.set_string('primary-color', '#1d2433');
    store.place = {name: 'Vienna', region: 'Vienna, Austria', latitude: 48.208, longitude: 16.373, timezone: 'Europe/Vienna'};
    const items = [{text: 'Bread and coffee', done: false}, {text: 'Return the library books', done: false},
        {text: 'Book the train', done: false}, {text: 'Call the plumber', done: true}];
    store.widgets = [
        at('events-1', 'events', 'large', 24, 24),
        at('tasks-1', 'tasks', 'large', 376, 24, {items}),
        at('pomodoro-1', 'pomodoro', 'medium', 728, 24),
        at('air-1', 'air', 'medium', 728, 200),
        at('brightness-1', 'brightness', 'medium', 1080, 24),
        // A stack of three, the clock on top.
        at('cpu-1', 'cpu', 'small', 1080, 200, {}, {stack: 'stack-1'}),
        at('calendar-1', 'calendar', 'small', 1080, 200, {}, {stack: 'stack-1'}),
        at('clock-1', 'clock', 'small', 1080, 200, {}, {stack: 'stack-1', top: true}),
        at('pomodoro-2', 'pomodoro', 'small', 1256, 200),
    ];
    // The layout may be the one of the last run, with its sources running
    // since the shell started: they have to see what stands in.
    hub.restart('events');
    hub.restart('brightness');
    await sleep(7000);
    note(`place ${JSON.stringify(store.place)}; air ${JSON.stringify(hub._entries.get('air')?.value)}`);
    await shot('readme-more');
    dateMenu._eventSource = real;
    delete Main.brightnessManager.globalScale;
}
