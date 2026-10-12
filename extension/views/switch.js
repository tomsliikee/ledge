// The design system's Switch: a pill track with a round thumb.

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {colors} from '../lib/tokens.js';
import {Glide} from './motion.js';
import {setSource} from './paint.js';

const WIDTH = 52;
const HEIGHT = 32;
const THUMB_OFF = 8;
const THUMB_ON = 12;

export const Switch = GObject.registerClass(
class Switch extends St.DrawingArea {
    _init({theme, on}) {
        super._init({width: WIDTH, height: HEIGHT, y_align: Clutter.ActorAlign.CENTER});
        this._theme = theme;
        this._position = on ? 1 : 0;
        this._glide = new Glide(this, position => {
            this._position = position;
            this.queue_repaint();
        });
        this._glide.to(this._position);
        this.connect('repaint', () => this._draw());
        this.connect('destroy', () => this._glide.stop());
    }

    set(on) {
        this._glide.to(on ? 1 : 0);
    }

    _draw() {
        const cr = this.get_context();
        const palette = colors[this._theme];
        const on = this._position;
        const radius = HEIGHT / 2;

        cr.arc(WIDTH - radius, radius, radius, -Math.PI / 2, Math.PI / 2);
        cr.arc(radius, radius, radius, Math.PI / 2, 1.5 * Math.PI);
        cr.closePath();
        setSource(cr, palette['surface-container-highest']);
        cr.fillPreserve();
        setSource(cr, palette['primary'], on);
        cr.fill();

        // The thumb grows as it travels, as Material's does.
        const thumb = THUMB_OFF + (THUMB_ON - THUMB_OFF) * on;
        const x = radius + (WIDTH - HEIGHT) * on;
        setSource(cr, palette['outline']);
        cr.arc(x, radius, thumb, 0, 2 * Math.PI);
        cr.fillPreserve();
        setSource(cr, palette['on-primary'], on);
        cr.fill();
        cr.$dispose();
    }
});
