// The graphics card. NVIDIA and AMD report how busy they are; Intel does
// not without extra rights, so there the clock frequency stands in.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Parse from '../parse.js';
import {history, polled} from '../hub.js';
import {readText} from './system.js';

const INTERVAL = 2;
const HISTORY = 40;
const CARDS = 4;

function findCard(file) {
    for (let i = 0; i < CARDS; i++) {
        const path = `/sys/class/drm/card${i}/${file}`;
        if (GLib.file_test(path, GLib.FileTest.EXISTS))
            return `/sys/class/drm/card${i}`;
    }
    return null;
}

// One nvidia-smi that keeps running and prints a line per interval; starting
// it anew every two seconds would cost far more than the reading is worth.
function nvidia(program, env) {
    const record = history(HISTORY);
    let process = null;
    let cancellable = null;

    function readLines(stream, emit) {
        stream.read_line_async(GLib.PRIORITY_LOW, cancellable, (source, result) => {
            let line;
            try {
                [line] = source.read_line_finish_utf8(result);
            } catch {
                return;
            }
            if (line === null)
                return;
            const reading = Parse.parseNvidia(line);
            if (reading)
                emit({kind: 'usage', ...reading, history: record(reading.percent)});
            readLines(stream, emit);
        });
    }

    return {
        start(emit) {
            cancellable = new Gio.Cancellable();
            try {
                process = Gio.Subprocess.new([
                    program,
                    '--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total',
                    '--format=csv,noheader,nounits',
                    '-l', String(Math.round(INTERVAL * env.pace())),
                ], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
            } catch {
                emit({kind: 'none'});
                return;
            }
            readLines(new Gio.DataInputStream({base_stream: process.get_stdout_pipe()}), emit);
        },
        stop() {
            cancellable?.cancel();
            process?.force_exit();
            process = null;
        },
    };
}

export function gpu(_parameter, env) {
    const program = GLib.find_program_in_path('nvidia-smi');
    if (program)
        return nvidia(program, env);

    const record = history(HISTORY);
    const busy = findCard('device/gpu_busy_percent');
    const clocked = findCard('gt_cur_freq_mhz');
    return polled(INTERVAL, () => {
        if (busy) {
            const percent = Number.parseInt(readText(`${busy}/device/gpu_busy_percent`) ?? '', 10);
            return Number.isFinite(percent) ? {kind: 'usage', percent, history: record(percent)} : {kind: 'none'};
        }
        if (clocked) {
            const read = file => Number.parseInt(readText(`${clocked}/${file}`) ?? '', 10);
            const mhz = read('gt_cur_freq_mhz');
            const percent = Parse.clockPercent(mhz, read('gt_min_freq_mhz'), read('gt_max_freq_mhz'));
            return percent === null ? {kind: 'none'} : {kind: 'clock', percent, mhz, history: record(percent)};
        }
        return {kind: 'none'};
    }, env);
}
