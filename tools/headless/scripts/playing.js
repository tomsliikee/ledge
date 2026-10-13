// The media widget with expressive motion: a wave that travels while
// something plays and lies flat while it is paused. The test shell has no
// player, so its readings are stood in for.
const at = (id, size, x, y) => ({id, type: 'media', size, enabled: true, placed: true, monitor: null, x, y, options: {}});

export default async function ({manager, store, hub, shot, sleep, note}) {
    store.animations = true;
    store.livelyMotion = true;
    store.ambientMotion = false;
    store.expressive = true;
    store.widgets = [at('media-1', 'small', 24, 24), at('media-2', 'medium', 200, 24), at('media-3', 'large', 552, 24)];
    await sleep(2500);
    const say = playing => {
        const entry = hub._entries.get('media');
        entry.value = {name: 'player', playing, title: 'Night Drive', artist: 'The Examples', art: null, canNext: true, canPrevious: true};
        for (const callback of [...entry.subscribers])
            callback(entry.value);
    };
    const waves = () => manager.tiles.flatMap(tile => tile._marks).filter(mark => mark.constructor.name === 'WavyProgress');
    const frames = () => manager.tiles.filter(tile => tile._frames).map(tile => tile.widget.id).join(', ');

    say(true); await sleep(900);
    const phase = waves()[0].wave.phase;
    await sleep(500);
    note(`playing: ${waves().length} waves, frames [${frames()}], swell ${waves()[0].wave.swell.toFixed(2)}, ` +
        `moved ${((waves()[0].wave.phase - phase + 1) % 1).toFixed(2)} of a wavelength`);
    await shot('playing-1');
    say(false); await sleep(1200);
    note(`paused: frames [${frames()}], swell ${waves()[0].wave.swell.toFixed(2)}`);
    await shot('playing-2-paused');

    store.livelyMotion = false; await sleep(900);
    say(true); await sleep(600);
    note(`without expressive motion: ${waves().length} waves, frames [${frames()}]`);
    await shot('playing-3-plain');
    store.livelyMotion = true; store.ambientMotion = true;
    await sleep(400);
}
