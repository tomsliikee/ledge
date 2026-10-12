import {test, equal, done} from './harness.js';
import {readLimits} from '../extension/lib/claude.js';

const NOW = 1_000_000;
const probe = JSON.stringify({at: 500, limits: {session: {percent: 20, resetsAt: NOW + 10}, week: {percent: 83, resetsAt: NOW + 99}}});
const statusline = (at, extra = {}) => JSON.stringify({at, rate_limits: {five_hour: {used_percentage: 42, resets_at: 2000}, ...extra}});

test('without Tally there are no limits', () => {
    equal(readLimits(null, null, NOW), null);
    equal(readLimits('broken', '{}', NOW), null);
});

test('the newer record wins', () => {
    equal(readLimits(probe, statusline(400), NOW).session.percent, 20);
    equal(readLimits(probe, statusline(600), NOW).session.percent, 42);
});

test('status line times are seconds', () => {
    equal(readLimits(null, statusline(600), NOW).session.resetsAt, 2_000_000);
});

test('a window the newer record leaves out is kept from the older one', () => {
    equal(readLimits(probe, statusline(600), NOW).week.percent, 83);
});

test('a window past its reset starts again at nothing', () => {
    equal(readLimits(probe, null, NOW + 50).session, {percent: 0, resetsAt: null});
    equal(readLimits(probe, null, NOW + 50).week.percent, 83);
});

done('claude');
