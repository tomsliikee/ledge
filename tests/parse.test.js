import {test, equal, done} from './harness.js';
import * as Parse from '../extension/lib/parse.js';

const STAT = `cpu  100 0 50 800 50 0 0 0 0 0
cpu0 50 0 25 400 25 0 0 0 0 0
cpu1 50 0 25 400 25 0 0 0 0 0
intr 1`;

test('cpu sums the ticks and counts the cores', () => {
    equal(Parse.parseCpu(STAT), {idle: 850, total: 1000, cores: 2});
});

test('cpu usage is the share of ticks that were not idle', () => {
    equal(Parse.cpuPercent({idle: 850, total: 1000}, {idle: 900, total: 1200}), 75);
});

test('cpu usage needs two different readings', () => {
    equal(Parse.cpuPercent(null, {idle: 1, total: 2}), null);
    equal(Parse.cpuPercent({idle: 1, total: 2}, {idle: 1, total: 2}), null);
});

test('memory counts what is not available as used', () => {
    const memory = Parse.parseMemory('MemTotal:       16000 kB\nMemFree:  100 kB\nMemAvailable:    4000 kB\n');
    equal(memory, {total: 16000 * 1024, used: 12000 * 1024, percent: 75});
});

test('memory without its fields is null', () => {
    equal(Parse.parseMemory('nothing'), null);
});

const NET = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 500 5 0 0 0 0 0 0 500 5 0 0 0 0 0 0
wlp2s0: 1000 9 0 0 0 0 0 0 200 4 0 0 0 0 0 0
docker0: 70 1 0 0 0 0 0 0 70 1 0 0 0 0 0 0
enp0s1: 30 1 0 0 0 0 0 0 10 1 0 0 0 0 0 0`;

test('network leaves out loopback and bridges', () => {
    equal(Parse.parseNetwork(NET), {received: 1030, sent: 210});
});

test('network rate is bytes per second and never negative', () => {
    equal(Parse.networkRate({received: 0, sent: 100}, {received: 4000, sent: 50}, 2), {down: 2000, up: 0});
});

test('nvidia line gives usage, temperature and memory', () => {
    equal(Parse.parseNvidia('45, 61, 1024, 12282'),
        {percent: 45, temperature: 61, memoryUsed: 1024 * 1024 * 1024, memoryTotal: 12282 * 1024 * 1024});
});

test('nvidia line with a missing value is null', () => {
    equal(Parse.parseNvidia('[N/A], 61, 1024, 12282'), null);
    equal(Parse.parseNvidia(''), null);
});

test('gpu clock is placed between its lowest and highest frequency', () => {
    equal(Parse.clockPercent(700, 300, 1100), 50);
    equal(Parse.clockPercent(200, 300, 1100), 0);
    equal(Parse.clockPercent(700, 300, 300), null);
});

test('process name may hold spaces and brackets', () => {
    const fields = Array(50).fill('0');
    fields[11] = '30';
    fields[12] = '12';
    fields[21] = '2500';
    equal(Parse.parseProcess(`4242 (Web Content (x)) ${fields.join(' ')}`),
        {pid: 4242, name: 'Web Content (x)', ticks: 42, pages: 2500});
});

test('top processes are ranked by what they used between two readings', () => {
    const previous = new Map([[1, {name: 'a', ticks: 100, pages: 10}], [2, {name: 'b', ticks: 0, pages: 500}]]);
    const next = new Map([[1, {name: 'a', ticks: 150, pages: 10}], [2, {name: 'b', ticks: 10, pages: 500}],
        [3, {name: 'new', ticks: 999, pages: 1}]]);
    const options = {count: 2, pageSize: 4096, cores: 4};
    equal(Parse.topProcesses(previous, next, 400, {...options, by: 'cpu'}).map(p => [p.name, p.cpu]),
        [['a', 50], ['b', 10]]);
    equal(Parse.topProcesses(previous, next, 400, {...options, by: 'memory'}).map(p => p.name), ['b', 'a']);
});

test('a reused pid does not inherit the old ticks', () => {
    const previous = new Map([[1, {name: 'old', ticks: 100, pages: 1}]]);
    const next = new Map([[1, {name: 'fresh', ticks: 300, pages: 1}]]);
    equal(Parse.topProcesses(previous, next, 400, {by: 'cpu', count: 1, pageSize: 1, cores: 1})[0].cpu, 0);
});

test('hwmon reports millidegrees', () => {
    equal(Parse.milliCelsius('54500\n'), 54.5);
    equal(Parse.milliCelsius(''), null);
});

done('parse');
