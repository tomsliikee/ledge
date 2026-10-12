// Battery, network, disks and the Claude limits: small states of the machine.

import * as Format from '../../lib/format.js';
import {Meter} from '../meter.js';
import {Glide} from '../motion.js';
import {CENTER, column, gauge, hint, icon, row} from '../parts.js';
import {Spark} from '../spark.js';
import {setTone, text} from '../text.js';
import {WavyProgress} from '../wavy.js';

const LOW = 20;
const VERY_LOW = 10;

function batteryTone(reading) {
    if (reading.state === 'charging')
        return 'primary';
    return reading.percent <= VERY_LOW ? 'bad' : reading.percent <= LOW ? 'warn' : 'primary';
}

function batterySentence(reading) {
    if (reading.state === 'full')
        return 'Fully charged';
    if (reading.state === 'charging')
        return reading.remaining ? `Full in ${Format.duration(reading.remaining)}` : 'Charging';
    return reading.remaining ? `${Format.duration(reading.remaining)} left` : 'On battery';
}

function buildBattery(ctx) {
    const name = text('label', {tone: 'muted', content: 'Battery'});
    const sentence = text(ctx.size === 'small' ? 'label' : 'body-strong', {tone: ctx.size === 'small' ? 'muted' : null});
    let actor;
    let show;
    let glide = null;

    if (ctx.size === 'small') {
        const {actor: dial, ring, label} = gauge({size: 88, stroke: 9, theme: ctx.theme, accent: ctx.accent, role: 'metric-s', wavy: ctx.expressive});
        let tone = 'primary';
        glide = new Glide(ring, percent => ring.set(percent, tone));
        sentence.x_align = CENTER;
        actor = column({gap: 'lg-stack', children: [name, dial, sentence]});
        show = reading => {
            tone = batteryTone(reading);
            label.text = Format.percent(reading.percent);
            glide.to(reading.percent);
        };
    } else {
        const value = text('metric-l');
        const progress = new WavyProgress({theme: ctx.theme, accent: ctx.accent});
        actor = column({y: CENTER, children: [column({gap: 'lg-stack', children: [name, value]}), progress, sentence]});
        show = reading => {
            const tone = batteryTone(reading);
            value.text = Format.percent(reading.percent);
            setTone(value, tone === 'primary' ? null : tone);
            progress.set(reading.percent, tone);
        };
    }

    ctx.watch('battery', reading => {
        ctx.hide(!reading.present);
        if (!reading.present)
            return;
        sentence.text = batterySentence(reading);
        show(reading);
    });
    return {actor, destroy: () => glide?.stop()};
}

export const battery = buildBattery;

function buildNetwork(ctx) {
    const line = (symbol, name) => {
        const value = text('metric-s');
        const actor = column({
            gap: 'lg-stack',
            children: [row({gap: 'lg-row-tight', children: [icon(symbol, 14, 'accent'), text('label', {tone: 'muted', content: name})]}), value],
        });
        return {actor, value};
    };
    const down = line('go-down-symbolic', 'Download');
    const up = line('go-up-symbolic', 'Upload');
    const rates = column({gap: 'lg-column-wide', y: CENTER, children: [down.actor, up.actor]});
    const spark = ctx.size === 'medium' ? new Spark({theme: ctx.theme, accent: ctx.accent, max: null}) : null;
    let actor = rates;
    if (spark) {
        rates.x_expand = false;
        rates.width = 132;
        actor = row({gap: 'lg-row-wide', children: [rates, spark]});
    }
    ctx.watch('network', reading => {
        down.value.text = Format.rate(reading.down);
        up.value.text = Format.rate(reading.up);
        spark?.set(reading.history);
    });
    return {actor};
}

export const network = buildNetwork;

function buildDisk(ctx) {
    if (ctx.size === 'small') {
        const name = text('label', {tone: 'muted'});
        const free = text('label', {tone: 'muted', align: CENTER});
        const {actor: dial, ring, label} = gauge({size: 88, stroke: 9, theme: ctx.theme, accent: ctx.accent, role: 'metric-s', wavy: ctx.expressive});
        ctx.watch('disk', disks => {
            const disk = disks[0];
            if (!disk)
                return;
            name.text = disk.name;
            label.text = Format.percent(disk.percent);
            free.text = `${Format.bytes(disk.free)} free`;
            ring.set(disk.percent, Format.tone(disk.percent));
        });
        return {actor: column({gap: 'lg-stack', children: [name, dial, free]})};
    }

    const list = column({gap: 'lg-column-wide', y: CENTER});
    ctx.watch('disk', disks => {
        list.destroy_all_children();
        for (const disk of disks.slice(0, 3)) {
            const meter = new Meter({theme: ctx.theme, accent: ctx.accent});
            meter.set(0, disk.percent / 100, Format.tone(disk.percent));
            list.add_child(column({
                gap: 'lg-stack',
                children: [
                    row({children: [
                        text('body-strong', {expand: true, content: disk.name}),
                        text('label', {tone: 'muted', content: `${Format.bytes(disk.free)} free of ${Format.bytes(disk.total)}`}),
                    ]}),
                    meter,
                ],
            }));
        }
    });
    return {actor: list};
}

export const disk = buildDisk;

const NO_TALLY = 'Tally has recorded no limits yet.';

function limit(ctx, name, size) {
    const {actor: dial, ring, label} = gauge({size, stroke: Math.round(size / 10), theme: ctx.theme, accent: ctx.accent, role: size > 80 ? 'metric-s' : 'body-strong', wavy: ctx.expressive});
    const title = text('label', {tone: 'muted', content: name});
    const reset = text('label', {tone: 'muted'});
    const show = window => {
        label.text = Format.percent(window?.percent ?? null);
        ring.set(window?.percent ?? null, Format.tone(window?.percent));
        reset.text = window?.resetsAt ? `Resets in ${Format.duration(window.resetsAt - Date.now())}` : '';
    };
    return {dial, title, reset, show};
}

function buildClaude(ctx) {
    const message = hint(NO_TALLY);
    let content;
    let show;
    if (ctx.size === 'small') {
        const session = limit(ctx, 'Session', 88);
        session.reset.x_align = CENTER;
        content = column({gap: 'lg-stack', children: [session.title, session.dial, session.reset]});
        show = limits => session.show(limits.session);
    } else {
        const session = limit(ctx, 'Session', 72);
        const week = limit(ctx, 'Week', 72);
        const cell = part => row({children: [part.dial, column({gap: 'lg-stack', y: CENTER, children: [part.title, part.reset]})]});
        content = row({gap: 'lg-row', y: CENTER, children: [cell(session), cell(week)]});
        show = limits => {
            session.show(limits.session);
            week.show(limits.week);
        };
    }
    content.visible = false;
    let limits = null;
    const refresh = () => {
        content.visible = Boolean(limits);
        message.visible = !limits;
        if (limits)
            show(limits);
    };
    ctx.watch('claude', value => {
        limits = value;
        refresh();
    });
    // The time until a reset shrinks without a new record.
    ctx.watch('minute', refresh);
    return {actor: column({children: [message, content]})};
}

export const claude = buildClaude;
