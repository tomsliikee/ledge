// Stacks: several widgets on one place, of which the top one shows.
//
// A stacked widget carries stack (the name its members share) and top
// (true on the one that shows). All members lie at the same place, on the
// same monitor and in the same size. Their order is the order of the list.

export function membersOf(widgets, stack) {
    return stack ? widgets.filter(widget => widget.stack === stack) : [];
}

// The member that shows: the one marked, or else the first.
export function topOf(members) {
    return members.find(widget => widget.top) ?? members[0] ?? null;
}

function newName(widgets) {
    for (let n = 1; ; n++) {
        const name = `stack-${n}`;
        if (!widgets.some(widget => widget.stack === name))
            return name;
    }
}

// Puts a stack with a single member back on its own, and sees that every
// stack has exactly one top.
export function tidy(widgets) {
    const tops = new Map();
    for (const widget of widgets) {
        if (widget.stack && !tops.has(widget.stack))
            tops.set(widget.stack, topOf(membersOf(widgets, widget.stack)).id);
    }
    return widgets.map(widget => {
        if (!widget.stack)
            return widget.top === undefined ? widget : {...widget, stack: null, top: false};
        if (membersOf(widgets, widget.stack).length < 2)
            return {...widget, stack: null, top: false};
        return {...widget, top: tops.get(widget.stack) === widget.id};
    });
}

// Whether the widget may lie on the target: both must exist, neither be
// the other, the widget be on its own, and offer the target's size.
// types maps a type name to the sizes it offers.
export function canJoin(widgets, id, targetId, types) {
    const widget = widgets.find(w => w.id === id);
    const target = widgets.find(w => w.id === targetId);
    return Boolean(widget && target && id !== targetId && !widget.stack && types[widget.type].includes(target.size));
}

// Lays the widget on the target, as the new top. It moves in the list to
// behind the stack's last member, so it is also last in the turn.
export function join(widgets, id, targetId, types) {
    if (!canJoin(widgets, id, targetId, types))
        return widgets;
    const target = widgets.find(w => w.id === targetId);
    const stack = target.stack ?? newName(widgets);
    const joined = {
        ...widgets.find(w => w.id === id),
        stack, top: true, size: target.size, monitor: target.monitor, x: target.x, y: target.y, placed: true,
    };
    const rest = widgets.filter(w => w.id !== id).map(w => {
        if (w.id === targetId || w.stack === stack)
            return {...w, stack, top: false};
        return w;
    });
    const last = rest.findLastIndex(w => w.stack === stack);
    return [...rest.slice(0, last + 1), joined, ...rest.slice(last + 1)];
}

// Takes the widget out. It keeps its size and is marked as not placed, so
// the shell finds it a free spot.
export function leave(widgets, id) {
    return tidy(widgets.map(w => w.id === id && w.stack ? {...w, stack: null, top: false, placed: false} : w));
}

// Makes the member step places further the top, wrapping around. among:
// the members that can show right now; the others are passed over.
export function turn(widgets, stack, step, among = null) {
    const members = (among ?? widgets).filter(w => w.stack === stack);
    if (members.length < 2)
        return widgets;
    const current = Math.max(0, members.findIndex(w => w.top));
    const next = members[((current + step) % members.length + members.length) % members.length];
    return show(widgets, next.id);
}

// Makes one member the top of its stack.
export function show(widgets, id) {
    const stack = widgets.find(w => w.id === id)?.stack;
    if (!stack)
        return widgets;
    return widgets.map(w => w.stack === stack ? {...w, top: w.id === id} : w);
}

// Changes a widget and, when it is stacked, every member with it. For
// what a stack shares: place, monitor and size.
export function setShared(widgets, id, patch) {
    const stack = widgets.find(w => w.id === id)?.stack;
    return widgets.map(w => w.id === id || (stack && w.stack === stack) ? {...w, ...patch} : w);
}

// The sizes a widget can take where it lies: its own, or in a stack those
// that every member offers.
export function sharedSizes(widgets, id, types) {
    const widget = widgets.find(w => w.id === id);
    const members = widget.stack ? membersOf(widgets, widget.stack) : [widget];
    return types[widget.type].filter(size => members.every(member => types[member.type].includes(size)));
}

// Of the widgets that may show, those that do: of each stack only one, the
// top if it is among them and else the first that is.
export function visibleOf(shown) {
    const chosen = new Map();
    for (const widget of shown) {
        if (widget.stack && (!chosen.has(widget.stack) || widget.top))
            chosen.set(widget.stack, widget.id);
    }
    return shown.filter(widget => !widget.stack || chosen.get(widget.stack) === widget.id);
}
