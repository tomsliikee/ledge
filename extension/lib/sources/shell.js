// Readings taken from GNOME Shell itself. What is touched here is not a
// public interface of the shell and may change with a new version; it is
// kept in this one file so that such a change meets only this.

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {getMixerControl} from 'resource:///org/gnome/shell/ui/status/volume.js';

const DAY = 24 * 60 * 60 * 1000;
const AHEAD_DAYS = 7;

// The calendar entries the shell has loaded for its own date menu. The
// calendar service keeps one span of time for all who ask, so Ledge asks
// for none of its own and takes what the shell holds: the weeks shown in
// the date menu's month.
//
// Emits {available, events: [{summary, start, end}]}; available is false
// where no calendar is set up or the shell has no such source.
export function events() {
    let source = null;
    let changed = 0;
    let emit = null;

    function report() {
        if (!source || typeof source.getEvents !== 'function') {
            emit({available: false, events: []});
            return;
        }
        const now = Date.now();
        let found = [];
        try {
            found = source.getEvents(new Date(now), new Date(now + AHEAD_DAYS * DAY));
        } catch (e) {
            console.debug(`Ledge: the shell's calendar could not be read: ${e.message}`);
        }
        emit({
            available: source.hasCalendars !== false,
            events: found.map(event => ({summary: event.summary, start: event.date.getTime(), end: event.end.getTime()})),
        });
    }

    return {
        start(onReading) {
            emit = onReading;
            source = Main.panel.statusArea.dateMenu?._eventSource ?? null;
            if (source?.connect)
                changed = source.connect('changed', report);
            report();
        },
        stop() {
            if (changed)
                source.disconnect(changed);
            changed = 0;
            source = null;
            emit = null;
        },
    };
}

// "set:0.4" as 0.4, or null for another command.
function levelIn(command) {
    if (!command.startsWith('set:'))
        return null;
    const level = Number(command.slice(4));
    return Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : null;
}

// The loudness of the default output, through the shell's own connection
// to the sound server. Emits {available, level, muted, name}; level is a
// share of full loudness without amplification. Commands: "mute" (toggles)
// and "set:<0–1>".
export function volume() {
    let control = null;
    let stream = null;
    let handlers = [];
    let streamHandlers = [];
    let emit = null;

    function report() {
        if (!stream) {
            emit({available: false, level: 0, muted: false, name: ''});
            return;
        }
        emit({
            available: true,
            level: Math.min(1, stream.volume / control.get_vol_max_norm()),
            muted: stream.is_muted,
            name: stream.get_description() ?? '',
        });
    }

    function follow() {
        for (const id of streamHandlers)
            stream.disconnect(id);
        stream = control.get_default_sink();
        streamHandlers = stream ? ['notify::volume', 'notify::is-muted'].map(signal => stream.connect(signal, report)) : [];
        report();
    }

    return {
        start(onReading) {
            emit = onReading;
            control = getMixerControl();
            handlers = ['default-sink-changed', 'state-changed'].map(signal => control.connect(signal, follow));
            follow();
        },
        stop() {
            for (const id of streamHandlers)
                stream.disconnect(id);
            for (const id of handlers)
                control.disconnect(id);
            streamHandlers = [];
            handlers = [];
            stream = null;
            control = null;
            emit = null;
        },
        act(command) {
            if (!stream)
                return;
            if (command === 'mute') {
                stream.change_is_muted(!stream.is_muted);
                return;
            }
            const level = levelIn(command);
            if (level === null)
                return;
            stream.volume = level * control.get_vol_max_norm();
            stream.push_volume();
            if (stream.is_muted && level > 0)
                stream.change_is_muted(false);
        },
    };
}

// The brightness of the screens that can be dimmed, through the shell's
// brightness manager. Emits {available, level}; available is false on a
// machine without such a screen. Command: "set:<0–1>".
export function brightness() {
    let manager = null;
    let scale = null;
    let changed = 0;
    let moved = 0;
    let emit = null;

    function follow() {
        if (moved)
            scale.disconnect(moved);
        scale = manager.globalScale ?? null;
        moved = scale ? scale.connect('notify::value', report) : 0;
        report();
    }

    function report() {
        emit({available: scale !== null, level: scale?.value ?? 0});
    }

    return {
        start(onReading) {
            emit = onReading;
            manager = Main.brightnessManager ?? null;
            if (!manager) {
                report();
                return;
            }
            changed = manager.connect('changed', follow);
            follow();
        },
        stop() {
            if (moved)
                scale.disconnect(moved);
            if (changed)
                manager.disconnect(changed);
            moved = changed = 0;
            scale = manager = emit = null;
        },
        act(command) {
            const level = levelIn(command);
            if (scale && level !== null)
                scale.value = level;
        },
    };
}
