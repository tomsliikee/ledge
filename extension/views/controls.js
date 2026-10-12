// The controls of the arranging mode, built once and used for every setting.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {CENTER, column, icon, row} from './parts.js';
import {Switch} from './switch.js';
import {text} from './text.js';

// One of several choices side by side. options: [[value, label], …].
export function segments(options, selected, onPick) {
    const box = new St.BoxLayout({style_class: 'lg-segments', x_expand: true});
    options.forEach(([value, label], i) => {
        const classes = ['lg-segment'];
        if (value === selected)
            classes.push('lg-segment-selected');
        else if (i === 0)
            classes.push('lg-segment-first');
        else if (i === options.length - 1)
            classes.push('lg-segment-last');
        const button = new St.Button({
            style_class: classes.join(' '),
            child: text('label', {align: CENTER, content: label}),
            x_expand: true,
            can_focus: true,
        });
        button.connect('clicked', () => onPick(value));
        box.add_child(button);
    });
    return box;
}

// Rows that belong together: 4px apart, with only the outer corners round.
export function group(rows) {
    const box = new St.BoxLayout({vertical: true, style_class: 'lg-group', x_expand: true});
    const shown = rows.filter(Boolean);
    shown.forEach((item, i) => {
        if (shown.length === 1)
            item.add_style_class_name('lg-item-only');
        else if (i === 0)
            item.add_style_class_name('lg-item-first');
        else if (i === shown.length - 1)
            item.add_style_class_name('lg-item-last');
        box.add_child(item);
    });
    return box;
}

function titles(title, about) {
    return column({
        gap: 'lg-stack',
        y: CENTER,
        children: [
            text('body-strong', {content: title}),
            about ? text('label', {tone: 'muted', wrap: true, content: about}) : null,
        ],
    });
}

// A row with a title, an optional line beneath it, and something at its end.
export function item(title, about, trailing = null) {
    const box = new St.BoxLayout({style_class: 'lg-item', x_expand: true});
    box.add_child(titles(title, about));
    if (trailing)
        box.add_child(trailing);
    return box;
}

// A row that is pressed as a whole.
export function itemButton(title, about, onClick, symbol = null) {
    const content = row({children: [titles(title, about), symbol ? icon(symbol, 16, 'muted') : null]});
    const button = new St.Button({
        style_class: 'lg-item lg-item-button',
        child: content,
        x_expand: true,
        can_focus: true,
    });
    button.connect('clicked', onClick);
    return button;
}

export function switchItem(title, about, theme, on, onChange, extra = null) {
    const toggle = new Switch({theme, on});
    let state = on;
    const button = new St.Button({child: toggle, can_focus: true, y_align: CENTER, accessible_name: title});
    button.connect('clicked', () => {
        state = !state;
        toggle.set(state);
        onChange(state);
    });
    button.connect('notify::pressed', () => toggle.setPressed(button.pressed));
    const trailing = row({gap: 'lg-row-tight', children: [extra, button]});
    trailing.x_expand = false;
    return item(title, about, trailing);
}

// A text field that reports its content on Return and when focus leaves it,
// not on every key: each report rewrites a setting.
export function entry(value, hint, onCommit) {
    const field = new St.Entry({style_class: 'lg-entry', text: value, hint_text: hint, x_expand: true, can_focus: true});
    let last = value;
    const commit = () => {
        if (field.text === last)
            return;
        last = field.text;
        onCommit(field.text);
    };
    field.clutter_text.connect('activate', commit);
    field.clutter_text.connect('key-focus-out', commit);
    return field;
}

export function section(title) {
    const label = text('label', {tone: 'muted', content: title});
    return new St.Bin({style_class: 'lg-section', child: label, x_align: Clutter.ActorAlign.START});
}
