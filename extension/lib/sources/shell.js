// Readings taken from GNOME Shell itself. What is touched here is not a
// public interface of the shell and may change with a new version; it is
// kept in this one file so that such a change meets only this.

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

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
