// The starting layout on the desktop, then held over the windows.
export default async function ({manager, store, shot, sleep, note}) {
    note(`widgets: ${JSON.stringify(store.widgets.map(w => [w.id, w.size, w.monitor, w.x, w.y]))}`);
    await sleep(3000);
    await shot('01-desktop');
    manager.show(true);
    await sleep(800);
    await shot('02-pinned');
    manager.hide();
    await sleep(600);
    await shot('03-after');
}
