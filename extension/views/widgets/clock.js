import {MONTHS, WEEKDAYS_LONG, weekday} from '../../lib/calendar.js';
import * as Format from '../../lib/format.js';
import {Dial} from '../dial.js';
import {motionEnabled} from '../motion.js';
import {CENTER, column, row} from '../parts.js';
import {text} from '../text.js';
import {WavyProgress} from '../wavy.js';

const DAY_MINUTES = 24 * 60;

function dateLine(date) {
    return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function analog(ctx) {
    const large = ctx.size === 'large';
    const dial = new Dial({size: large ? 248 : ctx.height, theme: ctx.theme, accent: ctx.accent, expressive: ctx.expressive});
    const day = text('label', {tone: 'muted', align: large ? CENTER : undefined});
    const date = text(large ? 'title' : 'metric-s', {align: large ? CENTER : undefined});

    let actor = dial;
    if (ctx.size === 'medium')
        actor = row({gap: 'lg-row-wide', children: [dial, column({gap: 'lg-stack', y: CENTER, children: [day, date]})]});
    else if (large)
        actor = column({y: CENTER, children: [dial, column({gap: 'lg-stack', children: [day, date]})]});

    // A hand that moves every second is motion; without motion the clock
    // only changes with the minute.
    const seconds = motionEnabled();
    ctx.watch(seconds ? 'second' : 'minute', now => {
        dial.set(now.getHours(), now.getMinutes(), seconds ? now.getSeconds() : null);
        day.text = WEEKDAYS_LONG[weekday(now)];
        date.text = dateLine(now);
    });
    return {actor};
}

function digital(ctx) {
    const large = ctx.size === 'large';
    const time = text(ctx.size === 'small' ? 'metric-l' : 'metric-xl');
    const period = text('label', {tone: 'muted'});
    const day = text('label', {tone: 'muted'});
    const date = text(ctx.size === 'small' ? 'body-strong' : 'title');
    const progress = large ? new WavyProgress({theme: ctx.theme, accent: ctx.accent}) : null;
    const share = large ? text('body-strong') : null;

    const clock = row({gap: 'lg-row-tight', children: [time, ctx.twelveHour ? period : null]});
    const actor = column({
        y: CENTER,
        children: [column({gap: 'lg-stack', children: [day, clock, date]}), progress, share],
    });

    ctx.watch('minute', now => {
        time.text = Format.clock(now.getHours(), now.getMinutes(), ctx.twelveHour);
        period.text = now.getHours() < 12 ? 'am' : 'pm';
        day.text = WEEKDAYS_LONG[weekday(now)];
        date.text = dateLine(now);
        if (large) {
            const gone = 100 * (now.getHours() * 60 + now.getMinutes()) / DAY_MINUTES;
            progress.set(gone, 'primary');
            share.text = `${Format.percent(gone)} of the day is over`;
        }
    });
    return {actor};
}

export const clock = ctx => ctx.options.face === 'digital' ? digital(ctx) : analog(ctx);
