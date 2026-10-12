import {test, equal, done} from './harness.js';
import {dayName, upcoming} from '../extension/lib/agenda.js';

const at = (day, hour = 0, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
// Monday 12 October 2026, 10:00.
const now = at(12, 10);
const brief = list => list.map(e => `${e.day}${e.allDay ? 'A' : ''}${e.running ? 'R' : ''} ${e.summary}`);

test('entries come by day, whole days first, then by time', () => {
    const events = [
        {summary: 'Dentist', start: at(13, 9), end: at(13, 10)},
        {summary: 'Lunch', start: at(12, 12), end: at(12, 13)},
        {summary: 'Holiday', start: at(13), end: at(14)},
        {summary: 'Stand-up', start: at(12, 9, 30), end: at(12, 10, 30)},
    ];
    equal(brief(upcoming(events, now)), ['0R Stand-up', '0 Lunch', '1A Holiday', '1 Dentist']);
});

test('what is over and what lies beyond the week is left out', () => {
    const events = [
        {summary: 'Over', start: at(12, 8), end: at(12, 9)},
        {summary: 'Ends now', start: at(12, 9), end: now},
        {summary: 'Sunday', start: at(18, 20), end: at(18, 21)},
        {summary: 'Next Monday', start: at(19, 8), end: at(19, 9)},
    ];
    equal(brief(upcoming(events, now)), ['6 Sunday']);
});

test('an entry of several days that began before counts as today, and is all day', () => {
    equal(brief(upcoming([{summary: 'Fair', start: at(10), end: at(15)}], now)), ['0AR Fair']);
});

test('an entry without a title still shows', () => {
    equal(upcoming([{summary: '', start: at(12, 11), end: at(12, 12)}], now)[0].summary, 'Untitled');
});

test('days are named', () => {
    equal([dayName(0, now), dayName(1, now), dayName(2, now), dayName(6, now)], ['Today', 'Tomorrow', 'Wednesday', 'Sunday']);
});

done('agenda');
