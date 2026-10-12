// Pictures cut to the size of the place they fill, kept as small files in
// the cache. A photo straight from a camera would otherwise sit in video
// memory at full size.

import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import {newSession} from '../lib/sources/weather.js';

Gio._promisify(Gio.File.prototype, 'read_async');
Gio._promisify(Gio.File.prototype, 'enumerate_children_async');
Gio._promisify(Gio.FileEnumerator.prototype, 'next_files_async');
Gio._promisify(GdkPixbuf.Pixbuf, 'new_from_stream_at_scale_async', 'new_from_stream_finish');

const DIRECTORY = GLib.build_filenamev([GLib.get_user_cache_dir(), 'ledge', 'thumbs']);
// Drawn at twice the size, so the picture stays sharp on a scaled display.
const DENSITY = 2;

let session = null;

function fetch(url) {
    session ??= newSession();
    return new Promise((resolve, reject) => {
        const message = Soup.Message.new('GET', url);
        session.send_async(message, GLib.PRIORITY_LOW, null, (_session, result) => {
            try {
                resolve(session.send_finish(result));
            } catch (e) {
                reject(e);
            }
        });
    });
}

async function open(source) {
    if (/^https?:/.test(source))
        return fetch(source);
    const file = source.startsWith('file:') ? Gio.File.new_for_uri(source) : Gio.File.new_for_path(source);
    return file.read_async(GLib.PRIORITY_LOW, null);
}

async function removeOthers(slot, keep) {
    const directory = Gio.File.new_for_path(DIRECTORY);
    const enumerator = await directory.enumerate_children_async(
        'standard::name', Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_LOW, null);
    for (;;) {
        const infos = await enumerator.next_files_async(50, GLib.PRIORITY_LOW, null);
        if (infos.length === 0)
            break;
        for (const info of infos) {
            const name = info.get_name();
            if (name.startsWith(`${slot}-`) && name !== keep)
                directory.get_child(name).delete_async(GLib.PRIORITY_LOW, null, null);
        }
    }
}

// slot names the place the picture is for; its previous picture is removed.
// Returns the path of a PNG that covers width × height, or null.
export async function loadThumb({slot, source, width, height}) {
    if (!source)
        return null;
    const name = `${slot}-${GLib.compute_checksum_for_string(GLib.ChecksumType.MD5, `${source}|${width}|${height}`, -1)}.png`;
    const path = GLib.build_filenamev([DIRECTORY, name]);
    if (GLib.file_test(path, GLib.FileTest.EXISTS))
        return path;
    try {
        GLib.mkdir_with_parents(DIRECTORY, 0o700);
        const w = width * DENSITY;
        const h = height * DENSITY;
        // Loaded with room to spare, so the shorter side still covers after
        // a camera's rotation has been applied.
        const bound = 2 * Math.max(w, h);
        const stream = await open(source);
        const loaded = (await GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(stream, bound, bound, true, null))
            .apply_embedded_orientation();
        stream.close(null);
        const scale = Math.max(w / loaded.get_width(), h / loaded.get_height());
        const scaledWidth = Math.max(w, Math.round(loaded.get_width() * scale));
        const scaledHeight = Math.max(h, Math.round(loaded.get_height() * scale));
        const scaled = loaded.scale_simple(scaledWidth, scaledHeight, GdkPixbuf.InterpType.BILINEAR);
        const cut = scaled.new_subpixbuf(Math.floor((scaledWidth - w) / 2), Math.floor((scaledHeight - h) / 2), w, h);
        cut.savev(path, 'png', [], []);
        removeOthers(slot, name).catch(() => {});
        return path;
    } catch (e) {
        console.debug(`Ledge: picture not loaded: ${e.message}`);
        return null;
    }
}

export function disposeThumbs() {
    session?.abort();
    session = null;
}
