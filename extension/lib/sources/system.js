// Load of the machine: processor, memory, temperature, network and the
// processes that use most of it.
//
// /proc and /sys are read synchronously on purpose: they are answered from
// kernel memory in microseconds, less than handing the read to a thread costs.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Parse from '../parse.js';
import {history, polled} from '../hub.js';

const INTERVAL = 2;
const HISTORY = 40;
const decoder = new TextDecoder();

export function readText(path) {
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        return ok ? decoder.decode(bytes) : null;
    } catch {
        return null;
    }
}

export function cpu(_parameter, env) {
    let previous = null;
    const record = history(HISTORY);
    return polled(INTERVAL, () => {
        const next = Parse.parseCpu(readText('/proc/stat') ?? '');
        const percent = Parse.cpuPercent(previous, next);
        previous = next;
        // The first reading has nothing to compare with.
        if (percent === null)
            return undefined;
        return {percent, cores: next.cores, history: record(percent)};
    }, env);
}

export function memory(_parameter, env) {
    const record = history(HISTORY);
    return polled(INTERVAL, () => {
        const reading = Parse.parseMemory(readText('/proc/meminfo') ?? '');
        return reading ? {...reading, history: record(reading.percent)} : undefined;
    }, env);
}

// The processor's own sensor under its usual driver names, then the
// mainboard's as a last resort.
const SENSORS = ['coretemp', 'k10temp', 'zenpower', 'cpu_thermal', 'acpitz'];

function findSensor() {
    const found = new Map();
    for (let i = 0; i < 32; i++) {
        const name = readText(`/sys/class/hwmon/hwmon${i}/name`)?.trim();
        if (name && !found.has(name))
            found.set(name, `/sys/class/hwmon/hwmon${i}/temp1_input`);
    }
    const name = SENSORS.find(sensor => found.has(sensor));
    return name ? found.get(name) : null;
}

export function temperature(_parameter, env) {
    let sensor;
    const record = history(HISTORY);
    return polled(INTERVAL, () => {
        if (sensor === undefined)
            sensor = findSensor();
        const celsius = sensor ? Parse.milliCelsius(readText(sensor) ?? '') : null;
        return {celsius, history: celsius === null ? [] : record(celsius)};
    }, env);
}

export function network(_parameter, env) {
    let previous = null;
    let previousAt = 0;
    const record = history(HISTORY);
    return polled(INTERVAL, () => {
        const next = Parse.parseNetwork(readText('/proc/net/dev') ?? '');
        const now = GLib.get_monotonic_time() / 1e6;
        const rate = Parse.networkRate(previous, next, now - previousAt);
        previous = next;
        previousAt = now;
        return rate ? {...rate, history: record(rate.down)} : undefined;
    }, env);
}

const PROCESS_INTERVAL = 5;

// Ranking the processes means reading a file for each of them, some tens
// of milliseconds in all: too long to do inside the shell, which draws the
// screen on the same thread. A helper process does it and prints a line of
// JSON per interval. parameter: "cpu" or "memory".
export function processes(parameter, env) {
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
            try {
                emit(JSON.parse(line));
            } catch {
                // A line cut short when the helper was stopped.
            }
            readLines(stream, emit);
        });
    }

    return {
        start(emit) {
            cancellable = new Gio.Cancellable();
            try {
                process = Gio.Subprocess.new([
                    'gjs', '-m', env.helperPath('processes.js'),
                    parameter === 'memory' ? 'memory' : 'cpu',
                    String(Math.round(PROCESS_INTERVAL * env.pace())),
                ], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
            } catch (e) {
                console.debug(`Ledge: process helper not started: ${e.message}`);
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
