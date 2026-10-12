import {describePollen} from '../../lib/air.js';
import {WEEKDAYS} from '../../lib/calendar.js';
import * as Format from '../../lib/format.js';
import * as Weather from '../../lib/weather.js';
import {Meter} from '../meter.js';
import {colors} from '../../lib/tokens.js';
import {CENTER, END, badge, column, gauge, hint, icon, row, spacer} from '../parts.js';
import {SunArc} from '../sunarc.js';
import {text} from '../text.js';

const NO_PLACE = 'Choose a place in the settings.';
const NO_ANSWER = 'The weather could not be loaded.';

// Shows the hint instead of the content until there is a forecast.
function withForecast(ctx, content, show) {
    const message = hint(NO_PLACE);
    const actor = column({children: [message, content]});
    content.visible = false;
    ctx.watch('weather', data => {
        const ready = Boolean(data.forecast);
        content.visible = ready;
        message.visible = !ready;
        message.text = data.place ? NO_ANSWER : NO_PLACE;
        if (ready)
            show(data);
    });
    return {actor};
}

function summary(ctx) {
    const place = text('label', {tone: 'muted'});
    const temperature = text('metric-l');
    const symbol = icon('weather-overcast-symbolic', ctx.expressive ? 22 : 28, ctx.expressive ? null : 'accent');
    // In the expressive look the condition sits on a shape: the sun's own
    // colour and rays for a clear day, the tile's tone and a rounder form else.
    const mark = ctx.expressive
        ? badge({size: 44, theme: ctx.theme, accent: ctx.accent, child: symbol})
        : null;
    const condition = text('body-strong');
    const range = text('label', {tone: 'muted'});
    const actor = column({
        gap: 'lg-stack',
        y: CENTER,
        children: [row({children: [place, spacer(), mark ? mark.actor : symbol]}), temperature, condition, range],
    });
    const show = ({place: where, forecast}) => {
        const now = Weather.condition(forecast.current.code, forecast.current.isDay);
        place.text = where.name;
        temperature.text = Format.degrees(forecast.current.temperature);
        symbol.icon_name = now.icon;
        if (mark) {
            const sunny = forecast.current.isDay && forecast.current.code <= 1;
            mark.show(sunny ? 0.7 : 0.3, 'primary');
            mark.shape.setColor(sunny ? colors[ctx.theme]['illustration-sun'] : null);
            if (sunny)
                symbol.style = `color: ${colors[ctx.theme]['illustration-night']};`;
        }
        condition.text = now.label;
        range.text = forecast.today
            ? `${Format.degrees(forecast.today.min)} to ${Format.degrees(forecast.today.max)}`
            : '';
    };
    return {actor, show};
}

function hours(forecast) {
    return row({
        gap: 'lg-row-tight',
        children: forecast.hours.slice(0, 5).map(hour => {
            const local = Weather.localTime(hour.time, forecast.utcOffset);
            return column({
                y: CENTER,
                children: [
                    text('label', {tone: 'muted', align: CENTER, content: String(local.hours).padStart(2, '0')}),
                    icon(Weather.condition(hour.code, hour.isDay).icon, 20, 'accent'),
                    text('body-strong', {align: CENTER, content: Format.degrees(hour.temperature)}),
                ],
            });
        }),
    });
}

function days(forecast, theme) {
    const coldest = Math.min(...forecast.days.map(d => d.min));
    const warmest = Math.max(...forecast.days.map(d => d.max));
    const span = Math.max(1, warmest - coldest);
    return column({
        gap: 'lg-column',
        children: forecast.days.map(day => {
            const name = text('label', {tone: 'muted', content: WEEKDAYS[Weather.localTime(day.time, forecast.utcOffset).weekday]});
            name.width = 36;
            const low = text('label', {tone: 'muted', content: Format.degrees(day.min)});
            low.width = 30;
            const high = text('body-strong', {content: Format.degrees(day.max)});
            high.width = 30;
            high.clutter_text.x_align = END;
            const meter = new Meter({theme});
            meter.set((day.min - coldest) / span, (day.max - coldest) / span);
            return row({children: [name, icon(Weather.condition(day.code).icon, 16, 'accent'), low, meter, high]});
        }),
    });
}

function build(ctx) {
    const now = summary(ctx);
    if (ctx.size === 'small')
        return withForecast(ctx, now.actor, now.show);

    now.actor.x_expand = false;
    now.actor.width = 112;
    const later = column({y: CENTER});
    const top = row({gap: 'lg-row-wide', children: [now.actor, later]});
    const week = column({});
    const content = ctx.size === 'large' ? column({gap: 'lg-column-wide', children: [top, week]}) : top;
    return withForecast(ctx, content, data => {
        now.show(data);
        later.destroy_all_children();
        later.add_child(hours(data.forecast));
        week.destroy_all_children();
        if (ctx.size === 'large')
            week.add_child(days(data.forecast, ctx.theme));
    });
}

export const weather = build;

function clockAt(ms, forecast, twelveHour) {
    const local = Weather.localTime(ms, forecast.utcOffset);
    return Format.time(local.hours, local.minutes, twelveHour);
}

function buildDaylight(ctx) {
    const arc = new SunArc({theme: ctx.theme, accent: ctx.accent, height: ctx.size === 'small' ? 64 : 92});
    const name = text('label', {tone: 'muted'});
    const time = text('metric-s');
    const length = text('label', {tone: 'muted'});
    const rise = text('body-strong');
    let forecast = null;

    const content = ctx.size === 'small'
        ? column({children: [arc, column({gap: 'lg-stack', children: [name, time]})]})
        : row({gap: 'lg-row-wide', children: [arc, column({gap: 'lg-stack', y: CENTER, children: [name, time, rise, length]})]});
    if (ctx.size !== 'small') {
        arc.x_expand = false;
        arc.width = 136;
    }

    const show = () => {
        if (!forecast?.sunrise)
            return;
        const now = Date.now();
        const up = Weather.sunProgress(forecast.sunrise, forecast.sunset, now);
        arc.set(up);
        // The next thing the sun does is the one worth the large type.
        const next = up !== null ? forecast.sunset : now < forecast.sunrise ? forecast.sunrise : forecast.nextSunrise;
        name.text = up !== null ? 'Sunset' : 'Sunrise';
        time.text = next ? clockAt(next, forecast, ctx.twelveHour) : Format.percent(null);
        rise.text = up !== null
            ? `Rose at ${clockAt(forecast.sunrise, forecast, ctx.twelveHour)}`
            : `Set at ${clockAt(forecast.sunset, forecast, ctx.twelveHour)}`;
        length.text = `${Format.duration(forecast.sunset - forecast.sunrise)} of daylight`;
    };
    ctx.watch('minute', show);
    return withForecast(ctx, content, data => {
        forecast = data.forecast;
        show();
    });
}

export const daylight = buildDaylight;

const NO_AIR = 'The air quality could not be loaded.';
const AIR_TONE = 'tertiary';

function buildAir(ctx) {
    const small = ctx.size === 'small';
    const place = text('label', {tone: 'muted'});
    // The index on a shape that grows more jagged as the air gets worse;
    // in the calm look in a ring.
    const mark = ctx.expressive
        ? badge({size: small ? 100 : 104, theme: ctx.theme, role: 'metric-s', accent: AIR_TONE})
        : gauge({size: small ? 100 : 104, stroke: 10, theme: ctx.theme, role: 'metric-s'});
    const name = text('title');
    const dust = text('body', {tone: 'muted'});
    const pollen = text('body-strong');
    const content = small
        ? column({gap: 'lg-stack', children: [place, mark.actor]})
        : row({gap: 'lg-row-wide', children: [mark.actor, column({gap: 'lg-stack', y: CENTER, children: [place, name, dust, pollen]})]});
    content.visible = false;
    const message = hint(NO_PLACE);
    ctx.watch('air', data => {
        const ready = Boolean(data.air);
        content.visible = ready;
        message.visible = !ready;
        message.text = data.place ? NO_AIR : NO_PLACE;
        if (!ready)
            return;
        const {air} = data;
        place.text = small ? `Air · ${air.name}` : `Air in ${data.place.name}`;
        mark.label.text = String(air.index);
        if (ctx.expressive)
            mark.show(Math.min(0.99, air.share), air.tone);
        else
            mark.ring.set(100 * air.share, air.tone);
        name.text = air.name;
        dust.text = air.pm25 === null ? '' : `PM2.5 ${Math.round(air.pm25)} · PM10 ${Math.round(air.pm10 ?? 0)}`;
        pollen.text = describePollen(air.pollen);
        pollen.visible = air.pollen !== null;
    });
    return {actor: column({children: [message, content]})};
}

export const air = buildAir;
