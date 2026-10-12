// Things that lie on a desk: a note, a picture, and the list of what keeps
// the machine busy.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as Format from '../../lib/format.js';
import * as Tasks from '../../lib/tasks.js';
import {CENTER, column, hint, icon, iconButton, row} from '../parts.js';
import {text} from '../text.js';
import {loadThumb} from '../thumb.js';

const SAVE_AFTER_MS = 600;

function buildNote(ctx) {
    const entry = new St.Entry({
        style_class: 'lg-note',
        hint_text: 'Write a note',
        text: ctx.options.text,
        x_expand: true,
        y_expand: true,
        can_focus: true,
    });
    const field = entry.clutter_text;
    // An entry is one line by default; a note wraps and takes Return.
    field.single_line_mode = false;
    field.activatable = false;
    field.line_wrap = true;
    field.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
    field.ellipsize = Pango.EllipsizeMode.NONE;
    // A note is written from the top, not around the middle.
    entry.y_align = Clutter.ActorAlign.START;

    let pending = 0;
    const save = () => {
        if (pending)
            GLib.source_remove(pending);
        pending = 0;
        if (field.text !== ctx.options.text)
            // Without a rebuild: the note is being typed in.
            ctx.setOptions({text: field.text}, false);
    };
    field.connect('text-changed', () => {
        if (pending)
            GLib.source_remove(pending);
        // Not on every key: each save rewrites the whole layout setting.
        pending = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SAVE_AFTER_MS, () => {
            pending = 0;
            save();
            return GLib.SOURCE_REMOVE;
        });
    });
    return {actor: entry, destroy: save};
}

export const note = buildNote;

function buildTasks(ctx) {
    const large = ctx.size === 'large';
    const shown = large ? 8 : 3;
    let items = Tasks.parse(ctx.options.items);

    const count = text('label', {tone: 'muted', expand: true});
    const clear = iconButton('edit-clear-all-symbolic', () => change(Tasks.clearDone(items)),
        {kind: 'quiet', small: true, label: 'Remove what is done'});
    const head = large ? row({children: [count, clear]}) : null;
    const list = column({gap: 'lg-stack', expand: true, y: Clutter.ActorAlign.START});
    const field = new St.Entry({style_class: 'lg-entry', hint_text: 'Add a task', x_expand: true, can_focus: true});
    field.clutter_text.connect('activate', () => {
        const next = Tasks.add(items, field.text);
        field.text = '';
        if (next !== items)
            change(next);
    });

    // Without a rebuild, so the field keeps the keys while a list is typed in.
    function change(next) {
        items = next;
        ctx.setOptions({items}, false);
        render();
    }

    function render() {
        list.destroy_all_children();
        const ordered = Tasks.ordered(items);
        const open = Tasks.openCount(items);
        count.text = items.length === 0 ? 'Tasks' : open === 0 ? 'All done' : `${open} to do`;
        clear.visible = open < items.length;
        // The last line tells of those that do not fit.
        const fits = ordered.length > shown ? shown - 1 : shown;
        for (const item of ordered.slice(0, fits)) {
            const line = new St.Button({
                style_class: 'lg-task',
                x_expand: true,
                can_focus: true,
                child: row({gap: 'lg-row-tight', children: [
                    icon(item.done ? 'checkbox-checked-symbolic' : 'checkbox-symbolic', 16, item.done ? 'muted' : null),
                    text('body', {tone: item.done ? 'muted' : null, expand: true, content: item.text}),
                ]}),
            });
            line.connect('clicked', () => change(Tasks.toggle(items, item.index)));
            list.add_child(line);
        }
        if (ordered.length > fits)
            list.add_child(text('label', {tone: 'muted', content: `and ${ordered.length - fits} more`}));
        if (items.length === 0)
            list.add_child(text('body', {tone: 'muted', wrap: true, content: 'Nothing to do. Hold the widgets to write a task.'}));
    }
    render();
    return {actor: column({children: [head, list, field]})};
}

export const tasks = buildTasks;

function buildPhoto(ctx) {
    const picture = new St.Bin({style_class: 'lg-photo', x_expand: true, y_expand: true});
    const message = hint('No pictures in this folder.');
    message.visible = false;
    const padded = new St.Bin({style_class: 'lg-tile', child: message, x_expand: true, y_expand: true});
    padded.visible = false;
    let alive = true;
    let shown = null;
    ctx.watch(`photo:${ctx.options.folder}`, async ({path}) => {
        padded.visible = message.visible = !path;
        picture.visible = Boolean(path);
        if (!path || path === shown)
            return;
        shown = path;
        const thumb = await loadThumb({slot: `photo-${ctx.id}`, source: path, width: ctx.width, height: ctx.height});
        if (alive && shown === path && thumb)
            picture.style = `background-image: url("file://${thumb}");`;
    });
    return {
        actor: column({children: [picture, padded]}),
        destroy: () => {
            alive = false;
        },
    };
}

export const photo = buildPhoto;

function buildProcesses(ctx) {
    const byMemory = ctx.options.by === 'memory';
    const count = ctx.size === 'large' ? 6 : 3;
    const head = row({children: [
        text('label', {tone: 'muted', expand: true, content: 'Top processes'}),
        text('label', {tone: 'muted', content: byMemory ? 'Memory' : 'CPU'}),
    ]});
    const lines = Array.from({length: count}, () => {
        const name = text('body', {expand: true});
        const value = text('body-strong');
        return {actor: row({children: [name, value]}), name, value};
    });
    ctx.watch(`processes:${byMemory ? 'memory' : 'cpu'}`, processes => {
        lines.forEach((line, i) => {
            const process = processes[i];
            line.name.text = process?.name ?? '';
            line.value.text = process ? byMemory ? Format.bytes(process.memory) : Format.percent(process.cpu) : '';
        });
    });
    return {actor: column({gap: ctx.size === 'large' ? 'lg-column-wide' : 'lg-column', children: [head, ...lines.map(line => line.actor)]})};
}

export const processes = buildProcesses;
