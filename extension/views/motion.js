// One way to animate. Nothing moves when the desktop has animations
// switched off, or when they are switched off in Ledge's own settings.
//
// There are three steps of it. Motion: things glide instead of jumping.
// Lively: they move on springs, fill up when they come into view and answer
// a press. Ambient: shapes and waves keep moving while nothing happens.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {SPRINGS, countBetween, settleMs, springAt} from '../lib/spring.js';

export const HOVER_MS = 120;
export const STATE_MS = 200;
export const LAYOUT_MS = 320;

// In the units of what glides: per cent of a ring.
const SMALLEST_GLIDE = 2;
// How far a label travels when its content rolls over, as a share of its height.
const ROLL = 0.35;
const PRESSED_SCALE = 0.9;

let wanted = true;
let lively = true;
let ambient = true;

export function setMotion(options) {
    wanted = options.enabled;
    lively = options.lively;
    ambient = options.ambient;
}

export function motionEnabled() {
    return wanted && St.Settings.get().enable_animations;
}

export function livelyEnabled() {
    return lively && motionEnabled();
}

export function ambientEnabled() {
    return ambient && livelyEnabled();
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

// Like animate, on a spring: onShare is called with the share of the way,
// which a spatial spring takes past 1 before it settles there.
export function spring(actor, name, onShare) {
    if (!livelyEnabled() || !actor.get_stage()) {
        onShare(1);
        return null;
    }
    const kind = SPRINGS[name];
    const timeline = new Clutter.Timeline({actor, duration: settleMs(kind)});
    timeline.set_progress_mode(Clutter.AnimationMode.LINEAR);
    timeline.connect('new-frame', () => onShare(springAt(timeline.get_elapsed_time() / 1000, kind)));
    timeline.connect('completed', () => onShare(1));
    timeline.start();
    return timeline;
}

// Lets a drawn number glide to its new value instead of jumping there.
//   spring: the spring it moves on in the lively step.
//   origin: where the first value comes from in the lively step; without
//           one the first value has nowhere to come from and is set at once.
//   least: a change smaller than this is not worth a second of redrawing.
//   livelyOnly: without the lively step the value is set at once.
export class Glide {
    constructor(actor, apply, {spring: name = 'bouncy', origin = null, least = SMALLEST_GLIDE, livelyOnly = false} = {}) {
        this._livelyOnly = livelyOnly;
        this._actor = actor;
        this._apply = apply;
        this._spring = name;
        this._origin = origin;
        this._least = least;
        this._value = null;
        this._target = null;
        this._timeline = null;
    }

    to(value) {
        // The same reading again must not cut short the way to it.
        if (value === this._target && this._timeline?.is_playing())
            return;
        this._timeline?.stop();
        this._timeline = null;
        this._target = value;
        let from = this._value;
        if (from === null && value !== null && this._origin !== null && livelyEnabled())
            from = this._origin;
        const still = this._livelyOnly && !livelyEnabled();
        if (still || from === null || value === null || Math.abs(value - from) < this._least) {
            this._value = value;
            this._apply(value);
            return;
        }
        this._run(from, value);
    }

    // Takes a value that was set by other means, without moving to it.
    jump(value) {
        this.stop();
        this._value = value;
        this._target = value;
    }

    get target() {
        return this._target;
    }

    // Once more from the origin, for a mark that comes into view.
    replay() {
        if (this._target === null || this._origin === null || !livelyEnabled())
            return;
        this._timeline?.stop();
        this._run(this._origin, this._target);
    }

    _run(from, value) {
        const step = share => {
            this._value = from + (value - from) * share;
            this._apply(this._value);
        };
        // Shown at its start before the first frame, so nothing flashes at
        // the value it is about to leave.
        step(0);
        this._timeline = livelyEnabled()
            ? spring(this._actor, this._spring, step)
            : animate(this._actor, LAYOUT_MS, step);
    }

    stop() {
        this._timeline?.stop();
        this._timeline = null;
    }
}

function stopSpring(actor) {
    actor._lgSpring?.stop();
    actor._lgSpring = null;
}

// Eases an actor's own properties, or sets them at once without motion.
export function ease(actor, properties, duration = STATE_MS, mode = Clutter.AnimationMode.EASE_OUT_CUBIC) {
    stopSpring(actor);
    if (!motionEnabled()) {
        const {onComplete, delay: _delay, ...values} = properties;
        actor.remove_all_transitions();
        actor.set(values);
        onComplete?.();
        return;
    }
    actor.ease({...properties, duration, mode});
}

// Moves an actor's own properties on a spring. Opacity takes the effect
// spring, which never passes its target. Without the lively step this is
// ease() with the given duration and mode.
export function springTo(actor, properties, name = 'spatial', duration = STATE_MS, mode = Clutter.AnimationMode.EASE_OUT_CUBIC) {
    if (!livelyEnabled() || !actor.get_stage()) {
        ease(actor, properties, duration, mode);
        return;
    }
    stopSpring(actor);
    actor.remove_all_transitions();
    const {onComplete, ...targets} = properties;
    const kind = SPRINGS[name];
    const from = {};
    for (const key of Object.keys(targets))
        from[key] = actor[key];
    const at = (spatial, effect) => {
        for (const [key, target] of Object.entries(targets)) {
            if (key === 'opacity')
                actor.opacity = Math.round(from.opacity + (target - from.opacity) * effect);
            else
                actor[key] = from[key] + (target - from[key]) * spatial;
        }
    };
    const timeline = new Clutter.Timeline({actor, duration: settleMs(kind)});
    timeline.set_progress_mode(Clutter.AnimationMode.LINEAR);
    timeline.connect('new-frame', () => {
        const seconds = timeline.get_elapsed_time() / 1000;
        at(springAt(seconds, kind), springAt(seconds, SPRINGS.effect));
    });
    timeline.connect('completed', () => {
        at(1, 1);
        if (actor._lgSpring === timeline)
            actor._lgSpring = null;
        onComplete?.();
    });
    if (!actor._lgSpringGuard) {
        actor._lgSpringGuard = actor.connect('destroy', () => stopSpring(actor));
    }
    actor._lgSpring = timeline;
    timeline.start();
}

// A short swell from a smaller size, for something that has just changed.
export function pop(actor, from = 0.7, name = 'fast') {
    if (!livelyEnabled() || !actor.get_stage())
        return;
    actor.set_pivot_point(0.5, 0.5);
    actor.set({scale_x: from, scale_y: from});
    springTo(actor, {scale_x: 1, scale_y: 1}, name);
}

// Lets a button give way under the press and spring back.
export function pressable(button, depth = PRESSED_SCALE) {
    button.set_pivot_point(0.5, 0.5);
    button.connect('notify::pressed', () => {
        if (!livelyEnabled())
            return;
        if (button.pressed)
            ease(button, {scale_x: depth, scale_y: depth}, HOVER_MS);
        else
            springTo(button, {scale_x: 1, scale_y: 1}, 'fast');
    });
}

// Sets a label to a reading, counting up to its number in the lively step.
// The label counts once more from nothing when its tile comes into view.
export function count(label, content) {
    const from = label._lgShown ?? '';
    label._lgShown = content;
    label._lgCount?.stop();
    label._lgCount = null;
    if (!label.replay) {
        label.replay = () => run('');
        label.connect('destroy', () => label._lgCount?.stop());
    }
    function run(start) {
        label._lgCount?.stop();
        const target = label._lgShown;
        label._lgCount = spring(label, 'effectSlow', share => {
            label.text = countBetween(start, target, share);
        });
    }
    if (from === content)
        label.text = content;
    else
        run(from);
}

// Sets a label to new content by letting the old roll out upwards and the
// new come up from below, as the digits of a clock do.
export function roll(label, content) {
    if (label.text === content)
        return;
    if (!livelyEnabled() || !label.get_stage() || label.text === '') {
        label.text = content;
        return;
    }
    const rise = Math.max(4, label.height * ROLL);
    ease(label, {
        opacity: 0, translation_y: -rise,
        onComplete: () => {
            label.text = content;
            label.translation_y = rise;
            springTo(label, {opacity: 255, translation_y: 0}, 'fast');
        },
    }, HOVER_MS, Clutter.AnimationMode.EASE_IN_CUBIC);
}
