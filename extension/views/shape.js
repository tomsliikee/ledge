// The design system's ShapeBadge: a filled shape that carries a value. It
// grows more pronounced as the value grows, so a glance tells low from high
// before the number is read.

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Glide} from './motion.js';
import {setSource, toneColor} from './paint.js';

const TURN = 2 * Math.PI;

// A circle whose edge swells and dips: lobes of them, by depth as a share
// of the radius. Polar approximations of Material 3 Expressive's shapes.
export function scallop(cr, cx, cy, radius, lobes, depth, turn = 0) {
    for (let step = 0; step <= 180; step++) {
        const angle = (step / 180) * TURN;
        const r = radius * (1 - depth + depth * Math.cos(lobes * angle));
        const x = cx + r * Math.sin(angle + turn);
        const y = cy - r * Math.cos(angle + turn);
        if (step === 0)
            cr.moveTo(x, y);
        else
            cr.lineTo(x, y);
    }
    cr.closePath();
}

// Five steps from plain to pronounced, as [lobes, depth].
const MOODS = {
    // circle, 6-cookie, 9-cookie, sunny, very sunny
    radiant: [[0, 0], [6, 0.04], [9, 0.05], [8, 0.09], [12, 0.11]],
    // circle, 4-cookie, clover, 8-clover, flower
    soft: [[0, 0], [4, 0.06], [4, 0.11], [8, 0.08], [8, 0.13]],
};

export const ShapeBadge = GObject.registerClass(
class ShapeBadge extends St.DrawingArea {
    _init({size, theme, accent = 'primary', mood = 'radiant'}) {
        super._init({
            width: size,
            height: size,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._theme = theme;
        this._accent = accent;
        this._mood = mood;
        this._tone = 'primary';
        this._lobes = 0;
        this._depth = 0;
        this._color = null;
        // Only the depth glides; a change of the number of lobes shows by
        // the shape flattening and swelling again.
        this._glide = new Glide(this, depth => {
            this._depth = depth / 1000;
            this.queue_repaint();
        });
        this.connect('repaint', () => this._draw());
        this.connect('destroy', () => this._glide.stop());
    }

    // level: 0–1, which of the five steps. tone: "primary", "warn" or "bad".
    set(level, tone = 'primary') {
        const steps = MOODS[this._mood];
        const step = steps[Math.min(steps.length - 1, Math.max(0, Math.floor((level ?? 0) * steps.length)))];
        this._tone = tone;
        this._lobes = step[0];
        this._glide.to(step[1] * 1000);
        this.queue_repaint();
    }

    // A fixed colour instead of a tone, such as the sun's.
    setColor(hex) {
        this._color = hex;
        this.queue_repaint();
    }

    _draw() {
        const cr = this.get_context();
        const [width, height] = this.get_surface_size();
        setSource(cr, this._color ?? toneColor(this._theme, this._tone, this._accent));
        scallop(cr, width / 2, height / 2, Math.min(width, height) / 2, this._lobes, this._depth);
        cr.fill();
        cr.$dispose();
    }
});
