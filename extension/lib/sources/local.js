// Readings from this machine that are not load: disks, the battery, the
// limits Tally recorded, and the pictures of a folder.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {readLimits} from '../claude.js';
import {polled} from '../hub.js';
import {readText} from './system.js';

Gio._promisify(Gio.File.prototype, 'query_filesystem_info_async');
Gio._promisify(Gio.File.prototype, 'enumerate_children_async');
Gio._promisify(Gio.FileEnumerator.prototype, 'next_files_async');

const DISK_INTERVAL = 60;
const FILESYSTEM = 'filesystem::size,filesystem::free';

async function usage(name, path) {
    const info = await Gio.File.new_for_path(path).query_filesystem_info_async(FILESYSTEM, GLib.PRIORITY_LOW, null);
    const total = info.get_attribute_uint64('filesystem::size');
    const free = info.get_attribute_uint64('filesystem::free');
    return total > 0 ? {name, total, free, used: total - free, percent: 100 * (total - free) / total} : null;
}

export function disk(_parameter, env) {
    const volumes = Gio.VolumeMonitor.get();
    return polled(DISK_INTERVAL, async () => {
        const places = [['System', '/'], ['Home', GLib.get_home_dir()]];
        for (const mount of volumes.get_mounts()) {
            const path = mount.get_root().get_path();
            if (path)
                places.push([mount.get_name(), path]);
        }
        const disks = [];
        for (const [name, path] of places) {
            try {
                const disk = await usage(name, path);
                // Home on the same file system as the system is one disk, not two.
                if (disk && !disks.some(d => d.total === disk.total && d.free === disk.free))
                    disks.push(disk);
            } catch {
                // A mount that vanished between listing and asking is skipped.
            }
        }
        return disks;
    }, env);
}

export function battery(_parameter, env) {
    let stopListening = null;
    return {
        start(emit) {
            const report = () => {
                const reading = env.power.battery;
                if (reading)
                    emit(reading);
            };
            stopListening = env.power.listen(report);
            report();
        },
        stop() {
            stopListening?.();
            stopListening = null;
        },
    };
}

export function claude() {
    const directory = GLib.build_filenamev([GLib.get_user_cache_dir(), 'tally']);
    const files = ['limits.json', 'statusline.json'].map(name => GLib.build_filenamev([directory, name]));
    let monitors = [];
    return {
        start(emit) {
            const report = () => emit(readLimits(readText(files[0]), readText(files[1]), Date.now()));
            monitors = files.map(path => {
                const monitor = Gio.File.new_for_path(path).monitor_file(Gio.FileMonitorFlags.NONE, null);
                const id = monitor.connect('changed', (_m, _file, _other, event) => {
                    if (event === Gio.FileMonitorEvent.CHANGES_DONE_HINT || event === Gio.FileMonitorEvent.CREATED)
                        report();
                });
                return {monitor, id};
            });
            report();
        },
        stop() {
            for (const {monitor, id} of monitors) {
                monitor.disconnect(id);
                monitor.cancel();
            }
            monitors = [];
        },
    };
}

const PHOTO_INTERVAL = 3600;
const PICTURE = /\.(jpe?g|png|webp)$/i;
const BATCH = 200;

async function listPictures(folder) {
    const directory = Gio.File.new_for_path(folder);
    const enumerator = await directory.enumerate_children_async(
        'standard::name', Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_LOW, null);
    const names = [];
    for (;;) {
        const infos = await enumerator.next_files_async(BATCH, GLib.PRIORITY_LOW, null);
        if (infos.length === 0)
            break;
        names.push(...infos.map(info => info.get_name()).filter(name => PICTURE.test(name)));
    }
    return names.sort().map(name => GLib.build_filenamev([folder, name]));
}

// parameter: the folder. Shows a different picture every hour, in an order
// that does not repeat until all were shown.
export function photo(parameter, env) {
    return polled(PHOTO_INTERVAL, async () => {
        const folder = parameter || GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES);
        if (!folder)
            return {path: null};
        try {
            const pictures = await listPictures(folder);
            if (pictures.length === 0)
                return {path: null};
            const hour = Math.floor(Date.now() / (PHOTO_INTERVAL * 1000));
            return {path: pictures[hour % pictures.length]};
        } catch {
            return {path: null};
        }
    }, env);
}
