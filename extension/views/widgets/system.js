// The whole machine in one widget: processor, graphics, memory, temperature.

import {Glide} from '../motion.js';
import {CENTER, badge, column, gauge, row} from '../parts.js';
import {Spark} from '../spark.js';
import {setTone, text} from '../text.js';
import {readCpu, readGpu, readMemory, readTemperature} from './gauges.js';

// Key, reading, short name, and the tone it takes in the expressive look.
const PARTS = [
    ['cpu', readCpu, 'CPU', 'primary'],
    ['gpu', readGpu, 'GPU', 'secondary'],
    ['memory', readMemory, 'Memory', 'tertiary'],
    ['temperature', readTemperature, 'Temp', 'secondary'],
];

// Without its unit, to fit inside a small ring.
const bare = value => value.replace(/ ?(%|°C)$/, '');

function rings(ctx) {
    const glides = [];
    const cells = PARTS.map(([key, read, short, tone]) => {
        const name = text('label', {tone: 'muted', align: CENTER, content: short});
        if (ctx.expressive) {
            const mark = badge({size: 66, theme: ctx.theme, role: 'body-strong', accent: tone});
            ctx.watch(key, data => {
                const reading = read(data);
                mark.show((reading.percent ?? 0) / 100, reading.tone, bare(reading.value));
            });
            return column({y: CENTER, children: [mark.actor, name]});
        }
        const {actor: dial, ring, label} = gauge({size: 64, stroke: 7, theme: ctx.theme, role: 'body-strong'});
        let ringTone = 'primary';
        const glide = new Glide(ring, percent => ring.set(percent, ringTone));
        glides.push(glide);
        ctx.watch(key, data => {
            const reading = read(data);
            ringTone = reading.tone;
            label.text = bare(reading.value);
            glide.to(reading.percent);
        });
        return column({y: CENTER, children: [dial, name]});
    });
    return {actor: row({gap: 'lg-row', children: cells}), destroy: () => glides.forEach(g => g.stop())};
}

function rows(ctx) {
    const lines = PARTS.map(([key, read, , tone]) => {
        const name = text('label', {tone: 'muted'});
        const value = text('metric-s');
        const spark = new Spark({theme: ctx.theme, accent: ctx.expressive ? tone : 'primary', max: 100});
        const head = column({gap: 'lg-stack', y: CENTER, children: [name, value]});
        head.x_expand = false;
        head.width = 96;
        ctx.watch(key, data => {
            const reading = read(data);
            name.text = reading.name;
            value.text = reading.value;
            setTone(value, reading.tone === 'primary' ? null : reading.tone);
            spark.set(reading.history, reading.tone);
        });
        return row({gap: 'lg-row', expand: true, children: [head, spark]});
    });
    return {actor: column({gap: 'lg-column-wide', children: lines})};
}

export const system = ctx => ctx.size === 'large' ? rows(ctx) : rings(ctx);
