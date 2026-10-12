// A widget set to hide on battery leaves when the power is unplugged and
// returns with it. The battery itself is stood in for.
export default async function ({extension, manager, store, hub, sleep, note}) {
    store.widgets = [
        {id: 'clock-1', type: 'clock', size: 'small', enabled: true, monitor: null, x: 400, y: 300, options: {}},
        {id: 'cpu-1', type: 'cpu', size: 'small', enabled: true, monitor: null, x: 600, y: 300, options: {hideOnBattery: true}},
    ];
    await sleep(2500);
    const power = extension._power;
    let unplugged = false;
    Object.defineProperty(power, 'onBattery', {get: () => unplugged});
    const state = label => note(`${label}: tiles [${manager.tiles.map(t => t.widget.type).join(', ')}], ` +
        `cpu source running=${hub._entries.get('cpu')?.running ?? false}`);
    state('plugged in');
    unplugged = true; power._changed(); await sleep(600);
    state('on battery');
    unplugged = false; power._changed(); await sleep(600);
    state('plugged in again');
}
