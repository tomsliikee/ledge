// The controls over the held widgets: "Edit widgets", then "Done".
export default async function ({extension, manager, store, sleep, note, move, press, release, shot}) {
    const Clutter = imports.gi.Clutter;
    await sleep(2500);
    manager.show(true);
    await sleep(900);
    const pill = manager.overlay._edit;
    const [x, y] = pill.get_transformed_position();
    const picked = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x + pill.width / 2, y + pill.height / 2);
    note(`pill at ${x},${y} ${pill.width}x${pill.height}; actor there: ${picked?.constructor.name} ${picked?.style_class ?? ''}`);
    move(x + pill.width / 2, y + pill.height / 2); await sleep(300);
    press(); await sleep(100); release(); await sleep(900);
    note(`after clicking the pill: edit active=${extension._edit.active}, overlay shown=${manager.overlay.shown}`);
    await shot('pill-1');
    const done = extension._edit._content.get_first_child().get_last_child();
    const click = async actor => {
        const [ax, ay] = actor.get_transformed_position();
        move(ax + actor.width / 2, ay + actor.height / 2); await sleep(300);
        press(); await sleep(100); release(); await sleep(900);
    };
    // A switch in the panel: the CPU widget, fourth row of the list.
    const before = store.widgets.some(w => w.type === 'cpu' && w.enabled);
    const list = extension._edit._content.get_children().find(c => c.style_class === 'lg-group' && c.get_n_children() > 10);
    const toggle = list.get_child_at_index(3).get_last_child().get_last_child();
    await click(toggle);
    note(`cpu switch clicked: ${before} -> ${store.widgets.some(w => w.type === 'cpu' && w.enabled)}; edit still active=${extension._edit.active}`);
    // A press on the panel's own surface must not close anything.
    move(40, 400); await sleep(200); press(); await sleep(100); release(); await sleep(600);
    note(`after a press on the panel: overlay shown=${manager.overlay.shown}`);
    await click(extension._edit._content.get_first_child().get_last_child());
    note(`after clicking Done: edit active=${extension._edit.active}, overlay shown=${manager.overlay.shown}`);

    // A button inside a held widget: start the timer.
    store.widgets = [{id: 'timer-1', type: 'timer', size: 'small', enabled: true, monitor: null, x: 400, y: 300, options: {}}];
    await sleep(800);
    manager.show(true); await sleep(900);
    const tile = manager.tiles[0];
    const at = [tile.x, tile.y];
    move(tile.x + 36, tile.y + 123); await sleep(300);
    press(); await sleep(100); release(); await sleep(1500);
    await shot('pill-2-timer');
    note(`timer play pressed: tile moved=${tile.x !== at[0] || tile.y !== at[1]}, overlay shown=${manager.overlay.shown}`);
    // And the same on the bare desktop.
    manager.hide(); await sleep(800);
    move(tile.x + 36, tile.y + 123); await sleep(300);
    press(); await sleep(100); release(); await sleep(1200);
    await shot('pill-3-timer-desktop');
}
