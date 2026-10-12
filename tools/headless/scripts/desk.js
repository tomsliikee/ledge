// Tasks and Pomodoro: both sizes, both looks, dark and light, and a task
// ticked off and a round started with the pointer.
const at = (id, type, size, x, y, options = {}) => ({id, type, size, enabled: true, placed: true, monitor: null, x, y, options});
const ITEMS = [{text: 'Bread and coffee', done: false}, {text: 'Return the library books', done: false},
    {text: 'Call the plumber', done: true}, {text: 'Water the plants', done: false}, {text: 'Book the train', done: false}];

export default async function ({manager, store, shot, sleep, note, move, press, release, desktop}) {
    store.widgets = [
        at('tasks-1', 'tasks', 'medium', 24, 24, {items: ITEMS}), at('tasks-2', 'tasks', 'large', 376, 24, {items: ITEMS}),
        at('tasks-3', 'tasks', 'medium', 24, 200),
        at('pomodoro-1', 'pomodoro', 'small', 728, 24), at('pomodoro-2', 'pomodoro', 'medium', 904, 24),
    ];
    await sleep(2500);
    for (const expressive of [true, false]) {
        store.expressive = expressive;
        for (const dark of [true, false]) {
            desktop.set_string('color-scheme', dark ? 'prefer-dark' : 'default');
            await sleep(900);
            await shot(`desk-${expressive ? 'expressive' : 'calm'}-${dark ? 'dark' : 'light'}`);
        }
    }
    store.expressive = true;
    desktop.set_string('color-scheme', 'prefer-dark');
    await sleep(900);

    const click = async (x, y) => {
        move(x, y); await sleep(250); press(); await sleep(80); release(); await sleep(700);
    };
    const tile = id => manager.tiles.find(t => t.widget.id === id);
    const items = id => store.widgets.find(w => w.id === id).options.items.map(i => `${i.done ? 'x' : '-'}${i.text}`).join(' | ');
    manager.show(true); await sleep(900);
    // The first line of the large list.
    const list = tile('tasks-2');
    await click(list.x + 80, list.y + 67);
    note(`first task clicked: ${items('tasks-2')}`);
    note(`tile kept (no rebuild): ${tile('tasks-2') === list}`);
    // Type into the field of the empty list.
    const empty = tile('tasks-3');
    const field = empty.get_first_child().get_last_child();
    field.grab_key_focus();
    field.text = 'Buy lemons';
    field.clutter_text.emit('activate');
    await sleep(500);
    note(`task written: ${items('tasks-3')}; field cleared=${field.text === ''}; has focus=${global.stage.key_focus === field.clutter_text}`);

    const small = tile('pomodoro-1');
    await click(small.x + 56, small.y + 118);
    await sleep(2200);
    await shot('desk-running');
    note(`pomodoro started by its button: shows "${small.get_first_child().get_first_child().get_last_child().text}"`);
    manager.hide(); await sleep(700);
}
