// The design system's WavyProgress: a wave for what is used, a straight
// track for what remains and a stop dot at the end.

import Cairo from 'cairo';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Glide} from './motion.js';
import {fraction, setSource, toneColor} from './paint.js';

const AMPLITUDE = 3;
const WAVELENGTH = 19;
const STROKE = 4;
const GAP = 9;
const TRACK_ALPHA = 0.22;
const HEIGHT = 2 * AMPLITUDE + STROKE + 2;
// Wavelengths a second: while what it shows is running, and while idle.
const RUNNING_SPEED = 1.1;
const IDLE_SPEED = 0.35;

export const WavyProgress = GObject.registerClass(
class WavyProgress extends St.DrawingArea {
    _init({theme, accent = 'primary'}) {
        super._init({height: HEIGHT, x_expand: true});
        this._theme = theme;
        this._accent = accent;
        this._percent = null;
        this._tone = 'primary';
        this._phase = 0;
        this._running = false;
        this._swell = 1;
        this._tickedAt = null;
        this._glide = new Glide(this, value => {
            this._percent = value;
            this.queue_repaint();
        }, {origin: 0});
        // The wave lies flat while what it shows stands still.
        this._swelling = new Glide(this, swell => {
            this._swell = swell / 100;
            this.queue_repaint();
        }, {spring: 'slow'});
        this._swelling.to(100);
        this.connect('repaint', () => this._draw());
        this.connect('destroy', () => {
            this._glide.stop();
            this._swelling.stop();
        });
    }

    set(percent, tone) {
        this._tone = tone;
        this._glide.to(percent ?? null);
        this.queue_repaint();
        this.onMotionChange?.();
    }

    replay() {
        this._glide.replay();
    }

    // running: what the wave shows is going on right now, so it travels.
    setRunning(running) {
        if (running === this._running)
            return;
        this._running = running;
        this.onMotionChange?.();
    }

    // flat: a straight line instead of a wave, for what is paused.
    setFlat(flat) {
        this._swelling.to(flat ? 0 : 100);
    }

    moving(ambient) {
        return this._percent > 0 && (this._running || ambient);
    }

    tick(seconds) {
        const passed = this._tickedAt === null ? 0 : Math.min(0.1, seconds - this._tickedAt);
        this._tickedAt = seconds;
        this._phase = (this._phase + passed * (this._running ? RUNNING_SPEED : IDLE_SPEED)) % 1;
        this.queue_repaint();
    }

    rest() {
        this._tickedAt = null;
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
            const shift = this._phase * WAVELENGTH;
            for (let x = left; x <= end; x += 1) {
                const y = middle + AMPLITUDE * this._swell * Math.sin(((x - left - shift) / WAVELENGTH) * 2 * Math.PI);
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
