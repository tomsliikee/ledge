// Volume and brightness: both sizes and looks, and the slider dragged and
// turned. The test shell has no screen to dim, so brightness is stood in for.
const at = (id, type, size, x, y) => ({id, type, size, enabled: true, placed: true, monitor: null, x, y, options: {}});

export default async function ({manager, store, hub, shot, sleep, note, move, press, release, wheel, desktop, Main}) {
    const value = {level: 0.6};
    const listeners = new Map();
    const scale = {
        get value() { return value.level; },
        set value(v) { value.level = v; for (const l of listeners.values()) l(); },
        connect: (_s, handler) => { listeners.set(1, handler); return 1; },
        disconnect: id => listeners.delete(id),
    };
    const real = Main.brightnessManager;
    note(`real brightness scale: ${real?.globalScale ? 'present' : 'none'}`);
    real._globalScale = scale;

    store.widgets = [
        at('volume-1', 'volume', 'small', 24, 24), at('volume-2', 'volume', 'medium', 200, 24),
        at('brightness-1', 'brightness', 'small', 552, 24), at('brightness-2', 'brightness', 'medium', 728, 24),
    ];
    await sleep(2500);
    note(`volume reading: ${JSON.stringify(hub._entries.get('volume')?.value)}`);
    note(`brightness reading: ${JSON.stringify(hub._entries.get('brightness')?.value)}`);
    note(`tiles visible: ${manager.tiles.map(t => `${t.widget.id}=${t.visible}`).join(' ')}`);
    for (const expressive of [true, false]) {
        store.expressive = expressive;
        for (const dark of [true, false]) {
            desktop.set_string('color-scheme', dark ? 'prefer-dark' : 'default');
            await sleep(900);
            await shot(`levels-${expressive ? 'expressive' : 'calm'}-${dark ? 'dark' : 'light'}`);
        }
    }
    // Drag the brightness slider of the medium tile to a quarter, on the desktop.
    const tile = manager.tiles.find(t => t.widget.id === 'brightness-2');
    const before = [tile.x, tile.y];
    const y = tile.y + 16 + 28 + 12 + 22;
    move(tile.x + 180, y); await sleep(200); press(); await sleep(80);
    for (let i = 1; i <= 6; i++) {
        move(tile.x + 180 - i * 15, y); await sleep(40);
    }
    release(); await sleep(400);
    note(`brightness dragged: level ${value.level.toFixed(2)}, tile moved=${tile.x !== before[0] || tile.y !== before[1]}`);
    wheel(false); await sleep(300);
    note(`wheel up: level ${value.level.toFixed(2)}`);
    manager.show(true); await sleep(800);
    move(tile.x + 300, y); await sleep(200); press(); await sleep(80); release(); await sleep(400);
    note(`pressed near the end while held: level ${value.level.toFixed(2)}, still held=${manager.overlay.pinned}`);
    manager.hide(); await sleep(600);
    real._globalScale = null;
}
