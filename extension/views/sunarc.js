// The sun's way across the day: an arc from rising to setting, with the
// sun on it where it stands now.

import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {colors} from '../lib/tokens.js';
import {Glide} from './motion.js';
import {setSource} from './paint.js';

const STROKE = 4;
const SUN = 9;
const TRACK_ALPHA = 0.22;
// The glow around the sun: how far it reaches and how long one breath takes.
const GLOW = 5;
const GLOW_ALPHA = 0.3;
const BREATH_SECONDS = 5;

export const SunArc = GObject.registerClass(
class SunArc extends St.DrawingArea {
    _init({theme, accent = 'primary', height}) {
        super._init({x_expand: true, height, y_align: Clutter.ActorAlign.CENTER});
        this._theme = theme;
        this._accent = accent;
        this._progress = null;
        this._breath = 0;
        this._glide = new Glide(this, share => {
            this._progress = share === null ? null : share / 100;
            this.queue_repaint();
        }, {origin: 0, spring: 'slow', least: 0.5});
        this.connect('repaint', () => this._draw());
        this.connect('destroy', () => this._glide.stop());
    }

    // progress: 0 at sunrise, 1 at sunset, null at night.
    set(progress) {
        this._glide.to(progress === null ? null : 100 * progress);
        this.queue_repaint();
        this.onMotionChange?.();
    }

    replay() {
        this._glide.replay();
    }

    moving(ambient) {
        return ambient && this._progress !== null;
    }

    tick(seconds) {
        this._breath = 0.5 - 0.5 * Math.cos((seconds / BREATH_SECONDS) * 2 * Math.PI);
        this.queue_repaint();
    }

    rest() {
        this._breath = 0;
        this.queue_repaint();
    }

    _draw() {
        const cr = this.get_context();
        const [width, height] = this.get_surface_size();
        const palette = colors[this._theme];
        const horizon = height - SUN - 2;
        const radiusX = width / 2 - SUN - 2;
        // Never taller than a half circle, however high the widget is.
        const radiusY = Math.min(horizon - SUN - 2, radiusX);
        const point = share => {
            const angle = Math.PI * (1 - share);
            return [width / 2 + Math.cos(angle) * radiusX, horizon - Math.sin(angle) * radiusY];
        };
        const trace = (from, to) => {
            for (let share = from; share <= to + 0.0001; share += 0.02) {
                const [x, y] = point(Math.min(share, to));
                if (share === from)
                    cr.moveTo(x, y);
                else
                    cr.lineTo(x, y);
            }
        };

        cr.setLineWidth(STROKE);
        cr.setLineCap(Cairo.LineCap.ROUND);
        cr.setLineJoin(Cairo.LineJoin.ROUND);
        setSource(cr, palette[this._accent], TRACK_ALPHA);
        trace(0, 1);
        cr.stroke();

        setSource(cr, palette['outline-variant']);
        cr.setLineWidth(1);
        cr.moveTo(0, horizon + 0.5);
        cr.lineTo(width, horizon + 0.5);
        cr.stroke();

        if (this._progress !== null) {
            cr.setLineWidth(STROKE);
            setSource(cr, palette[this._accent]);
            // A spring may carry the sun a little past where it stands.
            const share = Math.min(1, Math.max(0, this._progress));
            trace(0, share);
            cr.stroke();
            const [x, y] = point(share);
            if (this._breath > 0) {
                setSource(cr, palette['illustration-sun'], GLOW_ALPHA * (1 - this._breath));
                cr.arc(x, y, SUN + GLOW * this._breath, 0, 2 * Math.PI);
                cr.fill();
            }
            setSource(cr, palette['illustration-sun']);
            cr.arc(x, y, SUN, 0, 2 * Math.PI);
            cr.fill();
        }
        cr.$dispose();
    }
});
