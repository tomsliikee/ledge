// The design system's Ring: circular progress that starts at 12 o'clock and
// runs clockwise, with round caps.

import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {fraction, setSource, toneColor} from './paint.js';

const TRACK_ALPHA = 0.22;

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
        this.connect('repaint', () => this._draw());
    }

    set(percent, tone) {
        this._percent = percent;
        this._tone = tone;
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
        const amplitude = this._stroke * 0.2;
        const end = value * 2 * Math.PI;
        cr.setLineJoin(Cairo.LineJoin.ROUND);
        for (let angle = 0; angle <= end; angle += 0.03) {
            const r = radius - amplitude + amplitude * Math.sin(waves * angle);
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
