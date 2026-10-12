// The four loads of the machine, each as its own widget: a ring when small,
// a number with its recent course when medium.

import * as Format from '../../lib/format.js';
import {count} from '../motion.js';
import {CENTER, badge, column, gauge, row} from '../parts.js';
import {Spark} from '../spark.js';
import {setTone, text} from '../text.js';

// read turns a reading into
//   {name, percent, value, sentence, tone, history, max}
function loadWidget(key, read, tone) {
    return ctx => {
        const name = text('label', {tone: 'muted'});
        let show;
        let actor;

        if (ctx.size === 'small' && ctx.expressive) {
            // The value on a shape that swells with it. Each load has its
            // own tone, so four of them side by side can be told apart.
            const mark = badge({size: 108, theme: ctx.theme, role: 'metric-s', accent: tone});
            actor = column({gap: 'lg-stack', children: [name, mark.actor]});
            show = reading => {
                mark.show((reading.percent ?? 0) / 100, reading.tone);
                count(mark.label, reading.value);
            };
        } else if (ctx.size === 'small') {
            const {actor: dial, ring, label} = gauge({size: 104, stroke: 10, theme: ctx.theme, role: 'metric-s'});
            actor = column({gap: 'lg-stack', children: [name, dial]});
            show = reading => {
                count(label, reading.value);
                ring.set(reading.percent, reading.tone);
            };
        } else {
            const value = text('metric-l');
            const sentence = text('body-strong');
            const spark = new Spark({theme: ctx.theme, accent: ctx.expressive ? tone : 'primary', max: 100});
            actor = row({
                gap: 'lg-row-wide',
                children: [column({gap: 'lg-stack', y: CENTER, children: [name, value, sentence]}), spark],
            });
            actor.get_first_child().x_expand = false;
            actor.get_first_child().width = 152;
            show = reading => {
                count(value, reading.value);
                setTone(value, reading.tone === 'primary' ? null : reading.tone);
                sentence.text = reading.sentence;
                spark.set(reading.history, reading.tone);
            };
        }

        ctx.watch(key, data => {
            const reading = read(data);
            name.text = reading.name;
            show(reading);
        });
        return {actor};
    };
}

const WARM = 80;
const HOT = 95;
// The span of a processor's temperatures that the ring is drawn over.
const COOL = 30;
const HOTTEST = 100;

export function readCpu(data) {
    return {
        name: 'CPU',
        percent: data.percent,
        value: Format.percent(data.percent),
        sentence: `${data.cores} cores`,
        tone: Format.tone(data.percent),
        history: data.history,
    };
}

export function readMemory(data) {
    return {
        name: 'Memory',
        percent: data.percent,
        value: Format.percent(data.percent),
        sentence: `${Format.bytes(data.used)} of ${Format.bytes(data.total)}`,
        tone: Format.tone(data.percent),
        history: data.history,
    };
}

export function readGpu(data) {
    if (data.kind === 'none')
        return {name: 'GPU', percent: null, value: Format.percent(null), sentence: 'No reading here', tone: 'primary', history: []};
    // A clock frequency is not a load, so it is named for what it is and
    // never coloured as a warning.
    if (data.kind === 'clock') {
        return {
            name: 'GPU clock',
            percent: data.percent,
            value: Format.percent(data.percent),
            sentence: `${data.mhz} MHz`,
            tone: 'primary',
            history: data.history,
        };
    }
    return {
        name: 'GPU',
        percent: data.percent,
        value: Format.percent(data.percent),
        sentence: data.memoryTotal ? `${Format.bytes(data.memoryUsed)} of ${Format.bytes(data.memoryTotal)}` : '',
        tone: Format.tone(data.percent),
        history: data.history,
    };
}

export function readTemperature(data) {
    const celsius = data.celsius;
    if (celsius === null)
        return {name: 'Temperature', percent: null, value: Format.celsius(null), sentence: 'No sensor found', tone: 'primary', history: []};
    return {
        name: 'Temperature',
        percent: 100 * (celsius - COOL) / (HOTTEST - COOL),
        value: Format.celsius(celsius),
        sentence: `Peak ${Format.celsius(Math.max(...data.history))}`,
        tone: celsius >= HOT ? 'bad' : celsius >= WARM ? 'warn' : 'primary',
        history: data.history,
    };
}

export const cpu = loadWidget('cpu', readCpu, 'primary');

export const memory = loadWidget('memory', readMemory, 'tertiary');

export const gpu = loadWidget('gpu', readGpu, 'secondary');

export const temperature = loadWidget('temperature', readTemperature, 'secondary');
