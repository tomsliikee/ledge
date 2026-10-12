import {test, equal, done} from './harness.js';
import * as Format from '../extension/lib/format.js';

test('a missing value is a dash', () => {
    equal([Format.percent(null), Format.celsius(undefined), Format.bytes(null), Format.rate(NaN)], ['–', '–', '–', '–']);
});

test('units are set off with a space', () => {
    equal([Format.percent(63.6), Format.celsius(54.4), Format.degrees(-3.2)], ['64 %', '54 °C', '-3°']);
});

test('bytes step up at 1024', () => {
    equal([Format.bytes(512), Format.bytes(1536), Format.bytes(12.4 * 1024 ** 3), Format.bytes(212 * 1024 ** 3)],
        ['512 B', '1.5 KB', '12.4 GB', '212 GB']);
});

test('a value just under the next unit does not print as 1024', () => {
    equal(Format.bytes(1024 * 1024 - 1), '1.0 MB');
});

test('rate carries its unit per second', () => {
    equal([Format.rate(0), Format.rate(2.5 * 1024 * 1024)], ['0 B/s', '2.5 MB/s']);
});

test('duration rounds up to the minute', () => {
    equal([Format.duration(1), Format.duration(90 * 60 * 1000), Format.duration(26 * 3600 * 1000), Format.duration(0)],
        ['1 min', '1 h 30 min', '1 d 2 h', '0 min']);
});

test('stopwatch shows hours only when there are some', () => {
    equal([Format.stopwatch(0), Format.stopwatch(245 * 1000), Format.stopwatch(3845 * 1000)], ['0:00', '4:05', '1:04:05']);
});

test('clock in both formats', () => {
    equal([Format.clock(9, 5), Format.clock(0, 30, true), Format.clock(15, 7, true)], ['09:05', '12:30', '3:07']);
});

test('a time in a sentence carries am or pm on a twelve-hour clock', () => {
    equal([Format.time(18, 11), Format.time(18, 11, true), Format.time(0, 5, true)], ['18:11', '6:11 pm', '12:05 am']);
});

test('days between calendar days ignore the time of day', () => {
    equal(Format.daysBetween([2026, 10, 12], [2026, 12, 24]), 73);
    equal(Format.daysBetween([2026, 10, 12], [2026, 10, 11]), -1);
});

test('days left in words', () => {
    equal([Format.daysLeft(0), Format.daysLeft(1), Format.daysLeft(12), Format.daysLeft(-3)],
        ['Today', 'Tomorrow', 'in 12 days', '3 days ago']);
});

test('tone warns from 75 and alarms from 90', () => {
    equal([Format.tone(74), Format.tone(75), Format.tone(90), Format.tone(null)], ['primary', 'warn', 'bad', 'primary']);
});

done('format');
