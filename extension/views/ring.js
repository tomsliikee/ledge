// The design system's Ring: circular progress that starts at 12 o'clock and
// runs clockwise, with round caps.

import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Glide} from './motion.js';
import {fraction, setSource, toneColor} from './paint.js';
import {Waving} from './waving.js';

const TRACK_ALPHA = 0.22;
// A change of the value by less than this, in per cent, does not stir the ripple.
const STIRRING_CHANGE = 1;

export const Ring = GObject.registerClass(
class Ring extends St.DrawingArea {
    _init({size, stroke, theme, accent = 'primary', wavy = false}) {
        super._init({
            width: size,
            height: size,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._stroke = stroke;
        this._wavy = wavy;
        this._theme = theme;
        this._accent = accent;
        this._percent = null;
        this._tone = 'primary';
        // The ripple of a wavy ring; a plain ring has nothing that travels.
        this.wave = wavy ? new Waving(this, () => this.onMotionChange?.()) : null;
        // The ring fills from empty when it comes into view.
        this._glide = new Glide(this, value => {
            this._percent = value;
            this.queue_repaint();
        }, {origin: 0});
        this.connect('repaint', () => this._draw());
        this.connect('destroy', () => {
            this._glide.stop();
            this.wave?.stop();
        });
    }

    set(percent, tone) {
        const before = this._glide.target;
        this._tone = tone;
        this._glide.to(percent ?? null);
        // A ripple that runs already shows that its value is changing.
        if (!this.wave?.running && before !== null && Math.abs((percent ?? before) - before) >= STIRRING_CHANGE)
            this.wave?.stir();
        this.queue_repaint();
        this.onMotionChange?.();
    }

    replay() {
        this._glide.replay();
        this.wave?.replay();
    }

    // Only a wavy ring has something that moves on its own, and it does for
    // as long as it is seen. Asked of the value it is on its way to.
    moving() {
        return Boolean(this.wave?.moving) && this._glide.target > 0;
    }

    tick(seconds) {
        if (this.wave.tick(seconds))
            this.queue_repaint();
    }

    rest() {
        this.wave?.rest();
        this.queue_repaint();
    }

    setTheme(theme) {
        this._theme = theme;
        this.queue_repaint();
    }

    // The filled part as a wave around the circle, as the expressive look
    // draws progress.
    _wave(cr, cx, cy, radius, value) {
        // Shallow and close together, so it reads as a ring that ripples
        // and keeps clear of what is written inside.
        const waves = Math.max(8, Math.round(radius / 2.4));
        const amplitude = this._stroke * 0.2 * this.wave.swell;
        const end = value * 2 * Math.PI;
        cr.setLineJoin(Cairo.LineJoin.ROUND);
        for (let angle = 0; angle <= end; angle += 0.03) {
            const r = radius - amplitude + amplitude * Math.sin(waves * angle - this.wave.phase * 2 * Math.PI);
            const x = cx + r * Math.sin(angle);
            const y = cy - r * Math.cos(angle);
            if (angle === 0)
                cr.moveTo(x, y);
            else
                cr.lineTo(x, y);
        }
    }

    _draw() {
        const cr = this.get_context();
        const [width, height] = this.get_surface_size();
        const radius = (Math.min(width, height) - this._stroke) / 2;
        const start = -Math.PI / 2;

        // The ripple needs room inside the same footprint.
        cr.setLineWidth(this._wavy ? this._stroke * 0.75 : this._stroke);
        cr.setLineCap(Cairo.LineCap.ROUND);
        // The track is the value's own colour, held back, so the part that
        // is filled is always the stronger one.
        setSource(cr, toneColor(this._theme, this._tone, this._accent), TRACK_ALPHA);
        cr.arc(width / 2, height / 2, radius, 0, 2 * Math.PI);
        cr.stroke();

        // A spring may carry the value a little past full; the ring stops there.
        const value = fraction(this._percent);
        if (value > 0) {
            setSource(cr, toneColor(this._theme, this._tone, this._accent));
            if (this._wavy)
                this._wave(cr, width / 2, height / 2, radius, value);
            else
                cr.arc(width / 2, height / 2, radius, start, start + value * 2 * Math.PI);
            cr.stroke();
        }
        cr.$dispose();
    }
});
