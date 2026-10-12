// Where a dropped widget comes to rest: on a fine grid, or flush with a
// neighbour when one of its edges is near.

import {GAP, clamp} from './layout.js';

export const GRID = 8;
const NEAR = 12;

// The positions along one axis that would line the widget up with another:
// same start, same end, or one gap after or before it.
function neighbourStops(length, other) {
    return [
        other.start,
        other.start + other.length - length,
        other.start + other.length + GAP,
        other.start - GAP - length,
    ];
}

function snapAxis(position, length, others) {
    let best = null;
    for (const other of others) {
        for (const stop of neighbourStops(length, other)) {
            const distance = Math.abs(stop - position);
            if (distance <= NEAR && (best === null || distance < Math.abs(best - position)))
                best = stop;
        }
    }
    return best ?? Math.round(position / GRID) * GRID;
}

// A neighbour only pulls when it is beside the widget on the other axis;
// one at the far end of the screen should not.
function beside(aStart, aLength, bStart, bLength) {
    return aStart < bStart + bLength + 2 * GAP && bStart < aStart + aLength + 2 * GAP;
}

export function snap(rect, others, bounds) {
    const x = snapAxis(rect.x, rect.width, others
        .filter(o => beside(rect.y, rect.height, o.y, o.height))
        .map(o => ({start: o.x, length: o.width})));
    const y = snapAxis(rect.y, rect.height, others
        .filter(o => beside(rect.x, rect.width, o.x, o.width))
        .map(o => ({start: o.y, length: o.height})));
    return clamp({...rect, x, y}, bounds);
}
