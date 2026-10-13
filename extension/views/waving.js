// The life of a wave that shows a value: it travels for as long as it is
// seen, swells when it comes into view, is stirred by a change and pulses
// when what it shows is urgent. The marks that draw a wave share it.

import {advance, swellOf} from '../lib/wave.js';
import {Glide, livelyEnabled} from './motion.js';

// A calm wave travels a fraction of a pixel in a frame, so it is drawn half
// as often as one that runs: redrawing is what moving costs. The slack
// keeps a frame that comes a little early from being left out.
const CALM_FRAME_SECONDS = 1 / 15;
const SLACK_SECONDS = 0.004;

export class Waving {
    // onChange: called when whether the wave travels may have changed.
    constructor(actor, onChange) {
        this._onChange = onChange;
        this.phase = 0;
        this._running = false;
        this._direction = 1;
        this._urgent = false;
        this._flat = false;
        this._swell = 1;
        this._stir = 0;
        this._beat = 0;
        this._tickedAt = null;
        this._swelling = new Glide(actor, swell => {
            this._swell = swell / 100;
            actor.queue_repaint();
        }, {origin: 0});
        this._swelling.to(100);
        this._stirring = new Glide(actor, stir => {
            this._stir = stir / 100;
            actor.queue_repaint();
        }, {spring: 'calm', livelyOnly: true});
    }

    // running: what the wave shows is going on right now, so it travels faster.
    setRunning(running) {
        this._running = running;
    }

    // 1 travels forward, as something that fills; -1 back, as it drains.
    setDirection(direction) {
        this._direction = direction;
    }

    // urgent: the wave sinks and rises, for a value that needs attention.
    setUrgent(urgent) {
        this._urgent = urgent;
        if (!urgent)
            this._beat = 0;
    }

    // flat: a straight line that stands still, for what is paused.
    setFlat(flat) {
        if (flat === this._flat)
            return;
        this._flat = flat;
        this._swelling.to(flat ? 0 : 100);
        this._onChange();
    }

    // Something has just happened to what the wave shows: it hurries and
    // stands higher for a moment.
    stir() {
        if (!livelyEnabled())
            return;
        this._stirring.jump(100);
        this._stirring.to(0);
    }

    replay() {
        this._swelling.replay();
    }

    get running() {
        return this._running;
    }

    get moving() {
        return !this._flat;
    }

    // The share of its height the wave stands at right now.
    get swell() {
        return swellOf({swell: this._swell, stir: this._stir, urgent: this._urgent, beat: this._beat});
    }

    // Returns whether the wave has moved and wants to be drawn.
    tick(seconds) {
        const calm = !this._running && !this._urgent && this._stir === 0;
        if (calm && this._tickedAt !== null && seconds - this._tickedAt < CALM_FRAME_SECONDS - SLACK_SECONDS)
            return false;
        // A frame that comes late must not make the wave leap.
        const passed = this._tickedAt === null ? 0 : Math.min(0.1, seconds - this._tickedAt);
        this._tickedAt = seconds;
        this.phase = advance(this.phase, passed, {running: this._running, direction: this._direction, stir: this._stir});
        if (this._urgent)
            this._beat += passed;
        return true;
    }

    // The frames have stopped: an urgent wave stands at its full height.
    rest() {
        this._tickedAt = null;
        this._beat = 0;
    }

    stop() {
        this._swelling.stop();
        this._stirring.stop();
    }
}
