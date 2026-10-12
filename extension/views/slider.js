// The design system's slider: a thick track that is filled up to a handle
// bar, with a gap on either side of the handle. Dragged or turned with the
// wheel, it reports the new value.

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Glide, livelyEnabled} from './motion.js';
import {setSource, toneColor} from './paint.js';

const HEIGHT = 44;
const TRACK = 16;
const HANDLE = 4;
// The handle in the hand that drags it.
const HANDLE_HELD = 2;
const GAP = 6;
const REST_ALPHA = 0.26;
const WHEEL_STEP = 0.05;

function bar(cr, x, y, width, height, left, right) {
    if (width <= 0)
        return;
    const l = Math.min(left, width / 2, height / 2);
    const r = Math.min(right, width / 2, height / 2);
    cr.newSubPath();
    cr.arc(x + width - r, y + r, r, -Math.PI / 2, 0);
    cr.arc(x + width - r, y + height - r, r, 0, Math.PI / 2);
    cr.arc(x + l, y + height - l, l, Math.PI / 2, Math.PI);
    cr.arc(x + l, y + l, l, Math.PI, 1.5 * Math.PI);
    cr.closePath();
    cr.fill();
}

export const Slider = GObject.registerClass(
class Slider extends St.DrawingArea {
    // onChange is called with 0–1 while the handle is moved.
    _init({theme, accent = 'primary', onChange}) {
        super._init({
            height: HEIGHT,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            reactive: true,
            track_hover: true,
        });
        this._theme = theme;
        this._accent = accent;
        this._onChange = onChange;
        this._value = 0;
        this._dimmed = false;
        this._grab = null;
        this._held = 0;
        this._holding = new Glide(this, held => {
            this._held = held / 100;
            this.queue_repaint();
        }, {spring: 'fast'});
        this._holding.to(0);
        // A value set from outside glides there; one dragged follows the hand.
        this._glide = new Glide(this, value => {
            this._value = value / 100;
            this.queue_repaint();
        }, {origin: 0});
        this.connect('repaint', () => this._draw());
        this.connect('button-press-event', (_actor, event) => this._pressed(event));
        this.connect('motion-event', (_actor, event) => this._moved(event));
        this.connect('button-release-event', () => this._released());
        this.connect('scroll-event', (_actor, event) => this._scrolled(event));
        this.connect('destroy', () => {
            this._grab?.dismiss();
            this._holding.stop();
            this._glide.stop();
        });
    }

    // dimmed: shown as switched off, such as a muted volume.
    set(value, dimmed = false) {
        // Not under the hand that is dragging it.
        if (this._grab)
            return;
        this._dimmed = dimmed;
        this._glide.to(100 * Math.min(1, Math.max(0, value ?? 0)));
        this.queue_repaint();
    }

    replay() {
        if (!this._grab)
            this._glide.replay();
    }

    _hold(held) {
        if (livelyEnabled())
            this._holding.to(held ? 100 : 0);
    }

    _valueAt(event) {
        const [x] = event.get_coords();
        const [left] = this.get_transformed_position();
        const inset = HANDLE / 2 + GAP;
        return Math.min(1, Math.max(0, (x - left - inset) / (this.width - 2 * inset)));
    }

    _report(value) {
        this._glide.jump(100 * value);
        this._value = value;
        this.queue_repaint();
        this._onChange(value);
    }

    // The press stops here, so it neither drags the widget nor closes the
    // held widgets.
    _pressed(event) {
        if (event.get_button() !== Clutter.BUTTON_PRIMARY)
            return Clutter.EVENT_PROPAGATE;
        this._grab = global.stage.grab(this);
        this._hold(true);
        this._report(this._valueAt(event));
        return Clutter.EVENT_STOP;
    }

    _moved(event) {
        if (!this._grab)
            return Clutter.EVENT_PROPAGATE;
        this._report(this._valueAt(event));
        return Clutter.EVENT_STOP;
    }

    _released() {
        if (!this._grab)
            return Clutter.EVENT_PROPAGATE;
        this._grab.dismiss();
        this._grab = null;
        this._hold(false);
        return Clutter.EVENT_STOP;
    }

    _scrolled(event) {
        const direction = event.get_scroll_direction();
        let step = 0;
        if (direction === Clutter.ScrollDirection.UP)
            step = WHEEL_STEP;
        else if (direction === Clutter.ScrollDirection.DOWN)
            step = -WHEEL_STEP;
        else if (direction === Clutter.ScrollDirection.SMOOTH)
            step = -event.get_scroll_delta()[1] * WHEEL_STEP;
        if (step !== 0)
            this._report(Math.min(1, Math.max(0, this._value + step)));
        return Clutter.EVENT_STOP;
    }

    _draw() {
        const cr = this.get_context();
        const [width, height] = this.get_surface_size();
        const color = toneColor(this._theme, 'primary', this._accent);
        const inset = HANDLE / 2 + GAP;
        const handle = inset + Math.min(1, Math.max(0, this._value)) * (width - 2 * inset);
        const thick = HANDLE + (HANDLE_HELD - HANDLE) * this._held;
        const top = (height - TRACK) / 2;
        const round = TRACK / 2;
        // The filled part, with only a small rounding where it meets the handle.
        setSource(cr, color, this._dimmed ? REST_ALPHA * 2 : 1);
        bar(cr, 0, top, handle - HANDLE / 2 - GAP, TRACK, round, 2);
        setSource(cr, color, REST_ALPHA);
        const rest = handle + HANDLE / 2 + GAP;
        bar(cr, rest, top, width - rest, TRACK, 2, round);
        setSource(cr, color);
        bar(cr, handle - thick / 2, 0, thick, height, thick / 2, thick / 2);
        cr.$dispose();
    }
});
