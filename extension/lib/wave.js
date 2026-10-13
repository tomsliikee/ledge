// How a wave that shows a value moves: how far it has travelled, and how
// high it stands. Shared by the wavy line and the wavy ring.

// Wavelengths a second: while nothing happens, and while what the wave
// shows is going on right now.
export const IDLE_SPEED = 0.35;
export const RUNNING_SPEED = 1.1;
// A wave that was stirred travels this many times faster on top of its
// speed, and stands this much higher, before it calms down again.
const STIR_SPEED = 2;
const STIR_SWELL = 0.25;
// An urgent wave sinks to this share of its height and comes back, once in
// this many seconds.
const URGENT_LOW = 0.5;
const URGENT_SECONDS = 1.2;
// No wave stands higher than this share of its height: the room it is drawn
// in is no larger.
export const HIGHEST_SWELL = 1.3;

// The phase (0–1 of a wavelength) after some seconds have passed.
//   running: what the wave shows is going on right now.
//   direction: 1 travels forward, -1 back.
//   stir: 0–1, how much is left of a stir.
export function advance(phase, passed, {running = false, direction = 1, stir = 0} = {}) {
    const speed = (running ? RUNNING_SPEED : IDLE_SPEED) * (1 + STIR_SPEED * Math.max(0, stir));
    const next = (phase + direction * passed * speed) % 1;
    return next < 0 ? next + 1 : next;
}

// The share of its height the wave stands at.
//   swell: 0 lies flat, 1 is the full wave; a spring may carry it past both.
//   beat: seconds since an urgent wave began to pulse.
export function swellOf({swell = 1, stir = 0, urgent = false, beat = 0} = {}) {
    const pulse = urgent
        ? 1 - (1 - URGENT_LOW) * (0.5 - 0.5 * Math.cos((beat / URGENT_SECONDS) * 2 * Math.PI))
        : 1;
    return Math.min(HIGHEST_SWELL, Math.max(0, swell * pulse * (1 + STIR_SWELL * Math.max(0, stir))));
}
