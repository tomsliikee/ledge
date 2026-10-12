// The small pieces every widget is put together from.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {onToneColor} from './paint.js';
import {Ring} from './ring.js';
import {ShapeBadge} from './shape.js';
import {text} from './text.js';

export const START = Clutter.ActorAlign.START;
export const CENTER = Clutter.ActorAlign.CENTER;
export const END = Clutter.ActorAlign.END;
export const FILL = Clutter.ActorAlign.FILL;

function box(vertical, {gap = '', expand = false, x = FILL, y = FILL, children = []} = {}) {
    const actor = new St.BoxLayout({
        vertical,
        style_class: gap,
        x_expand: true,
        y_expand: expand,
        x_align: x,
        y_align: y,
    });
    for (const child of children) {
        if (child)
            actor.add_child(child);
    }
    return actor;
}

export const row = options => box(false, {gap: 'lg-row', ...options});
export const column = options => box(true, {gap: 'lg-column', ...options});

// Takes up whatever room is left between its neighbours.
export function spacer() {
    return new St.Widget({x_expand: true, y_expand: true});
}

export function icon(name, size, tone = null) {
    return new St.Icon({
        icon_name: name,
        icon_size: size,
        style_class: tone ? `lg-${tone}` : '',
        x_align: CENTER,
        y_align: CENTER,
    });
}

// A round button with one icon. kind: "loud" for the one main action,
// "quiet" for a side action, nothing for the usual container tone.
export function iconButton(name, onClick, {kind = null, small = false, label = ''} = {}) {
    const button = new St.Button({
        style_class: [small ? 'lg-button-small' : 'lg-button', kind ? `lg-button-${kind}` : ''].join(' '),
        child: new St.Icon({icon_name: name, icon_size: small ? 16 : 20}),
        accessible_name: label,
        can_focus: true,
        x_align: CENTER,
        y_align: CENTER,
    });
    button.connect('clicked', onClick);
    return button;
}

// A ring with its value written inside.
export function gauge({size, stroke, theme, role, accent = 'primary', wavy = false}) {
    const ring = new Ring({size, stroke, theme, accent, wavy});
    const label = text(role, {align: CENTER});
    const actor = new St.Widget({
        layout_manager: new Clutter.BinLayout(),
        width: size,
        height: size,
        x_align: CENTER,
        y_align: CENTER,
    });
    actor.add_child(ring);
    actor.add_child(label);
    return {actor, ring, label};
}

// One sentence for a widget that has nothing to show yet.
export function hint(sentence) {
    const label = text('body', {tone: 'muted', wrap: true, content: sentence});
    label.y_expand = true;
    return label;
}

// The reactive actor a press landed on.
export function pressedActor(event) {
    const [x, y] = event.get_coords();
    return global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y);
}

// Whether a press on a tile landed on something inside it that is used by
// pressing: a button or a text field. Those must not start a drag.
export function pressedControl(event, tile) {
    for (let actor = pressedActor(event); actor && actor !== tile; actor = actor.get_parent()) {
        if (actor instanceof St.Button || actor instanceof St.Entry || actor instanceof Clutter.Text)
            return true;
    }
    return false;
}

// A shape with something written or shown on it. show(level, tone, value)
// sets all three; the writing takes the on-colour of the fill.
export function badge({size, theme, role, accent = 'primary', mood = 'radiant', child = null}) {
    const shape = new ShapeBadge({size, theme, accent, mood});
    const label = child ?? text(role, {align: CENTER});
    const actor = new St.Widget({
        layout_manager: new Clutter.BinLayout(),
        width: size,
        height: size,
        x_align: CENTER,
        y_align: CENTER,
    });
    actor.add_child(shape);
    actor.add_child(label);
    const colour = tone => {
        label.style = `color: ${onToneColor(theme, tone, accent)};`;
    };
    colour('primary');
    return {
        actor, shape, label,
        show(level, tone, value) {
            shape.set(level, tone);
            colour(tone);
            if (value !== undefined)
                label.text = value;
        },
    };
}
