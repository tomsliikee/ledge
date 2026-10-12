// The plan limits that the Tally extension keeps in its cache. Ledge only
// reads these two files; it never asks Claude Code itself.

const SECOND = 1000;

function fromProbe(record) {
    const limits = record?.limits;
    if (!limits?.session && !limits?.week)
        return null;
    return {at: record.at ?? 0, session: limits.session ?? null, week: limits.week ?? null};
}

function fromStatusline(record) {
    const window = entry => entry && typeof entry.used_percentage === 'number'
        ? {percent: entry.used_percentage, resetsAt: entry.resets_at ? entry.resets_at * SECOND : null}
        : null;
    const session = window(record?.rate_limits?.five_hour);
    const week = window(record?.rate_limits?.seven_day);
    if (!session && !week)
        return null;
    return {at: record.at ?? 0, session, week};
}

// A window whose reset has passed starts again at nothing.
function rollOver(window, now) {
    if (window?.resetsAt && window.resetsAt <= now)
        return {percent: 0, resetsAt: null};
    return window;
}

function parse(text) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

// The newer of the two records, or null when Tally has written neither.
export function readLimits(probeText, statuslineText, now) {
    const records = [fromProbe(parse(probeText)), fromStatusline(parse(statuslineText))]
        .filter(Boolean)
        .sort((a, b) => b.at - a.at);
    if (records.length === 0)
        return null;
    const [newest, older] = records;
    return {
        at: newest.at,
        // A record may leave out a window that the other one knows.
        session: rollOver(newest.session ?? older?.session ?? null, now),
        week: rollOver(newest.week ?? older?.week ?? null, now),
    };
}
