// Expressive motion: the sheet swings in on a spring, rings fill and numbers
// count as it arrives, shapes turn while nothing happens, and all of it
// stays away when the steps are switched off.
const at = (column, row, type, size, rest = {}) => ({
    id: `${type}-${column}-${row}`, type, size, enabled: true, monitor: 0,
    x: 24 + column * 176, y: 24 + row * 176, placed: true, options: {}, ...rest,
});

export default async function ({manager, store, shot, sleep, note, move, press, release, wheel, Main}) {
    const Gio = imports.gi.Gio;
    const GLib = imports.gi.GLib;
    store.animations = true;
    store.livelyMotion = true;
    store.ambientMotion = true;
    store.expressive = true;
    store.place = {name: 'Vienna', region: 'Vienna, Austria', latitude: 48.208, longitude: 16.373, timezone: 'Europe/Vienna'};
    store.widgets = [
        at(0, 0, 'clock', 'small'), at(1, 0, 'calendar', 'small'), at(2, 0, 'weather', 'medium'),
        at(0, 1, 'system', 'medium'), at(2, 1, 'disk', 'small'), at(3, 1, 'timer', 'medium'),
        at(4, 0, 'cpu', 'small', {stack: 'stack-1', top: true}), at(4, 0, 'memory', 'small', {stack: 'stack-1'}),
        at(5, 0, 'memory', 'small'), at(0, 2, 'daylight', 'medium'), at(2, 2, 'tasks', 'medium', {options: {items: [
            {text: 'Water the plants', done: false}, {text: 'Call the dentist', done: false}, {text: 'Buy bread', done: false},
        ]}}),
        at(5, 1, 'pomodoro', 'small'), at(4, 2, 'clock', 'medium', {options: {face: 'digital'}}),
    ];
    const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.NONE});
    launcher.setenv('WAYLAND_DISPLAY', 'ledge-test', true);
    launcher.setenv('GDK_BACKEND', 'wayland', true);
    const here = GLib.path_get_dirname(GLib.getenv('LEDGE_SCRIPT'));
    const window = launcher.spawnv(['gjs', '-m', `${here}/../window.js`]);
    // What moves on its own rests on battery; the test stands on mains.
    Object.defineProperty(manager._power, 'onBattery', {get: () => false, configurable: true});
    manager._setMotion();
    await sleep(5000);

    const tile = type => manager.tiles.find(t => t.widget.type === type);
    const marks = t => t._marks.map(mark => mark.constructor.name).join(',');
    const sample = async (label, ms, every = 16) => {
        let highest = 0;
        let lowest = 9;
        for (let passed = 0; passed < ms; passed += every) {
            await sleep(every);
            for (const t of manager.tiles) {
                highest = Math.max(highest, t.scale_x);
                lowest = Math.min(lowest, t.scale_x);
            }
        }
        note(`${label}: scale between ${lowest.toFixed(3)} and ${highest.toFixed(3)}`);
    };

    // --- arriving -----------------------------------------------------
    const arrive = async name => {
        manager.show(true);
        await sleep(70);
        const disk = tile('disk')._marks.find(mark => mark.constructor.name === 'Ring');
        note(`${name}, 70 ms in: tile ${tile('disk').opacity}/${tile('disk').scale_x.toFixed(3)}, ` +
            `disk ring at ${disk?._percent?.toFixed(1)} of ${disk?._glide.target?.toFixed(1)}`);
        await sample(`${name}, arriving`, 700);
        await shot(`motion-${name}-2-arrived`);
        const rest = manager.tiles.map(t => `${t.opacity}/${t.scale_x.toFixed(3)}/${t.translation_y.toFixed(1)}`);
        note(`${name}, at rest: ${[...new Set(rest)].join(' ')}`);
    };
    await arrive('lively');
    note(`marks: system [${marks(tile('system'))}] timer [${marks(tile('timer'))}] daylight [${marks(tile('daylight'))}]`);

    // --- always moving ------------------------------------------------
    const moving = () => manager.tiles.filter(t => t._frames).map(t => t.widget.type).join(', ');
    note(`given frames while idle: ${moving()}`);
    const badge = tile('system')._marks.find(mark => mark.constructor.name === 'ShapeBadge');
    const drift = badge?._drift;
    await sleep(1000);
    note(`a shape turned on in one second: ${badge ? (badge._drift - drift).toFixed(4) : 'no badge'} of a turn`);
    store.ambientMotion = false; await sleep(600);
    note(`given frames with "Always moving" off: [${moving()}]`);

    // --- the timer's wave travels while it runs ------------------------
    const timer = tile('timer');
    const start = timer.get_children()[0];
    const buttons = [];
    const find = actor => {
        if (actor.constructor.name === 'St_Button' || actor instanceof imports.gi.St.Button)
            buttons.push(actor);
        actor.get_children().forEach(find);
    };
    find(timer);
    const click = async actor => {
        const [x, y] = actor.get_transformed_position();
        move(x + actor.width / 2, y + actor.height / 2); await sleep(150);
        press(); await sleep(60);
        note(`  pressed: button scale ${actor.scale_x.toFixed(3)}`);
        release(); await sleep(500);
    };
    await click(buttons[0]);
    const wave = tile('timer')._marks.find(mark => mark.constructor.name === 'WavyProgress');
    const phase = wave._phase;
    await sleep(700);
    note(`timer running: frames [${moving()}], wave moved by ${((wave._phase - phase + 1) % 1).toFixed(3)} of a wavelength`);
    await shot('motion-timer-running');
    await click(buttons[0]);
    note(`timer paused: frames [${moving()}]`);

    // --- a press on a tile, and the pointer over it ---------------------
    const memory = manager.tiles.find(t => t.widget.id === 'memory-5-0');
    move(memory.x + 20, memory.y + 12); await sleep(400);
    note(`under the pointer: rises by ${memory.translation_y.toFixed(1)}`);
    store.openApps = false;
    press(); await sleep(160);
    note(`pressed: tile scale ${memory.scale_x.toFixed(3)}`);
    release(); await sample('let go', 450);
    move(900, 900); await sleep(400);
    note(`pointer gone: ${memory.translation_y.toFixed(1)}`);

    // --- a stack turned --------------------------------------------------
    const cpu = tile('cpu');
    move(cpu.x + 40, cpu.y + 40); await sleep(200);
    wheel(1); await sleep(120);
    await shot('motion-stack-turning');
    await sleep(600);
    const top = manager.tiles.find(t => t.widget.stack);
    const pill = top._dots.get_children().map(dot => dot.child.height);
    note(`stack shows ${top.widget.type}; dots are ${pill.join(', ')} high`);
    await shot('motion-stack-turned');

    // --- a task ticked off -----------------------------------------------
    const tasks = tile('tasks');
    const lines = [];
    const findLines = actor => {
        if (actor.style_class === 'lg-task')
            lines.push(actor);
        actor.get_children().forEach(findLines);
    };
    findLines(tasks);
    const [lx, ly] = lines[0].get_transformed_position();
    move(lx + 30, ly + lines[0].height / 2); await sleep(150);
    press(); await sleep(40); release(); await sleep(50);
    lines.length = 0;
    findLines(tile('tasks'));
    note(`ticked off: lines travel from ${lines.map(line => line.translation_y.toFixed(0)).join(', ')}`);
    await shot('motion-task-travelling');
    await sleep(600);
    note(`settled: ${lines.map(line => line.translation_y.toFixed(0)).join(', ')}; stored ${JSON.stringify(store.widgets.find(w => w.type === 'tasks').options.items.map(i => i.done))}`);
    await shot('motion-task-done');

    // --- the same without expressive motion ------------------------------
    manager.hide(); await sleep(700);
    store.livelyMotion = false; await sleep(800);
    await arrive('plain');
    note(`plain: frames [${moving()}], stack dots ${manager.tiles.find(t => t.widget.stack)._dots.get_children().map(dot => dot.child.height).join(', ')}`);
    manager.hide(); await sleep(700);

    // --- and with no motion at all ---------------------------------------
    store.animations = false; await sleep(800);
    await arrive('still');
    manager.hide(); await sleep(400);
    store.animations = true; store.livelyMotion = true; store.ambientMotion = true;
    await sleep(500);
    window.force_exit();
}
