// A small line of the last readings, with a soft fill beneath it.

import Cairo from 'cairo';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {colors} from '../lib/tokens.js';
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
        this.connect('repaint', () => this._draw());
    }

    set(values, tone = 'primary') {
        this._values = values;
        this._tone = tone;
        this.queue_repaint();
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
            const max = this._max ?? Math.max(1, ...values);
            const step = width / (values.length - 1);
            const y = value => bottom - Math.min(1, Math.max(0, value / max)) * (height - STROKE);
            const trace = () => {
                values.forEach((value, i) => {
                    if (i === 0)
                        cr.moveTo(0, y(value));
                    else
                        cr.lineTo(i * step, y(value));
                });
            };
            const color = toneColor(this._theme, this._tone, this._accent);

            trace();
            cr.lineTo(width, height);
            cr.lineTo(0, height);
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
