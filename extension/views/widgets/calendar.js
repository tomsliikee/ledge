import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {dayName, upcoming} from '../../lib/agenda.js';
import {MONTHS, WEEKDAYS, WEEKDAYS_LONG, monthGrid, weekday} from '../../lib/calendar.js';
import * as Format from '../../lib/format.js';
import {cascade, stopCascade} from '../motion.js';
import {CENTER, START, badge, column, hint, row} from '../parts.js';
import {text} from '../text.js';

function sheet(now, cell) {
    const layout = new Clutter.GridLayout({column_homogeneous: true, row_homogeneous: true});
    const grid = new St.Widget({layout_manager: layout, x_expand: true, y_align: CENTER});
    const place = (child, column_, row_) => {
        const bin = new St.Bin({child, width: cell, height: cell, x_align: CENTER, y_align: CENTER});
        layout.attach(bin, column_, row_, 1, 1);
        return bin;
    };
    WEEKDAYS.forEach((name, i) => place(text('label', {tone: 'muted', align: CENTER, content: name[0]}), i, 0));
    monthGrid(now.getFullYear(), now.getMonth() + 1).forEach((week, w) => {
        week.forEach((day, d) => {
            if (day === null)
                return;
            const today = day === now.getDate();
            const label = text(today ? 'body-strong' : 'body', {tone: today ? 'today' : null, align: CENTER, content: String(day)});
            const bin = place(label, d, w + 1);
            if (today)
                bin.style_class = 'lg-today-cell';
        });
    });
    return grid;
}

function build(ctx) {
    const large = ctx.size === 'large';
    const title = text('title');
    const holder = new St.Bin({x_expand: true, y_expand: true});
    // The large sheet has no room for the day on its own, so its parts are
    // not made: an actor without a parent is never destroyed.
    let date = null;
    let showDate = () => {};
    if (!large) {
        const day = text('label', {tone: 'accent'});
        const month = text('label', {tone: 'muted'});
        // In the expressive look the day stands on a clover in the tile's tone.
        const mark = ctx.expressive
            ? badge({size: 84, theme: ctx.theme, role: 'metric-l', accent: ctx.accent, mood: 'soft'})
            : null;
        mark?.show(0.5, 'primary');
        const number = mark ? mark.label : text('metric-xl');
        date = column({gap: 'lg-stack', y: CENTER, children: [day, mark ? mark.actor : number, month]});
        showDate = now => {
            day.text = WEEKDAYS_LONG[weekday(now)];
            number.text = String(now.getDate());
            month.text = MONTHS[now.getMonth()];
        };
    }

    let actor = date;
    if (ctx.size === 'medium') {
        date.x_expand = false;
        date.width = 96;
        actor = row({gap: 'lg-row', children: [date, holder]});
    } else if (large) {
        actor = column({gap: 'lg-column-wide', children: [title, holder]});
    }

    let shown = null;
    ctx.watch('minute', now => {
        // The sheet only changes with the date, not with the minute.
        const key = now.toDateString();
        if (key === shown)
            return;
        shown = key;
        showDate(now);
        title.text = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
        if (ctx.size !== 'small')
            holder.set_child(sheet(now, large ? 36 : 21));
    });
    return {actor};
}

export const calendar = build;

const TIME_WIDTH = 80;

function buildEvents(ctx) {
    const large = ctx.size === 'large';
    const lines = large ? 9 : 4;
    const list = column({gap: 'lg-stack', y: START});
    const message = hint('');
    let reading = null;
    let shown = null;

    const clock = ms => {
        const date = new Date(ms);
        return Format.time(date.getHours(), date.getMinutes(), ctx.twelveHour);
    };

    const render = () => {
        if (!reading)
            return;
        const now = Date.now();
        const ahead = upcoming(reading.events, now);
        stopCascade(list.get_first_child());
        list.destroy_all_children();
        list.visible = ahead.length > 0;
        message.visible = ahead.length === 0;
        message.text = reading.available ? 'Nothing ahead this week.' : 'No calendar is set up. Add an account in Settings.';
        // A line for each day's name and one for each entry, as many as fit.
        let left = lines;
        let day = null;
        for (const event of ahead) {
            const named = event.day !== day;
            if (left < (named ? 2 : 1))
                break;
            if (named) {
                day = event.day;
                list.add_child(text('label', {tone: day === 0 ? 'accent' : 'muted', content: dayName(day, now)}));
                left--;
            }
            const when = text('body', {tone: 'muted', content: event.allDay ? 'All day' : event.running ? 'Now' : clock(event.start)});
            when.width = TIME_WIDTH;
            list.add_child(row({gap: 'lg-row-tight', children: [when, text('body-strong', {expand: true, content: event.summary})]}));
            left--;
        }
        // Other entries than before come in one after the other; a minute
        // that only passed changes none of them.
        const entries = JSON.stringify(ahead.map(event => [event.day, event.start, event.summary]));
        if (shown !== null && entries !== shown)
            cascade(list.get_children());
        shown = entries;
    };
    list.replay = () => cascade(list.get_children());
    ctx.watch('events', data => {
        reading = data;
        render();
    });
    // An entry begins and ends without the calendar changing.
    ctx.watch('minute', render);
    return {actor: column({children: [message, list]})};
}

export const events = buildEvents;
