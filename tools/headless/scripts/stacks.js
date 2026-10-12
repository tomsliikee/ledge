// Stacks: lay one widget on another while arranging, turn the stack with
// the wheel and its dots, move it, and take a widget out again.
const at = (id, type, x, y, size = 'small') => ({id, type, size, enabled: true, placed: true, monitor: null, x, y, options: {}});

export default async function ({extension, manager, store, hub, shot, sleep, note, move, press, release, wheel}) {
    store.widgets = [
        at('clock-1', 'clock', 300, 200), at('cpu-1', 'cpu', 600, 200), at('calendar-1', 'calendar', 900, 200),
        at('system-1', 'system', 300, 500, 'medium'),
    ];
    await sleep(2500);
    const tile = id => manager.tiles.find(t => t.widget.id === id);
    const state = label => note(`${label}: tiles [${manager.tiles.map(t => t.widget.id).join(', ')}] stored ` +
        `[${store.widgets.map(w => `${w.id}${w.stack ? `:${w.stack}` : ''}${w.top ? '*' : ''}@${w.x},${w.y}`).join(' ')}]`);
    const drag = async (from, toX, toY) => {
        const [x, y] = [from.x + from.width / 2, from.y + 12];
        move(x, y); await sleep(200);
        press(); await sleep(100);
        for (let i = 1; i <= 8; i++) {
            move(x + (toX - x) * i / 8, y + (toY - y) * i / 8); await sleep(40);
        }
        await sleep(200);
    };

    // Not arranging: dropping on another widget only moves.
    manager.show(true); await sleep(800);
    let target = tile('clock-1');
    await drag(tile('cpu-1'), target.x + target.width / 2, target.y + 12);
    release(); await sleep(800);
    state('dropped on the clock without arranging');
    await drag(tile('cpu-1'), 680, 212);
    release(); await sleep(800);
    manager.hide(); await sleep(800);

    extension._edit.open(); await sleep(900);
    target = tile('clock-1');
    await drag(tile('cpu-1'), target.x + target.width / 2, target.y + 12);
    await shot('stacks-1-over');
    release(); await sleep(900);
    state('dropped on the clock while arranging');
    target = tile('cpu-1');
    await drag(tile('calendar-1'), target.x + target.width / 2, target.y + 12);
    release(); await sleep(900);
    state('calendar added');
    // A medium widget does not fit a small stack.
    target = tile('calendar-1');
    await drag(tile('system-1'), target.x + target.width / 2 + 88, target.y + 12);
    note(`performance held over the stack: would stack=${manager._drag.onto !== null}`);
    move(700, 700); await sleep(200);
    release(); await sleep(900);
    await shot('stacks-2-stacked');
    manager.hide(); await sleep(900);

    // Turn with the wheel, on the desktop.
    const scroll = async down => {
        wheel(down);
        await sleep(120);
        note(`  mid-turn tiles on stage: ${manager._desktop.get_children().filter(c => c.widget).map(c => c.widget.id).join(', ')}`);
        await sleep(600);
    };
    const top = manager.tiles.find(t => t.widget.stack);
    const seen = top.connect('captured-event', (_a, e) => { if (e.type() === imports.gi.Clutter.EventType.SCROLL) note(`  scroll seen: direction ${e.get_scroll_direction()}`); return false; });
    move(top.x + 80, top.y + 80); await sleep(300);
    await scroll(true);
    state('wheel down');
    await scroll(true);
    state('wheel down again');
    await scroll(false);
    state('wheel up');
    note(`sources running: [${[...hub._entries.entries()].filter(([, e]) => e.running).map(([k]) => k).join(', ')}]`);

    // A dot.
    const dots = manager.tiles.find(t => t.widget.stack)._dots.get_children();
    const [dx, dy] = dots[2].get_transformed_position();
    move(dx + 6, dy + 6); await sleep(300); press(); await sleep(80); release(); await sleep(900);
    state(`third dot of ${dots.length} clicked`);
    await shot('stacks-3-turned');

    // Move the stack, then take one out.
    const stack = manager.tiles.find(t => t.widget.stack);
    await drag(stack, 1200, 600); release(); await sleep(900);
    state('stack dragged away');
    extension._edit.open(); await sleep(900);
    extension._edit._select(manager.tiles.find(t => t.widget.stack).widget.id); await sleep(600);
    await shot('stacks-4-panel');
    const Stack = await import(`file://${extension.path}/lib/stack.js`);
    store.widgets = Stack.leave(store.widgets, 'cpu-1'); await sleep(900);
    state('cpu taken out');
    store.widgets = Stack.leave(store.widgets, 'clock-1'); await sleep(900);
    state('clock taken out');
}
