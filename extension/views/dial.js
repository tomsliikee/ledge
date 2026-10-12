// A clock face with hands.

import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {colors} from '../lib/tokens.js';
import {Glide} from './motion.js';
import {setSource} from './paint.js';
import {scallop} from './shape.js';

const TURN = 2 * Math.PI;
// The scalloped face left to itself takes this long for one turn.
const FACE_SECONDS = 90;

export const Dial = GObject.registerClass(
class Dial extends St.DrawingArea {
    _init({size, theme, accent = 'primary', expressive = false}) {
        super._init({width: size, height: size, x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER});
        this._theme = theme;
        this._accent = accent;
        this._expressive = expressive;
        this._hours = 0;
        this._minutes = 0;
        this._seconds = null;
        this._face = 0;
        // Where the second hand points, counted on past the minute so it
        // never runs backwards; it ticks to each second on a spring.
        this._hand = null;
        this._ticking = new Glide(this, hand => {
            this._hand = hand;
            this.queue_repaint();
        }, {spring: 'fast', least: 0, livelyOnly: true});
        this.connect('repaint', () => this._draw());
        this.connect('destroy', () => this._ticking.stop());
    }

    // seconds: null draws no second hand.
    set(hours, minutes, seconds = null) {
        this._hours = hours;
        this._minutes = minutes;
        if (seconds === null) {
            this._ticking.to(null);
        } else if (seconds !== this._seconds) {
            const last = this._ticking.target;
            const step = last === null ? seconds : (seconds - last % 60 + 60) % 60;
            // A jump of the clock is shown, not swept through.
            if (last !== null && step > 2)
                this._ticking.to(null);
            this._ticking.to(last === null || step > 2 ? seconds : last + step);
        }
        this._seconds = seconds;
        this.queue_repaint();
    }

    // Only the scalloped face shows that it turns.
    moving(ambient) {
        return ambient && this._expressive;
    }

    tick(seconds) {
        this._face = (seconds / FACE_SECONDS) % 1;
        this.queue_repaint();
    }

    _drawHand(cr, center, turn, length, stroke, color) {
        const angle = turn * TURN - Math.PI / 2;
        setSource(cr, color);
        cr.setLineWidth(stroke);
        cr.moveTo(center, center);
        cr.lineTo(center + Math.cos(angle) * length, center + Math.sin(angle) * length);
        cr.stroke();
    }

    _draw() {
        const cr = this.get_context();
        const [width] = this.get_surface_size();
        const palette = colors[this._theme];
        const center = width / 2;
        const radius = width / 2;
        // Everything is a share of the face, so one drawing serves every size.
        const unit = width / 128;

        let hand = palette['on-surface'];
        let second = palette['primary'];
        if (this._expressive) {
            // A scalloped face in the tile's tone, with the hands in its
            // on-colour and nothing else on it.
            hand = palette[`on-${this._accent}`];
            second = palette[`${this._accent}-container`];
            setSource(cr, palette[this._accent]);
            scallop(cr, center, center, radius, 12, 0.04, this._face * TURN);
            cr.fill();
        } else {
            setSource(cr, palette['surface-bright']);
            cr.arc(center, center, radius, 0, TURN);
            cr.fill();

            for (let i = 0; i < 12; i++) {
                const quarter = i % 3 === 0;
                const angle = (i / 12) * TURN;
                const distance = radius - 11 * unit;
                setSource(cr, palette[quarter ? 'on-surface' : 'outline-variant']);
                cr.arc(center + Math.sin(angle) * distance, center - Math.cos(angle) * distance,
                    (quarter ? 2.5 : 1.75) * unit, 0, TURN);
                cr.fill();
            }
        }

        cr.setLineCap(Cairo.LineCap.ROUND);
        const minutes = this._minutes + (this._seconds ?? 0) / 60;
        this._drawHand(cr, center, ((this._hours % 12) + minutes / 60) / 12, radius * 0.5, 7 * unit, hand);
        this._drawHand(cr, center, minutes / 60, radius * 0.74, 4.5 * unit, hand);
        if (this._hand !== null)
            this._drawHand(cr, center, this._hand / 60, radius * 0.78, 1.75 * unit, second);

        setSource(cr, second);
        cr.arc(center, center, 4 * unit, 0, TURN);
        cr.fill();
        cr.$dispose();
    }
});
