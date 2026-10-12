// The Air widget with a real answer for Vienna, both sizes and looks.
const at = (id, size, x) => ({id, type: 'air', size, enabled: true, placed: true, monitor: null, x, y: 24, options: {}});

export default async function ({store, hub, shot, sleep, note, desktop}) {
    store.widgets = [at('air-1', 'small', 24), at('air-2', 'medium', 200)];
    await sleep(2000);
    await shot('air-no-place');
    store.place = {name: 'Vienna', region: 'Vienna, Austria', latitude: 48.208, longitude: 16.373, timezone: 'Europe/Vienna'};
    await sleep(5000);
    note(`reading: ${JSON.stringify(hub._entries.get('air')?.value)}`);
    for (const expressive of [true, false]) {
        store.expressive = expressive;
        for (const dark of [true, false]) {
            desktop.set_string('color-scheme', dark ? 'prefer-dark' : 'default');
            await sleep(900);
            await shot(`air-${expressive ? 'expressive' : 'calm'}-${dark ? 'dark' : 'light'}`);
        }
    }
}
