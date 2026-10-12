// The time somewhere else, and how far it is from here.

const formatters = new Map();

function formatter(timeZone) {
    if (!formatters.has(timeZone)) {
        formatters.set(timeZone, new Intl.DateTimeFormat('en-GB', {
            timeZone, hourCycle: 'h23',
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        }));
    }
    return formatters.get(timeZone);
}

// localOffset: minutes this machine is east of UTC at that moment.
// Returns null for a zone name the system does not know.
export function zoneTime(date, timeZone, localOffset = -date.getTimezoneOffset()) {
    let parts;
    try {
        parts = Object.fromEntries(formatter(timeZone).formatToParts(date).map(p => [p.type, Number(p.value)]));
    } catch {
        return null;
    }
    // The zone's wall clock read as if it were UTC shows its offset.
    const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const here = Math.floor(date.getTime() / 60000) * 60000;
    const offset = (wall - here) / 60000;
    const day = ms => Math.floor(ms / 86400000);
    return {
        hours: parts.hour,
        minutes: parts.minute,
        // Hours ahead of here; may be a fraction (India is +5.5 from UTC).
        ahead: (offset - localOffset) / 60,
        dayOffset: day(wall) - day(here + localOffset * 60000),
    };
}

export function describeOffset({ahead, dayOffset}) {
    const day = dayOffset > 0 ? 'Tomorrow' : dayOffset < 0 ? 'Yesterday' : null;
    if (ahead === 0)
        return 'Same time';
    const hours = Number.isInteger(ahead) ? Math.abs(ahead) : Math.abs(ahead).toFixed(1);
    const distance = `${ahead > 0 ? '+' : '−'}${hours} h`;
    return day ? `${day}, ${distance}` : distance;
}
