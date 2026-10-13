// A small line of the last readings, with a soft fill beneath it.

import Cairo from 'cairo';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {movedOn} from '../lib/hub.js';
import {colors} from '../lib/tokens.js';
import {Glide} from './motion.js';
import {setSource, toneColor} from './paint.js';

const STROKE = 3;
const FILL_ALPHA = 0.16;

export const Spark = GObject.registerClass(
class Spark extends St.DrawingArea {
    // max: the value at the top edge; null scales to the highest reading.
    _init({theme, accent = 'primary', max = 100, height = -1}) {
        super._init({x_expand: true, y_expand: true, height});
        this._theme = theme;
        this._accent = accent;
        this._max = max;
        this._values = [];
        this._tone = 'primary';
        // How much of the line is drawn yet: it is drawn in from the left.
        this._drawn = 1;
        this._glide = new Glide(this, drawn => {
            this._drawn = drawn / 100;
            this.queue_repaint();
        }, {origin: 0, spring: 'effectSlow'});
        // How far, in steps, the line still is from its place after a new
        // reading: it moves on by one instead of jumping. gone is the
        // reading that left at the other end, drawn until it is out of view.
        this._shift = 0;
        this._gone = null;
        this._shifting = new Glide(this, shift => {
            this._shift = shift / 100;
            this.queue_repaint();
        }, {spring: 'effect', livelyOnly: true});
        this.connect('repaint', () => this._draw());
        this.connect('destroy', () => {
            this._glide.stop();
            this._shifting.stop();
        });
    }

    set(values, tone = 'primary') {
        if (movedOn(this._values, values)) {
            [this._gone] = this._values;
            this._shifting.jump(100);
            this._shifting.to(0);
        }
        this._values = values;
        this._tone = tone;
        if (values.length > 1)
            this._glide.to(100);
        this.queue_repaint();
    }

    replay() {
        this._glide.replay();
    }

    _draw() {
        const cr = this.get_context();
        const [width, height] = this.get_surface_size();
        const values = this._values;
        const palette = colors[this._theme];
        const bottom = height - STROKE / 2;

        // The floor the line stands on, so an empty chart is not a hole.
        setSource(cr, palette['outline-variant']);
        cr.setLineWidth(1);
        cr.moveTo(0, height - 0.5);
        cr.lineTo(width, height - 0.5);
        cr.stroke();

        if (values.length > 1) {
            if (this._drawn < 1) {
                cr.rectangle(0, 0, width * this._drawn, height);
                cr.clip();
            }
            const shift = this._shift;
            // While it moves on, the line begins a step earlier, out of view.
            const points = shift > 0 ? [this._gone, ...values] : values;
            const first = shift > 0 ? shift - 1 : 0;
            const max = this._max ?? Math.max(1, ...points);
            const step = width / (values.length - 1);
            const x = i => (first + i) * step;
            const y = value => bottom - Math.min(1, Math.max(0, value / max)) * (height - STROKE);
            const trace = () => {
                points.forEach((value, i) => {
                    if (i === 0)
                        cr.moveTo(x(i), y(value));
                    else
                        cr.lineTo(x(i), y(value));
                });
            };
            const color = toneColor(this._theme, this._tone, this._accent);

            trace();
            cr.lineTo(x(points.length - 1), height);
            cr.lineTo(x(0), height);
            cr.closePath();
            setSource(cr, color, FILL_ALPHA);
            cr.fill();

            trace();
            setSource(cr, color);
            cr.setLineWidth(STROKE);
            cr.setLineCap(Cairo.LineCap.ROUND);
            cr.setLineJoin(Cairo.LineJoin.ROUND);
            cr.stroke();
        }
        cr.$dispose();
    }
});
