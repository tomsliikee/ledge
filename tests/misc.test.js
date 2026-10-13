import {test, equal, done} from './harness.js';
import {movedOn} from '../extension/lib/hub.js';
import * as Calendar from '../extension/lib/calendar.js';
import {shownWidgets} from '../extension/lib/visibility.js';
import * as Pomodoro from '../extension/lib/pomodoro.js';
import * as Tasks from '../extension/lib/tasks.js';
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

test('a widget set to hide on battery steps aside only there', () => {
    const widgets = [
        {id: 'a', enabled: true, options: {}},
        {id: 'b', enabled: true, options: {hideOnBattery: true}},
        {id: 'c', enabled: false, options: {}},
    ];
    equal(shownWidgets(widgets, {onBattery: false}).map(w => w.id), ['a', 'b']);
    equal(shownWidgets(widgets, {onBattery: true}).map(w => w.id), ['a']);
});

const MIN = 60_000;
const config = {work: 25 * MIN, rest: 5 * MIN, long: 15 * MIN, rounds: 2};

test('work is followed by a break, and the last of a set by the long one', () => {
    const first = Pomodoro.create(config);
    const rest = Pomodoro.following(first, config);
    equal([rest.phase, rest.round, rest.timer.duration], ['rest', 1, 5 * MIN]);
    const second = Pomodoro.following(rest, config);
    equal([second.phase, second.round], ['work', 2]);
    const long = Pomodoro.following(second, config);
    equal([long.phase, long.timer.duration], ['long', 15 * MIN]);
    equal(Pomodoro.following(long, config).round, 1);
});

test('a phase that ended starts the next at that moment', () => {
    const running = Pomodoro.start(Pomodoro.create(config), 0);
    equal(Pomodoro.settle(running, 24 * MIN, config).ended, 0);
    const {state, ended} = Pomodoro.settle(running, 27 * MIN, config);
    equal([ended, state.phase, Timer.shown(state.timer, 27 * MIN)], [1, 'rest', 3 * MIN]);
});

test('an hour unwatched passes through several phases', () => {
    const {state, ended} = Pomodoro.settle(Pomodoro.start(Pomodoro.create(config), 0), 62 * MIN, config);
    // 25 work, 5 rest, 25 work, then seven minutes into the long break.
    equal([ended, state.phase, state.round, Timer.shown(state.timer, 62 * MIN)], [3, 'long', 2, 8 * MIN]);
});

test('a paused phase never ends', () => {
    const paused = Pomodoro.pause(Pomodoro.start(Pomodoro.create(config), 0), 10 * MIN);
    equal(Pomodoro.settle(paused, 500 * MIN, config), {state: paused, ended: 0});
});

test('tasks are added trimmed, ticked off and cleared', () => {
    let items = Tasks.add(Tasks.add([], '  Bread '), 'Coffee');
    equal(Tasks.add(items, '   '), items);
    items = Tasks.toggle(items, 0);
    equal(items, [{text: 'Bread', done: true}, {text: 'Coffee', done: false}]);
    equal(Tasks.ordered(items).map(item => [item.text, item.index]), [['Coffee', 1], ['Bread', 0]]);
    equal(Tasks.openCount(items), 1);
    equal(Tasks.clearDone(items), [{text: 'Coffee', done: false}]);
});

test('a damaged list of tasks is read as far as it makes sense', () => {
    equal(Tasks.parse('x'), []);
    equal(Tasks.parse([{text: 'A'}, null, {text: ''}, {done: true}]), [{text: 'A', done: false}]);
});

test('a history has moved on when the oldest left and one reading came', () => {
    equal(movedOn([1, 2, 3], [2, 3, 9]), true);
    equal(movedOn([1, 2, 3], [1, 2, 3]), false);
    equal(movedOn([1, 2], [1, 2, 3]), false);
    equal(movedOn([], []), false);
    equal(movedOn([5, 5, 5], [5, 5, 5]), true);
});

done('misc');
