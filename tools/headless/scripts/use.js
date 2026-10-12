// The shortcut that holds the widgets, and the click that opens an app.
export default async function ({extension, manager, store, sleep, note, move, press, release}) {
    const Clutter = imports.gi.Clutter;
    const GLib = imports.gi.GLib;
    const Shell = imports.gi.Shell;
    const seat = Clutter.get_default_backend().get_default_seat();
    const keyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
    const key = (keyval, down) => keyboard.notify_keyval(GLib.get_monotonic_time(), keyval,
        down ? Clutter.KeyState.PRESSED : Clutter.KeyState.RELEASED);
    const chord = async () => {
        key(Clutter.KEY_Super_L, true); await sleep(60);
        key(Clutter.KEY_w, true); await sleep(60);
        key(Clutter.KEY_w, false); await sleep(60);
        key(Clutter.KEY_Super_L, false); await sleep(700);
    };
    store.widgets = [
        {id: 'calendar-1', type: 'calendar', size: 'small', enabled: true, monitor: null, x: 400, y: 300, options: {}},
        {id: 'note-1', type: 'note', size: 'small', enabled: true, monitor: null, x: 600, y: 300, options: {}},
    ];
    await sleep(2500);
    note(`shortcut is ${store.shortcut}`);
    await chord();
    note(`after the shortcut: shown=${manager.overlay.shown} pinned=${manager.overlay.pinned}`);
    await chord();
    note(`after it again: shown=${manager.overlay.shown} pinned=${manager.overlay.pinned}`);
    store.shortcut = null; await sleep(300);
    await chord();
    note(`with no shortcut set: shown=${manager.overlay.shown}`);
    store.resetShortcut(); await sleep(300);

    const calendar = Shell.AppSystem.get_default().lookup_app('org.gnome.Calendar.desktop');
    const running = () => calendar.get_state() !== Shell.AppState.STOPPED;
    const click = async tile => {
        move(tile.x + 20, tile.y + 20); await sleep(300);
        press(); await sleep(100); release(); await sleep(1500);
    };
    const tile = type => manager.tiles.find(t => t.widget.type === type);
    store.openApps = false; await sleep(200);
    await click(tile('calendar'));
    note(`click with opening off: calendar running=${running()}`);
    store.openApps = true; await sleep(200);
    await click(tile('note'));
    note(`click on a note (opens nothing): calendar running=${running()}`);
    extension._edit.open(); await sleep(900);
    await click(tile('calendar'));
    note(`click while arranging: calendar running=${running()}, selected=${extension._edit._selected}`);
    manager.hide(); await sleep(900);
    manager.show(true); await sleep(900);
    await click(tile('calendar'));
    note(`click on the held calendar: calendar running=${running()}, overlay shown=${manager.overlay.shown}`);
    calendar.request_quit();
    await sleep(500);
}
