// Text for numbers. Units are set off with a space, as the design system asks.

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const WARN_AT = 75;
const BAD_AT = 90;

const EMPTY = '–';
const missing = value => value === null || value === undefined || Number.isNaN(value);

export function percent(value) {
    return missing(value) ? EMPTY : `${Math.round(value)} %`;
}

export function degrees(value) {
    return missing(value) ? EMPTY : `${Math.round(value)}°`;
}

export function celsius(value) {
    return missing(value) ? EMPTY : `${Math.round(value)} °C`;
}

function scaled(value, units, base) {
    let index = 0;
    while (value >= base * 0.99995 && index < units.length - 1) {
        value /= base;
        index++;
    }
    // Small units need no decimals; "3.0 B" would only pretend precision.
    const digits = index === 0 || value >= 100 ? 0 : 1;
    return `${value.toFixed(digits)} ${units[index]}`;
}

export function bytes(value) {
    return missing(value) ? EMPTY : scaled(value, ['B', 'KB', 'MB', 'GB', 'TB'], 1024);
}

export function rate(value) {
    return missing(value) ? EMPTY : scaled(value, ['B/s', 'KB/s', 'MB/s', 'GB/s'], 1024);
}

export function duration(ms) {
    if (missing(ms))
        return EMPTY;
    if (ms <= 0)
        return '0 min';
    // Round up, so something seconds away never reads as already done.
    const minutes = Math.ceil(ms / MIN);
    const d = Math.floor(minutes / (24 * 60));
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    if (d > 0)
        return h > 0 ? `${d} d ${h} h` : `${d} d`;
    if (h > 0)
        return m > 0 ? `${h} h ${m} min` : `${h} h`;
    return `${m} min`;
}

const two = n => String(n).padStart(2, '0');

// A running time as on a stopwatch: 4:05, or 1:04:05 from an hour on.
export function stopwatch(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor(seconds / 60) % 60;
    const s = seconds % 60;
    return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

// hours and minutes of a wall clock; twelveHour drops the leading zero and
// leaves the am/pm to the caller.
export function clock(hours, minutes, twelveHour = false) {
    if (twelveHour)
        return `${hours % 12 === 0 ? 12 : hours % 12}:${two(minutes)}`;
    return `${two(hours)}:${two(minutes)}`;
}

// A time of day as it is written in a sentence or beside a label: "18:11",
// or "6:11 pm" on a twelve-hour clock.
export function time(hours, minutes, twelveHour = false) {
    return twelveHour ? `${clock(hours, minutes, true)} ${hours < 12 ? 'am' : 'pm'}` : clock(hours, minutes);
}

// Whole days from one calendar day to another, both as [year, month, day].
export function daysBetween(from, to) {
    const utc = ([y, m, d]) => Date.UTC(y, m - 1, d);
    return Math.round((utc(to) - utc(from)) / DAY);
}

export function daysLeft(days) {
    if (days === 0)
        return 'Today';
    if (days === 1)
        return 'Tomorrow';
    if (days === -1)
        return 'Yesterday';
    return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

export function tone(value) {
    if (missing(value))
        return 'primary';
    if (value >= BAD_AT)
        return 'bad';
    if (value >= WARN_AT)
        return 'warn';
    return 'primary';
}
