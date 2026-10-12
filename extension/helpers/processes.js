// Prints the processes that use the most processor time or memory, one
// line of JSON per interval, until it is stopped. Run by the shell as its
// own process; see lib/sources/system.js for why.
//
//   gjs -m processes.js <cpu|memory> <seconds>

import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';
import {programArgs} from 'system';

import * as Parse from '../lib/parse.js';

const COUNT = 6;
const PAGE_SIZE = 4096;
// The first list comes after a moment, not after a whole interval.
const FIRST_GAP_MS = 800;

const [by = 'cpu', seconds = '5'] = programArgs;
const decoder = new TextDecoder();
// print() holds lines back when its output is a pipe; the shell waits for each.
const output = new Gio.DataOutputStream({base_stream: new GioUnix.OutputStream({fd: 1, close_fd: false})});

function readText(path) {
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        return ok ? decoder.decode(bytes) : '';
    } catch {
        // A process that ended between listing and reading.
        return '';
    }
}

function readProcesses() {
    const processes = new Map();
    const directory = GLib.Dir.open('/proc', 0);
    for (let name = directory.read_name(); name !== null; name = directory.read_name()) {
        if (!/^\d+$/.test(name))
            continue;
        const process = Parse.parseProcess(readText(`/proc/${name}/stat`));
        if (process)
            processes.set(process.pid, process);
    }
    directory.close();
    return processes;
}

let previous = readProcesses();
let previousCpu = Parse.parseCpu(readText('/proc/stat'));

function report() {
    const next = readProcesses();
    const nextCpu = Parse.parseCpu(readText('/proc/stat'));
    if (previousCpu && nextCpu) {
        const rows = Parse.topProcesses(previous, next, nextCpu.total - previousCpu.total, {
            by: by === 'memory' ? 'memory' : 'cpu',
            count: COUNT,
            pageSize: PAGE_SIZE,
            cores: nextCpu.cores,
        });
        output.put_string(`${JSON.stringify(rows)}\n`, null);
        output.flush(null);
    }
    previous = next;
    previousCpu = nextCpu;
}

const loop = new GLib.MainLoop(null, false);
GLib.timeout_add(GLib.PRIORITY_DEFAULT, FIRST_GAP_MS, () => {
    report();
    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, Math.max(1, Number(seconds) || 5), () => {
        report();
        return GLib.SOURCE_CONTINUE;
    });
    return GLib.SOURCE_REMOVE;
});
loop.run();
