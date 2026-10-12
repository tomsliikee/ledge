// Where the widgets lie. A widget is
//   {id, type, size, enabled, placed, monitor, x, y, options, stack, top}
// with x and y in pixels from the top left of its monitor's work area and
// monitor as the connector name ("eDP-1"), so a layout survives a monitor
// that comes and goes. placed is false for a widget that was added where
// the screen is not known (the settings window); the shell then finds it a
// free spot. stack and top are set on widgets that share a place; see
// stack.js.

import {tidy} from './stack.js';

const UNIT = 160;
export const GAP = 16;
export const MARGIN = 24;

export const SIZES = {
    small: {width: UNIT, height: UNIT},
    medium: {width: 2 * UNIT + GAP, height: UNIT},
    large: {width: 2 * UNIT + GAP, height: 2 * UNIT + GAP},
};

export function rectOf(widget) {
    return {x: widget.x, y: widget.y, ...SIZES[widget.size]};
}

// types maps a type name to the sizes it offers. Entries of a type this
// version does not know are dropped; a size it does not offer falls back
// to the type's first.
export function parseLayout(text, types) {
    let list;
    try {
        list = JSON.parse(text);
    } catch {
        return [];
    }
    if (!Array.isArray(list))
        return [];
    const seen = new Set();
    return tidy(list.filter(w => w && typeof w.id === 'string' && types[w.type] && !seen.has(w.id) && seen.add(w.id))
        .map(w => ({
            id: w.id,
            type: w.type,
            size: types[w.type].includes(w.size) ? w.size : types[w.type][0],
            enabled: w.enabled !== false,
            placed: w.placed !== false,
            monitor: typeof w.monitor === 'string' ? w.monitor : null,
            x: Number.isFinite(w.x) ? w.x : MARGIN,
            y: Number.isFinite(w.y) ? w.y : MARGIN,
            options: w.options && typeof w.options === 'object' ? w.options : {},
            stack: typeof w.stack === 'string' ? w.stack : null,
            top: w.top === true,
        })));
}

// The connected monitor a widget shows on. Its stored monitor is kept, so
// it returns there when that monitor is back.
export function monitorFor(widget, connectors, primary) {
    return connectors.includes(widget.monitor) ? widget.monitor : primary;
}

export function clamp(rect, bounds) {
    return {
        ...rect,
        x: Math.max(0, Math.min(rect.x, bounds.width - rect.width)),
        y: Math.max(0, Math.min(rect.y, bounds.height - rect.height)),
    };
}

function overlaps(a, b) {
    return a.x < b.x + b.width + GAP && b.x < a.x + a.width + GAP &&
        a.y < b.y + b.height + GAP && b.y < a.y + a.height + GAP;
}

// The first place for a new widget that touches no other, searched in
// columns from the top right, where a desktop is usually empty.
export function freeSpot(size, occupied, bounds) {
    const {width, height} = SIZES[size];
    const step = UNIT + GAP;
    for (let x = bounds.width - MARGIN - width; x >= MARGIN; x -= step) {
        for (let y = MARGIN; y + height <= bounds.height - MARGIN; y += step) {
            const rect = {x, y, width, height};
            if (!occupied.some(other => overlaps(rect, other)))
                return {x, y};
        }
    }
    return {x: MARGIN, y: MARGIN};
}

export function newId(type, existing) {
    for (let n = 1; ; n++) {
        const id = `${type}-${n}`;
        if (!existing.some(w => w.id === id))
            return id;
    }
}

// A new widget of a type, in its first size and with its default options.
// position: {monitor, x, y}, or null to let the shell place it.
export function addWidget(widgets, type, entry, position = null) {
    return [...widgets, {
        id: newId(type, widgets),
        type,
        size: entry.sizes[0],
        enabled: true,
        placed: position !== null,
        monitor: position?.monitor ?? null,
        x: position?.x ?? MARGIN,
        y: position?.y ?? MARGIN,
        options: {...entry.defaults},
        stack: null,
        top: false,
    }];
}

// Switches a type on or off. Off keeps its widgets with their places and
// options, so on brings them back as they were; only when there are none
// is a new one added.
export function setTypeEnabled(widgets, type, enabled, entry, position = null) {
    if (!widgets.some(w => w.type === type))
        return enabled ? addWidget(widgets, type, entry, position) : widgets;
    return widgets.map(w => w.type === type ? {...w, enabled} : w);
}

export function isTypeEnabled(widgets, type) {
    return widgets.some(w => w.type === type && w.enabled);
}

export function removeWidget(widgets, id) {
    return widgets.filter(w => w.id !== id);
}
