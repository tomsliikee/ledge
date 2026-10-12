// A straight bar: a filled share of a track, or a span between two points
// of it (a day's lowest and highest temperature within the week's).

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Glide} from './motion.js';
import {setSource, toneColor} from './paint.js';

const HEIGHT = 8;
const TRACK_ALPHA = 0.22;

function pill(cr, x, width, height) {
    const radius = height / 2;
    const w = Math.max(width, height);
    cr.newSubPath();
    cr.arc(x + w - radius, radius, radius, -Math.PI / 2, Math.PI / 2);
    cr.arc(x + radius, radius, radius, Math.PI / 2, 1.5 * Math.PI);
    cr.closePath();
}

export const Meter = GObject.registerClass(
class Meter extends St.DrawingArea {
    _init({theme, accent = 'primary'}) {
        super._init({height: HEIGHT, x_expand: true, y_align: Clutter.ActorAlign.CENTER});
        this._theme = theme;
        this._accent = accent;
        this._from = 0;
        this._to = 0;
        this._tone = 'primary';
        // How much of the span is drawn yet: it grows from its start.
        this._grown = 1;
        this._glide = new Glide(this, grown => {
            this._grown = grown / 100;
            this.queue_repaint();
        }, {origin: 0});
        this.connect('repaint', () => this._draw());
        this.connect('destroy', () => this._glide.stop());
    }

    // from and to are shares of the track, 0–1.
    set(from, to, tone = 'primary') {
        this._from = from;
        this._to = to;
        this._tone = tone;
        this._glide.to(100);
        this.queue_repaint();
    }

    replay() {
        this._glide.replay();
    }

    _draw() {
        const cr = this.get_context();
        const [width, height] = this.get_surface_size();
        setSource(cr, toneColor(this._theme, this._tone, this._accent), TRACK_ALPHA);
        pill(cr, 0, width, height);
        cr.fill();
        if (this._to > this._from) {
            setSource(cr, toneColor(this._theme, this._tone, this._accent));
            const x = Math.min(this._from * width, width - height);
            const span = Math.min(width - x, (this._to - this._from) * width * this._grown);
            pill(cr, x, span, height);
            cr.fill();
        }
        cr.$dispose();
    }
});
