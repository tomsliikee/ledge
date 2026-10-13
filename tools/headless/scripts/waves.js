// What expressive motion adds to the widgets themselves: waves that travel
// for as long as they are seen, also on battery, and the way the charge
// goes; charts that move on, lines that come in one after the other, a
// picture that fades in and a widget that cheers. The battery, the calendar
// and the pictures are stood in for.
const at = (type, size, x, y, options = {}) => ({
    id: `${type}-${size}`, type, size, enabled: true, placed: true, monitor: null, x, y, options,
});

export default async function ({extension, manager, store, hub, shot, sleep, note}) {
    const GLib = imports.gi.GLib;
    const St = imports.gi.St;
    store.animations = true;
    store.livelyMotion = true;
    store.ambientMotion = true;
    store.expressive = true;
    store.widgets = [
        at('battery', 'small', 24, 24), at('battery', 'medium', 200, 24), at('disk', 'small', 552, 24),
        at('system', 'medium', 728, 24), at('photo', 'small', 1080, 24),
        at('cpu', 'medium', 24, 200), at('processes', 'medium', 376, 200),
        // A timer of a second and a half, to see it end.
        at('timer', 'medium', 728, 200, {minutes: 0.025}),
        at('events', 'medium', 24, 376),
    ];
    await sleep(3000);

    const power = extension._power;
    let reading = {present: true, percent: 64, state: 'discharging', remaining: 3 * 3600 * 1000};
    let unplugged = true;
    Object.defineProperty(power, 'onBattery', {get: () => unplugged, configurable: true});
    Object.defineProperty(power, 'battery', {get: () => reading, configurable: true});
    const say = async (next, plugged = false) => {
        reading = {...reading, ...next};
        unplugged = !plugged;
        power._changed();
        await sleep(1300);
    };
    const push = (key, value) => {
        const entry = hub._entries.get(key);
        entry.value = value;
        for (const callback of [...entry.subscribers])
            callback(value);
    };

    const tile = id => manager.tiles.find(t => t.widget.id === id);
    const mark = (id, name) => tile(id)._marks.find(m => m.constructor.name === name);
    const frames = () => manager.tiles.filter(t => t._frames).map(t => t.widget.id).join(', ');
    // How far a wave travelled in a third of a second, in wavelengths; back is negative.
    const travel = async wave => {
        const from = wave.phase;
        await sleep(300);
        return (((wave.phase - from + 1.5) % 1) - 0.5).toFixed(3);
    };
    const range = async (read, ms) => {
        let lowest = Infinity;
        let highest = -Infinity;
        for (let passed = 0; passed < ms; passed += 16) {
            const value = read();
            lowest = Math.min(lowest, value);
            highest = Math.max(highest, value);
            await sleep(16);
        }
        return `${lowest.toFixed(3)} to ${highest.toFixed(3)}`;
    };
    const labels = actor => {
        const found = [];
        const visit = child => {
            if (child instanceof St.Label)
                found.push(child);
            child.get_children().forEach(visit);
        };
        visit(actor);
        return found;
    };

    // --- the battery's wave ------------------------------------------------
    await say({});
    const line = () => mark('battery-medium', 'WavyProgress').wave;
    const ring = () => mark('battery-small', 'Ring').wave;
    note(`on battery, draining: frames [${frames()}]`);
    note(`  line travelled ${await travel(line())}, ring ${await travel(ring())}, disk ring ${await travel(mark('disk-small', 'Ring').wave)}`);
    const badge = mark('system-medium', 'ShapeBadge');
    const drift = badge?._drift;
    await sleep(1000);
    note(`  a shape turned by ${badge ? (badge._drift - drift).toFixed(4) : 'no badge'} in a second`);
    await shot('waves-1-draining');

    const content = tile('battery-medium')._view.actor;
    reading = {...reading, state: 'charging'};
    unplugged = false;
    power._changed();
    note(`plugged in: the content swelled ${await range(() => content.scale_x, 500)}, stir ${line()._stir.toFixed(2)}`);
    await sleep(900);
    note(`charging: line travelled ${await travel(line())}, ring ${await travel(ring())}`);

    await say({state: 'discharging', percent: 8});
    note(`at 8 %: the line stands ${await range(() => line().swell, 1500)} of its height`);
    await shot('waves-2-low');
    await say({percent: 60});
    reading = {...reading, percent: 59};
    power._changed();
    await sleep(60);
    const stirred = line()._stir;
    await sleep(1400);
    note(`one per cent less: stirred ${stirred.toFixed(2)}, then ${line()._stir.toFixed(2)}`);

    // --- a chart moves on ---------------------------------------------------
    const cpu = hub._entries.get('cpu').value;
    const history = Array.from({length: cpu.history.length > 1 ? cpu.history.length : 30}, (_, i) => 30 + 20 * Math.sin(i / 3));
    push('cpu', {...cpu, history});
    await sleep(100);
    push('cpu', {...cpu, history: [...history.slice(1), 80]});
    const spark = tile('cpu-medium')._view.actor.get_children().flatMap(child => [child, ...child.get_children()])
        .find(child => child.constructor.name === 'Spark');
    await sleep(50);
    const moving = spark?._shift;
    await shot('waves-3-chart-moving');
    await sleep(500);
    note(`chart: ${spark ? `${moving.toFixed(2)} of a step from its place 50 ms in, ${spark._shift.toFixed(2)} at rest` : 'no chart found'}`);

    // --- processes roll and count --------------------------------------------
    const key = [...hub._entries.keys()].find(name => name.startsWith('processes'));
    push(key, [{name: 'first', cpu: 40, memory: 1}, {name: 'second', cpu: 20, memory: 1}, {name: 'third', cpu: 10, memory: 1}]);
    await sleep(700);
    push(key, [{name: 'second', cpu: 60, memory: 1}, {name: 'first', cpu: 30, memory: 1}, {name: 'third', cpu: 10, memory: 1}]);
    await sleep(70);
    const rows = labels(tile('processes-medium')._view.actor).slice(2);
    note(`processes, 70 ms in: ${rows.map(label => `${label.text}@${label.opacity}`).join(' ')}`);
    await sleep(700);
    note(`processes, settled: ${rows.map(label => `${label.text}@${label.opacity}`).join(' ')}`);

    // --- entries come in one after the other ---------------------------------
    const hour = 3600 * 1000;
    const now = Date.now();
    const entry = (summary, from) => ({summary, start: now + from * hour, end: now + (from + 1) * hour});
    push('events', {available: true, events: [entry('Review', 1), entry('Dinner', 3)]});
    await sleep(700);
    push('events', {available: true, events: [entry('Review', 1), entry('Dinner', 3), entry('Concert', 5)]});
    await sleep(60);
    const list = () => tile('events-medium')._view.actor.get_children()[1].get_children();
    const state = () => list().map(child => `${child.opacity}/${child.translation_y.toFixed(1)}`).join(' ');
    note(`entries, 60 ms in: ${state()}`);
    await shot('waves-4-entries');
    await sleep(800);
    note(`entries, settled: ${state()}`);

    // --- a picture fades in ---------------------------------------------------
    const photos = [...hub._entries.keys()].find(name => name.startsWith('photo'));
    const out = GLib.getenv('LEDGE_OUT');
    const sheets = () => tile('photo-small')._view.actor.get_children()[0].get_children();
    push(photos, {path: `${out}/shots/waves-1-draining.png`});
    await sleep(1500);
    push(photos, {path: `${out}/shots/waves-2-low.png`});
    note(`picture: the one above went ${await range(() => sheets().at(-1).opacity, 700)}, has a picture: ${Boolean(sheets().at(-1).style)}`);
    await shot('waves-5-picture');

    // --- the timer ends --------------------------------------------------------
    const timer = tile('timer-medium');
    const buttons = [];
    const find = actor => {
        if (actor instanceof St.Button)
            buttons.push(actor);
        actor.get_children().forEach(find);
    };
    find(timer._view.actor);
    buttons[0].emit('clicked', 1);
    await sleep(300);
    note(`timer runs: ${labels(timer._view.actor)[1].text}, wave travelled ${await travel(mark('timer-medium', 'WavyProgress').wave)}`);
    note(`timer ends: the content swelled ${await range(() => timer._view.actor.scale_x, 2600)}, shows ${labels(timer._view.actor)[1].text}`);

    // --- and without expressive motion ------------------------------------------
    store.livelyMotion = false;
    await sleep(900);
    await say({percent: 58});
    note(`without expressive motion: frames [${frames()}], line stirred ${line()._stir.toFixed(2)}, travelled ${await travel(line())}`);
    push('events', {available: true, events: [entry('Review', 1)]});
    await sleep(60);
    note(`  entries at once: ${state()}`);
    await shot('waves-6-plain');

    // --- what the travelling waves cost, on battery ------------------------------
    const ticks = () => {
        const fields = new TextDecoder().decode(GLib.file_get_contents('/proc/self/stat')[1]).split(') ')[1].split(' ');
        return Number(fields[11]) + Number(fields[12]);
    };
    const measure = async (label, seconds) => {
        const before = ticks();
        await sleep(seconds * 1000);
        note(`cost ${label}: ${((ticks() - before) / seconds).toFixed(2)} % of one core over ${seconds} s, frames [${frames()}]`);
    };
    await measure('nine widgets, expressive motion off', 15);
    store.livelyMotion = true;
    await sleep(1500);
    await measure('nine widgets, expressive motion on', 15);
}
