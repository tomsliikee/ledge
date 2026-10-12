import {test, equal, done} from './harness.js';
import {describeOffset, zoneTime} from '../extension/lib/zones.js';

// 12 October 2026, 21:30 UTC: summer time in Vienna (+2) and New York (−4).
const MOMENT = new Date(Date.UTC(2026, 9, 12, 21, 30));
const VIENNA = 120;

test('a zone to the east is ahead and may already be tomorrow', () => {
    equal(zoneTime(MOMENT, 'Asia/Tokyo', VIENNA), {hours: 6, minutes: 30, ahead: 7, dayOffset: 1});
});

test('a zone to the west is behind', () => {
    equal(zoneTime(MOMENT, 'America/New_York', VIENNA), {hours: 17, minutes: 30, ahead: -6, dayOffset: 0});
});

test('half-hour zones keep their half', () => {
    equal(zoneTime(MOMENT, 'Asia/Kolkata', VIENNA).ahead, 3.5);
});

test('an unknown zone is null', () => {
    equal(zoneTime(MOMENT, 'Nowhere/Nothing', VIENNA), null);
});

test('the offset in words', () => {
    equal(describeOffset({ahead: 7, dayOffset: 1}), 'Tomorrow, +7 h');
    equal(describeOffset({ahead: -6, dayOffset: 0}), '−6 h');
    equal(describeOffset({ahead: 3.5, dayOffset: 0}), '+3.5 h');
    equal(describeOffset({ahead: 0, dayOffset: 0}), 'Same time');
});

done('zones');
