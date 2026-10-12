import GLib from 'gi://GLib';

import {test, equal, done} from './harness.js';
import {parseHex, rolesFor, seedOf} from '../extension/lib/scheme.js';
import {parseSlideshow, slideAt} from '../extension/lib/slideshow.js';
import {Hct} from '../extension/lib/vendor/material-color-utilities/hct/hct.js';

const here = GLib.path_get_dirname(import.meta.url.replace('file://', ''));
const read = file => JSON.parse(new TextDecoder().decode(GLib.file_get_contents(`${here}/../${file}`)[1]));
const shipped = read('tools/styles.json');
const seeds = Object.fromEntries(read('toms-expressive-design/tokens.json').color.tokens
    .filter(token => token.name.startsWith('seed-')).map(token => [token.name.slice(5), token.value]));

// The styles in tools/styles.json were derived with the Dart edition of the
// library; the edition in the extension must give the very same colours.
for (const style of ['violet', 'green', 'orange', 'pink']) {
    test(`the ${style} seed gives the ${style} style that ships`, () => {
        equal(rolesFor(seeds[style]), shipped[style]);
    });
}

function picture(width, height, colourAt) {
    const bytes = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++)
            bytes.set(colourAt(x, y), (y * width + x) * 3);
    }
    return [bytes, {width, height, channels: 3, rowstride: width * 3}];
}
const hue = hex => Math.round(Hct.fromInt(parseHex(hex)).hue);

test('a picture of one colour gives that colour\'s hue', () => {
    const seed = seedOf(...picture(16, 16, () => [0x2e, 0x9e, 0x4f]));
    equal(Math.abs(hue(seed) - hue('#2e9e4f')) <= 2, true);
});

test('a colour beats the grey around it', () => {
    // Three quarters grey, one quarter orange.
    const seed = seedOf(...picture(16, 16, x => x < 12 ? [0x80, 0x80, 0x80] : [0xf2, 0x6b, 0x3a]));
    equal(Math.abs(hue(seed) - hue('#f26b3a')) <= 4, true);
});

test('rows wider than their pixels and see-through pixels are passed over', () => {
    const bytes = new Uint8Array([
        0x2e, 0x9e, 0x4f, 255, 255, 0, 0, 0, 9, 9, 9, 9,
        0x2e, 0x9e, 0x4f, 255, 255, 0, 0, 0, 9, 9, 9, 9,
    ]);
    const seed = seedOf(bytes, {width: 2, height: 2, channels: 4, rowstride: 12});
    equal(Math.abs(hue(seed) - hue('#2e9e4f')) <= 2, true);
    equal(seedOf(new Uint8Array([1, 2, 3, 0]), {width: 1, height: 1, channels: 4, rowstride: 4}), null);
});

test('only a colour written as #rrggbb is one', () => {
    equal(parseHex('#ff0000'), 0xffff0000);
    equal([parseHex('red'), parseHex(''), parseHex(null)], [null, null, null]);
});

const timed = `<background>
  <starttime><year>2026</year><month>01</month><day>01</day><hour>00</hour><minute>00</minute><second>00</second></starttime>
  <!-- night, five hours -->
  <static><duration>18000.0</duration><file>/w/night.jpg</file></static>
  <transition type="overlay"><duration>1800.0</duration><from>/w/night.jpg</from><to>/w/dawn.jpg</to></transition>
  <static><duration>66600.0</duration><file><size width="1920" height="1080">/w/day.jpg</size></file></static>
</background>`;
// In the same winter as the start: the round runs on seconds passed, as
// GNOME's does, so across a change of the clocks it is an hour off the wall.
const clock = (hour, minute = 0) => new Date(2026, 0, 12, hour, minute).getTime();

test('a wallpaper that changes through the day is read', () => {
    const show = parseSlideshow(timed);
    equal(show.slides, [{duration: 18_000_000, file: '/w/night.jpg'}, {duration: 1_800_000, file: '/w/dawn.jpg'}, {duration: 66_600_000, file: '/w/day.jpg'}]);
    equal(show.start, new Date(2026, 0, 1).getTime());
    equal(parseSlideshow('<background></background>'), null);
});

test('the picture of the hour, and when the next one comes', () => {
    const show = parseSlideshow(timed);
    equal(slideAt(show, clock(3)), {file: '/w/night.jpg', until: clock(5)});
    // While one picture fades into the next, the next one counts.
    equal(slideAt(show, clock(5, 10)), {file: '/w/dawn.jpg', until: clock(5, 30)});
    equal(slideAt(show, clock(21)).file, '/w/day.jpg');
    equal(slideAt(show, clock(21)).until, clock(24));
});

done('scheme');
