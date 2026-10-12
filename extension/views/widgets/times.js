// Widgets about time other than the clock: other cities, a timer, a
// countdown to a day.

import GLib from 'gi://GLib';

import {MONTHS, parseDate} from '../../lib/calendar.js';
import * as Format from '../../lib/format.js';
import * as Pomodoro from '../../lib/pomodoro.js';
import * as Timer from '../../lib/timer.js';
import {describeOffset, zoneTime} from '../../lib/zones.js';
import {CENTER, START, badge, column, gauge, hint, iconButton, row, spacer} from '../parts.js';
import {text} from '../text.js';
import {WavyProgress} from '../wavy.js';

const DEFAULT_CITIES = [
    {name: 'London', timezone: 'Europe/London'},
    {name: 'New York', timezone: 'America/New_York'},
    {name: 'Tokyo', timezone: 'Asia/Tokyo'},
];

function buildWorld(ctx) {
    const cities = (ctx.options.cities.length > 0 ? ctx.options.cities : DEFAULT_CITIES)
        .slice(0, ctx.size === 'small' ? 1 : ctx.size === 'medium' ? 3 : 6);
    const cells = cities.map(city => {
        const name = text('label', {tone: 'muted', content: city.name});
        const time = text(ctx.size === 'medium' ? 'metric-s' : 'metric-l');
        const period = text('label', {tone: 'muted'});
        const offset = text('label', {tone: 'muted'});
        const clock = row({gap: 'lg-row-tight', children: [time, ctx.twelveHour ? period : null]});
        const show = now => {
            const there = zoneTime(now, city.timezone);
            time.text = there ? Format.clock(there.hours, there.minutes, ctx.twelveHour) : Format.percent(null);
            period.text = there && there.hours >= 12 ? 'pm' : 'am';
            offset.text = there ? describeOffset(there) : 'Unknown time zone';
        };
        if (ctx.size === 'large') {
            clock.x_expand = false;
            return {actor: row({children: [column({gap: 'lg-stack', y: CENTER, children: [name, offset]}), clock]}), show};
        }
        return {actor: column({gap: 'lg-stack', y: CENTER, children: [name, clock, offset]}), show};
    });
    ctx.watch('minute', now => cells.forEach(cell => cell.show(now)));
    const actors = cells.map(cell => cell.actor);
    return {actor: ctx.size === 'medium' ? row({children: actors}) : column({gap: 'lg-column-wide', y: CENTER, children: actors})};
}

export const worldclock = buildWorld;

// Kept outside the widget, so a running timer survives a new size, new
// colours and the lock screen.
const timers = new Map();
// A mirrored timer has a view on every monitor; all follow the one state.
const timerViews = new Map();
const MINUTE = 60 * 1000;
const PRESETS = [5, 15, 25, 45];

function buildTimer(ctx) {
    const mode = ctx.options.mode === 'stopwatch' ? 'stopwatch' : 'timer';
    const duration = ctx.options.minutes * MINUTE;
    let state = timers.get(ctx.id);
    if (!state || state.mode !== mode || (!Timer.isRunning(state) && state.elapsed === 0))
        state = Timer.create(mode, duration);

    const name = text('label', {tone: 'muted', content: mode === 'timer' ? 'Timer' : 'Stopwatch'});
    const time = text(ctx.size === 'small' ? 'metric-l' : 'metric-xl');
    const progress = mode === 'timer' ? new WavyProgress({theme: ctx.theme, accent: ctx.accent}) : null;
    const toggle = iconButton('media-playback-start-symbolic', () => press(), {kind: 'loud', label: 'Start or pause'});
    const reset = iconButton('view-refresh-symbolic', () => {
        save(Timer.reset({...state, duration}));
    }, {kind: 'quiet', label: 'Reset'});

    let stopTicking = null;
    let alarm = 0;
    const views = timerViews.get(ctx.id) ?? new Set();
    timerViews.set(ctx.id, views);
    // Only the first view announces the end; the others would repeat it.
    const announces = views.size === 0;

    const show = () => {
        const now = Date.now();
        if (Timer.isFinished(state, now) && Timer.isRunning(state))
            state = Timer.pause(state, state.startedAt + state.duration - state.elapsed);
        time.text = Format.stopwatch(Timer.shown(state, now) + (mode === 'timer' ? 999 : 0));
        progress?.set(100 * Timer.progress(state, now), 'primary');
        toggle.child.icon_name = Timer.isRunning(state) ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
    };

    // The seconds are only asked for while something runs.
    const sync = () => {
        const running = Timer.isRunning(state);
        if (running && !stopTicking)
            stopTicking = ctx.watch('second', show);
        if (!running && stopTicking) {
            stopTicking();
            stopTicking = null;
        }
        if (alarm)
            GLib.source_remove(alarm);
        alarm = 0;
        // The end is announced even while the widget is covered.
        if (running && mode === 'timer' && announces) {
            alarm = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.max(0, Timer.shown(state, Date.now())), () => {
                alarm = 0;
                ctx.notify('Timer finished', `${Format.duration(state.duration)} are over.`);
                show();
                sync();
                return GLib.SOURCE_REMOVE;
            });
        }
        show();
    };

    function save(next) {
        timers.set(ctx.id, next);
        for (const follow of views)
            follow(next);
    }

    function press() {
        const now = Date.now();
        if (Timer.isRunning(state))
            save(Timer.pause(state, now));
        else if (Timer.isFinished(state, now))
            save(Timer.start(Timer.reset(state), now));
        else
            save(Timer.start(state, now));
    }

    const buttons = row({gap: 'lg-row-tight', children: [toggle, reset, spacer()]});
    let actor;
    if (ctx.size === 'small') {
        actor = column({y: CENTER, children: [column({gap: 'lg-stack', children: [name, time]}), buttons]});
    } else {
        const presets = mode === 'timer' ? row({gap: 'lg-row-tight', x: START, children: PRESETS.map(minutes => {
            const button = iconButton('', () => ctx.setOptions({minutes}), {kind: minutes === ctx.options.minutes ? 'loud' : null, small: true, label: `${minutes} minutes`});
            button.child = text('label', {align: CENTER, content: String(minutes)});
            return button;
        })}) : null;
        buttons.x_expand = false;
        actor = column({y: CENTER, children: [
            row({children: [column({gap: 'lg-stack', children: [name, time]}), buttons]}),
            progress,
            presets,
        ]});
    }
    const follow = next => {
        state = next;
        sync();
    };
    views.add(follow);
    sync();
    return {
        actor,
        destroy: () => {
            views.delete(follow);
            // The state stays in the map; only this view's alarm goes. A
            // finished timer is then noticed when the widget is built again.
            if (alarm)
                GLib.source_remove(alarm);
        },
    };
}

export const timer = buildTimer;

// Like the timers: kept outside the widget, followed by every view of it.
const pomodoros = new Map();
const pomodoroViews = new Map();
const LONG_BREAK_MIN = 15;
const ROUNDS = 4;
const PHASES = {work: 'Focus', rest: 'Break', long: 'Long break'};

function buildPomodoro(ctx) {
    const config = {
        work: ctx.options.work * MINUTE, rest: ctx.options.rest * MINUTE, long: LONG_BREAK_MIN * MINUTE, rounds: ROUNDS,
    };
    let state = pomodoros.get(ctx.id);
    // Not begun, or set to other lengths since: from the start.
    if (!state || (!Timer.isRunning(state.timer) && state.timer.elapsed === 0 && state.phase === 'work' && state.round === 1))
        state = Pomodoro.create(config);

    const small = ctx.size === 'small';
    const face = small ? 72 : 104;
    // The time stands on a shape that grows more pronounced as the phase
    // passes; in the calm look, in a ring that fills.
    const mark = ctx.expressive
        ? badge({size: face, theme: ctx.theme, role: small ? 'title' : 'metric-s', accent: ctx.accent, mood: 'soft'})
        : gauge({size: face, stroke: 8, theme: ctx.theme, role: small ? 'title' : 'metric-s', accent: ctx.accent});
    const phase = text(small ? 'label' : 'title', {tone: small ? 'muted' : null});
    const round = text('label', {tone: 'muted'});
    const toggle = iconButton('media-playback-start-symbolic', () => press(), {kind: 'loud', label: 'Start or pause'});
    const reset = iconButton('view-refresh-symbolic', () => save(Pomodoro.create(config)), {kind: 'quiet', label: 'Start over'});

    let stopTicking = null;
    let alarm = 0;
    const views = pomodoroViews.get(ctx.id) ?? new Set();
    pomodoroViews.set(ctx.id, views);
    const announces = views.size === 0;

    const show = () => {
        const now = Date.now();
        const settled = Pomodoro.settle(state, now, config);
        if (settled.ended > 0)
            state = settled.state;
        const {timer} = state;
        const done = Timer.progress(timer, now);
        mark.label.text = Format.stopwatch(Timer.shown(timer, now) + 999);
        if (ctx.expressive)
            mark.show(Math.min(0.99, done), 'primary');
        else
            mark.ring.set(100 * done, 'primary');
        phase.text = PHASES[state.phase];
        round.text = `Round ${state.round} of ${ROUNDS}`;
        toggle.child.icon_name = Timer.isRunning(timer) ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
    };

    const sync = () => {
        const running = Timer.isRunning(state.timer);
        if (running && !stopTicking)
            stopTicking = ctx.watch('second', show);
        if (!running && stopTicking) {
            stopTicking();
            stopTicking = null;
        }
        if (alarm)
            GLib.source_remove(alarm);
        alarm = 0;
        // The end of a phase is announced even while the widget is covered.
        if (running && announces) {
            alarm = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.max(0, Pomodoro.endsAt(state) - Date.now()), () => {
                alarm = 0;
                const ended = state.phase;
                save(Pomodoro.settle(state, Date.now(), config).state);
                ctx.notify(ended === 'work' ? 'Focus is over' : 'The break is over',
                    `${PHASES[state.phase]}: ${Format.duration(state.timer.duration)}.`);
                return GLib.SOURCE_REMOVE;
            });
        }
        show();
    };

    function save(next) {
        pomodoros.set(ctx.id, next);
        for (const follow of views)
            follow(next);
    }

    function press() {
        const now = Date.now();
        save(Timer.isRunning(state.timer) ? Pomodoro.pause(state, now) : Pomodoro.start(state, now));
    }

    const buttons = row({gap: 'lg-row-tight', x: small ? CENTER : START, children: [toggle, reset]});
    buttons.x_expand = false;
    const actor = small
        ? column({gap: 'lg-stack', y: CENTER, children: [mark.actor, buttons]})
        : row({gap: 'lg-row-wide', children: [mark.actor, column({gap: 'lg-column', y: CENTER, children: [
            column({gap: 'lg-stack', children: [phase, round]}), buttons,
        ]})]});
    const follow = next => {
        state = next;
        sync();
    };
    views.add(follow);
    sync();
    return {
        actor,
        destroy: () => {
            views.delete(follow);
            if (alarm)
                GLib.source_remove(alarm);
        },
    };
}

export const pomodoro = buildPomodoro;

const FAR_DAYS = 30;

function buildCountdown(ctx) {
    const target = parseDate(ctx.options.date);
    if (!target)
        return {actor: hint('Set a date in the settings.')};

    const title = text(ctx.size === 'small' ? 'label' : 'title', {tone: ctx.size === 'small' ? 'muted' : null, content: ctx.options.title || 'Countdown'});
    // In the expressive look the days stand on a shape that grows plainer
    // as the day comes near: thirty days out it has all its rays.
    const mark = ctx.expressive ? badge({size: 84, theme: ctx.theme, role: 'metric-l', accent: ctx.accent}) : null;
    const number = mark ? mark.label : text('metric-xl');
    const unit = text('label', {tone: 'muted'});
    const date = text('body', {tone: 'muted', content: `${target[2]} ${MONTHS[target[1] - 1]} ${target[0]}`});
    const days = column({gap: 'lg-stack', y: CENTER, children: [ctx.size === 'small' ? title : null, mark ? mark.actor : number, unit]});
    let actor = days;
    if (ctx.size === 'medium') {
        days.x_expand = false;
        days.width = 120;
        actor = row({gap: 'lg-row-wide', children: [days, column({gap: 'lg-stack', y: CENTER, children: [title, date]})]});
    }
    ctx.watch('minute', now => {
        const left = Format.daysBetween([now.getFullYear(), now.getMonth() + 1, now.getDate()], target);
        number.text = String(Math.abs(left));
        mark?.show(Math.min(0.99, Math.abs(left) / FAR_DAYS), 'primary');
        unit.text = left === 0 ? 'Today' : `${Math.abs(left) === 1 ? 'day' : 'days'} ${left > 0 ? 'to go' : 'ago'}`;
    });
    return {actor};
}

export const countdown = buildCountdown;
