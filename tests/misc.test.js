import {test, equal, done} from './harness.js';
import * as Calendar from '../extension/lib/calendar.js';
import * as Timer from '../extension/lib/timer.js';

test('october 2026 starts on a thursday and has five weeks', () => {
    const grid = Calendar.monthGrid(2026, 10);
    equal(grid[0], [null, null, null, 1, 2, 3, 4]);
    equal(grid.length, 5);
    equal(grid[4], [26, 27, 28, 29, 30, 31, null]);
});

test('february 2027 fills exactly four weeks', () => {
    equal(Calendar.monthGrid(2027, 2).length, 4);
});

test('weekday counts from monday', () => {
    equal(Calendar.weekday(new Date(2026, 9, 12)), 0);
    equal(Calendar.weekday(new Date(2026, 9, 18)), 6);
});

test('dates are checked against the calendar', () => {
    equal(Calendar.parseDate('2026-12-24'), [2026, 12, 24]);
    equal(Calendar.parseDate('2026-02-30'), null);
    equal(Calendar.parseDate('24.12.2026'), null);
});

test('a timer counts down while running and holds while paused', () => {
    let timer = Timer.create('timer', 60_000);
    timer = Timer.start(timer, 1000);
    equal(Timer.shown(timer, 11_000), 50_000);
    timer = Timer.pause(timer, 11_000);
    equal(Timer.shown(timer, 99_000), 50_000);
    timer = Timer.start(timer, 100_000);
    equal(Timer.shown(timer, 120_000), 30_000);
    equal(Timer.progress(timer, 120_000), 0.5);
});

test('a timer stops at zero and reports that it finished', () => {
    const timer = Timer.start(Timer.create('timer', 5000), 0);
    equal([Timer.shown(timer, 9000), Timer.isFinished(timer, 9000), Timer.isFinished(timer, 4000)], [0, true, false]);
});

test('a stopwatch counts up and never finishes', () => {
    const watch = Timer.start(Timer.create('stopwatch'), 0);
    equal([Timer.shown(watch, 7000), Timer.isFinished(watch, 7000), Timer.progress(watch, 7000)], [7000, false, 0]);
});

test('reset clears the time and stops', () => {
    const timer = Timer.reset(Timer.start(Timer.create('timer', 5000), 0));
    equal([Timer.isRunning(timer), Timer.shown(timer, 3000)], [false, 5000]);
});

done('misc');
