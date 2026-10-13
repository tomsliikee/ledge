// Battery, network, disks and the Claude limits: small states of the machine.

import * as Format from '../../lib/format.js';
import {Meter} from '../meter.js';
import {count, setNow} from '../motion.js';
import {CENTER, column, gauge, hint, icon, iconButton, row, swap} from '../parts.js';
import {Slider} from '../slider.js';
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

// The wave runs the way the charge goes: on while it fills, back while it
// drains, and it pulses when little is left.
function batteryWave(wave, reading) {
    const charging = reading.state === 'charging';
    wave.setRunning(charging);
    wave.setDirection(reading.state === 'discharging' ? -1 : 1);
    wave.setUrgent(!charging && reading.percent <= VERY_LOW);
}

function buildBattery(ctx) {
    const name = text('label', {tone: 'muted', content: 'Battery'});
    const sentence = text(ctx.size === 'small' ? 'label' : 'body-strong', {tone: ctx.size === 'small' ? 'muted' : null});
    let actor;
    let show;

    if (ctx.size === 'small') {
        const {actor: dial, ring, label} = gauge({size: 88, stroke: 9, theme: ctx.theme, accent: ctx.accent, role: 'metric-s', wavy: ctx.expressive});
        sentence.x_align = CENTER;
        actor = column({gap: 'lg-stack', children: [name, dial, sentence]});
        show = reading => {
            count(label, Format.percent(reading.percent));
            // The calm look's ring has no ripple.
            if (ring.wave)
                batteryWave(ring.wave, reading);
            ring.set(reading.percent, batteryTone(reading));
        };
    } else {
        const value = text('metric-l');
        const progress = new WavyProgress({theme: ctx.theme, accent: ctx.accent});
        actor = column({y: CENTER, children: [column({gap: 'lg-stack', children: [name, value]}), progress, sentence]});
        show = reading => {
            const tone = batteryTone(reading);
            count(value, Format.percent(reading.percent));
            setTone(value, tone === 'primary' ? null : tone);
            batteryWave(progress.wave, reading);
            progress.set(reading.percent, tone);
        };
    }

    let state = null;
    ctx.watch('battery', reading => {
        ctx.hide(!reading.present);
        if (!reading.present)
            return;
        sentence.text = batterySentence(reading);
        show(reading);
        // Plugged in, or full at last.
        if (state !== null && state !== reading.state && ['charging', 'full'].includes(reading.state))
            ctx.cheer();
        state = reading.state;
    });
    return {actor};
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
        count(down.value, Format.rate(reading.down));
        count(up.value, Format.rate(reading.up));
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
            count(label, Format.percent(disk.percent));
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
        count(label, Format.percent(window?.percent ?? null));
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

// Loudness and screen brightness: a number and the slider that sets it.
// read turns a reading into {name, level, dimmed, icon}.
function levelWidget(key, read, onPress = null) {
    return ctx => {
        const name = text('label', {tone: 'muted', expand: true});
        const value = text(ctx.size === 'small' ? 'metric-l' : 'metric-s');
        const slider = new Slider({theme: ctx.theme, accent: ctx.accent, onChange: level => {
            // Under the finger the number follows at once.
            setNow(value, Format.percent(100 * level));
            ctx.act(key, `set:${level.toFixed(3)}`);
        }});
        const symbol = onPress
            ? iconButton('audio-volume-high-symbolic', () => ctx.act(key, onPress), {kind: 'quiet', small: ctx.size === 'small', label: 'Mute'})
            : icon('display-brightness-symbolic', 20);
        const actor = ctx.size === 'small'
            ? column({y: CENTER, children: [row({children: [name, symbol]}), value, slider]})
            : column({y: CENTER, children: [row({children: [symbol, name, value]}), slider]});
        ctx.watch(key, data => {
            // A machine without this to set shows no widget for it.
            ctx.hide(!data.available);
            if (!data.available)
                return;
            const reading = read(data);
            name.text = reading.name;
            count(value, reading.dimmed ? 'Muted' : Format.percent(100 * reading.level));
            slider.set(reading.level, reading.dimmed);
            if (onPress)
                swap(symbol, reading.icon);
        });
        return {actor};
    };
}

function volumeIcon({level, muted}) {
    if (muted || level <= 0)
        return 'audio-volume-muted-symbolic';
    return level < 0.34 ? 'audio-volume-low-symbolic' : level < 0.67 ? 'audio-volume-medium-symbolic' : 'audio-volume-high-symbolic';
}

export const volume = levelWidget('volume', data => ({
    name: data.name || 'Volume', level: data.level, dimmed: data.muted, icon: volumeIcon(data),
}), 'mute');

export const brightness = levelWidget('brightness', data => ({name: 'Brightness', level: data.level, dimmed: false}));
