// Things that lie on a desk: a note, a picture, and the list of what keeps
// the machine busy.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as Format from '../../lib/format.js';
import {column, hint, row} from '../parts.js';
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
