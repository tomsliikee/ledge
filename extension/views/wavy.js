// The design system's WavyProgress: a wave for what is used, a straight
// track for what remains and a stop dot at the end.

import Cairo from 'cairo';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Glide} from './motion.js';
import {fraction, setSource, toneColor} from './paint.js';
import {Waving} from './waving.js';

const AMPLITUDE = 3;
const WAVELENGTH = 19;
const STROKE = 4;
const GAP = 9;
const TRACK_ALPHA = 0.22;
const HEIGHT = 2 * AMPLITUDE + STROKE + 2;
// A change of the value by less than this, in per cent, does not stir the wave.
const STIRRING_CHANGE = 1;

export const WavyProgress = GObject.registerClass(
class WavyProgress extends St.DrawingArea {
    _init({theme, accent = 'primary'}) {
        super._init({height: HEIGHT, x_expand: true});
        this._theme = theme;
        this._accent = accent;
        this._percent = null;
        this._tone = 'primary';
        this._glide = new Glide(this, value => {
            this._percent = value;
            this.queue_repaint();
        }, {origin: 0});
        this.wave = new Waving(this, () => this.onMotionChange?.());
        this.connect('repaint', () => this._draw());
        this.connect('destroy', () => {
            this._glide.stop();
            this.wave.stop();
        });
    }

    set(percent, tone) {
        const before = this._glide.target;
        this._tone = tone;
        this._glide.to(percent ?? null);
        // A wave that runs already shows that its value is changing.
        if (!this.wave.running && before !== null && Math.abs((percent ?? before) - before) >= STIRRING_CHANGE)
            this.wave.stir();
        this.queue_repaint();
        this.onMotionChange?.();
    }

    replay() {
        this._glide.replay();
        this.wave.replay();
    }

    // running: what the wave shows is going on right now, so it travels faster.
    setRunning(running) {
        this.wave.setRunning(running);
    }

    // flat: a straight line instead of a wave, for what is paused.
    setFlat(flat) {
        this.wave.setFlat(flat);
    }

    // A wave with something to show travels for as long as it is seen. Asked
    // of the value it is on its way to: one that fills from nothing is at
    // nothing when it is first asked.
    moving() {
        return this._glide.target > 0 && this.wave.moving;
    }

    tick(seconds) {
        if (this.wave.tick(seconds))
            this.queue_repaint();
    }

    rest() {
        this.wave.rest();
        this.queue_repaint();
    }

    setTheme(theme) {
        this._theme = theme;
        this.queue_repaint();
    }

    _draw() {
        const cr = this.get_context();
        const [width, height] = this.get_surface_size();
        const color = toneColor(this._theme, this._tone, this._accent);
        const middle = height / 2;
        const left = STROKE / 2;
        const right = width - STROKE / 2;
        const end = left + fraction(this._percent) * (right - left);

        cr.setLineWidth(STROKE);
        cr.setLineCap(Cairo.LineCap.ROUND);
        cr.setLineJoin(Cairo.LineJoin.ROUND);

        if (end > left) {
            setSource(cr, color);
            const shift = this.wave.phase * WAVELENGTH;
            const amplitude = AMPLITUDE * this.wave.swell;
            for (let x = left; x <= end; x += 1) {
                const y = middle + amplitude * Math.sin(((x - left - shift) / WAVELENGTH) * 2 * Math.PI);
                if (x === left)
                    cr.moveTo(x, y);
                else
                    cr.lineTo(x, y);
            }
            cr.stroke();
        }

        const trackStart = end > left ? end + GAP : left;
        if (trackStart < right) {
            setSource(cr, color, TRACK_ALPHA);
            cr.moveTo(trackStart, middle);
            cr.lineTo(right, middle);
            cr.stroke();

            setSource(cr, color);
            cr.arc(right, middle, STROKE / 2, 0, 2 * Math.PI);
            cr.fill();
        }
        cr.$dispose();
    }
});
