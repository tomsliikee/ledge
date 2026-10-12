// What lies ahead in the calendar, in the order it is worth reading.

const DAY = 24 * 60 * 60 * 1000;

const midnight = ms => {
    const date = new Date(ms);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

// Whole days from midnight to midnight, as the calendar reports an entry
// without a time of day.
function isAllDay(start, end) {
    return start === midnight(start) && end === midnight(end) && end - start >= DAY;
}

// The entries that are running or begin within the coming days, as
//   {summary, start, end, allDay, day, running}
// day: 0 for today, 1 for tomorrow and so on; an entry that began earlier
// counts as today's. Sorted by day, the all-day ones first, then by time.
// events: [{summary, start, end}] with the times in milliseconds.
export function upcoming(events, now, days = 7) {
    const today = midnight(now);
    const horizon = today + days * DAY;
    return events
        .filter(event => event.end > now && event.start < horizon)
        .map(event => ({
            summary: event.summary || 'Untitled',
            start: event.start,
            end: event.end,
            allDay: isAllDay(event.start, event.end),
            // By calendar date, so a day with 23 or 25 hours still counts once.
            day: Math.max(0, Math.round((midnight(event.start) - today) / DAY)),
            running: event.start <= now,
        }))
        .sort((a, b) => a.day - b.day || Number(b.allDay) - Number(a.allDay) || a.start - b.start || a.summary.localeCompare(b.summary));
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// "Today", "Tomorrow", or the name of the weekday.
export function dayName(day, now) {
    if (day === 0)
        return 'Today';
    if (day === 1)
        return 'Tomorrow';
    return WEEKDAYS[new Date(midnight(now) + day * DAY + DAY / 2).getDay()];
}
