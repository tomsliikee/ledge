// The arranging mode: open it, select a widget, change things, drag one.
export default async function ({extension, manager, store, shot, sleep, note, move, press, release, desktop, background}) {
    store.place = {name: 'Vienna', region: 'Vienna, Austria', latitude: 48.208, longitude: 16.373, timezone: 'Europe/Vienna'};
    await sleep(2500);
    extension._edit.open();
    await sleep(900);
    await shot('edit-1-open');

    // Click the clock: press and release without moving selects it.
    const clock = manager.tiles.find(tile => tile.widget.type === 'clock');
    move(clock.x + 80, clock.y + 80); await sleep(200);
    press(); await sleep(100); release(); await sleep(700);
    await shot('edit-2-selected');
    note(`selected: ${extension._edit._selected}`);

    store.updateWidget(clock.widget.id, w => ({...w, size: 'medium', options: {face: 'digital'}}));
    await sleep(700);

    // Drag the calendar towards the middle; it should rest on the grid.
    const calendar = manager.tiles.find(tile => tile.widget.type === 'calendar');
    const before = [calendar.x, calendar.y];
    move(calendar.x + 80, calendar.y + 80); await sleep(150);
    press(); await sleep(150);
    for (let step = 1; step <= 10; step++) {
        move(calendar.x + 80 - 41, calendar.y + 80 + 13); await sleep(40);
    }
    await shot('edit-3-dragging');
    release(); await sleep(800);
    const stored = store.widgets.find(w => w.type === 'calendar');
    note(`calendar moved from ${before} to ${[calendar.x, calendar.y]}, stored ${stored.x},${stored.y} on ${stored.monitor}`);

    extension._edit._toggle('battery', true);
    extension._edit._toggle('timer', true);
    extension._edit._toggle('worldclock', true);
    await sleep(900);
    note(`after adding: ${JSON.stringify(store.widgets.map(w => [w.id, w.x, w.y, w.placed]))}`);
    store.style = 'green';
    store.translucent = true;
    await sleep(900);
    await shot('edit-4-green-translucent');

    desktop.set_string('color-scheme', 'default');
    background.set_string('primary-color', '#c9cbd6');
    store.style = 'blue';
    store.translucent = false;
    extension._edit._select(store.widgets.find(w => w.type === 'worldclock').id);
    await sleep(900);
    await shot('edit-5-light-worldclock');

    manager.hide();
    await sleep(700);
    await shot('edit-6-closed');
    note(`edit active after hide: ${extension._edit.active}, overlay shown: ${manager.overlay.shown}`);
}
