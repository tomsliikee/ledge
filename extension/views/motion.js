// One way to animate. Nothing moves when the desktop has animations
// switched off, or when they are switched off in Ledge's own settings.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

export const HOVER_MS = 120;
export const STATE_MS = 200;
export const LAYOUT_MS = 320;

// In the units of what glides: per cent of a ring.
const SMALLEST_GLIDE = 2;

let wanted = true;

export function setMotion(enabled) {
    wanted = enabled;
}

export function motionEnabled() {
    return wanted && St.Settings.get().enable_animations;
}

// Calls onProgress with 0–1 and returns the running timeline, or null when
// the value was set at once.
export function animate(actor, duration, onProgress) {
    // A timeline needs a stage to take its frame clock from.
    if (!motionEnabled() || !actor.get_stage()) {
        onProgress(1);
        return null;
    }
    const timeline = new Clutter.Timeline({actor, duration});
    timeline.set_progress_mode(Clutter.AnimationMode.EASE_OUT_CUBIC);
    timeline.connect('new-frame', () => onProgress(timeline.get_progress()));
    timeline.connect('completed', () => onProgress(1));
    timeline.start();
    return timeline;
}

// Lets a drawn number glide to its new value instead of jumping there.
export class Glide {
    constructor(actor, apply) {
        this._actor = actor;
        this._apply = apply;
        this._value = null;
        this._timeline = null;
    }

    to(value) {
        this._timeline?.stop();
        const from = this._value;
        // The first value has nowhere to come from.
        // Nor is a change too small to see worth a second of redrawing.
        if (from === null || value === null || Math.abs(value - from) < SMALLEST_GLIDE) {
            this._value = value;
            this._apply(value);
            return;
        }
        this._timeline = animate(this._actor, LAYOUT_MS, progress => {
            this._value = from + (value - from) * progress;
            this._apply(this._value);
        });
    }

    stop() {
        this._timeline?.stop();
        this._timeline = null;
    }
}

// Eases an actor's own properties, or sets them at once without motion.
export function ease(actor, properties, duration = STATE_MS, mode = Clutter.AnimationMode.EASE_OUT_CUBIC) {
    if (!motionEnabled()) {
        const {onComplete, delay: _delay, ...values} = properties;
        actor.remove_all_transitions();
        actor.set(values);
        onComplete?.();
        return;
    }
    actor.ease({...properties, duration, mode});
}
