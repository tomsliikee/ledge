import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {MONTHS, WEEKDAYS, WEEKDAYS_LONG, monthGrid, weekday} from '../../lib/calendar.js';
import {CENTER, badge, column, row} from '../parts.js';
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
    const day = text('label', {tone: 'accent'});
    const month = text('label', {tone: 'muted'});
    const title = text('title');
    // In the expressive look the day stands on a clover in the tile's tone.
    const mark = ctx.expressive
        ? badge({size: 84, theme: ctx.theme, role: 'metric-l', accent: ctx.accent, mood: 'soft'})
        : null;
    mark?.show(0.5, 'primary');
    const number = mark ? mark.label : text('metric-xl');
    const date = column({gap: 'lg-stack', y: CENTER, children: [day, mark ? mark.actor : number, month]});
    const holder = new St.Bin({x_expand: true, y_expand: true});

    let actor = date;
    if (ctx.size === 'medium') {
        date.x_expand = false;
        date.width = 96;
        actor = row({gap: 'lg-row', children: [date, holder]});
    } else if (ctx.size === 'large') {
        actor = column({gap: 'lg-column-wide', children: [title, holder]});
    }

    let shown = null;
    ctx.watch('minute', now => {
        // The sheet only changes with the date, not with the minute.
        const key = now.toDateString();
        if (key === shown)
            return;
        shown = key;
        day.text = WEEKDAYS_LONG[weekday(now)];
        number.text = String(now.getDate());
        month.text = MONTHS[now.getMonth()];
        title.text = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
        if (ctx.size !== 'small')
            holder.set_child(sheet(now, ctx.size === 'large' ? 36 : 21));
    });
    return {actor};
}

export const calendar = build;
