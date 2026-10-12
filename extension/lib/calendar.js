// The sheet of one month: rows of seven days, padded with null where the
// neighbouring months would be.

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

// 0 is Monday, unlike Date.getDay().
export function weekday(date) {
    return (date.getDay() + 6) % 7;
}

// month is 1–12. Weeks start on Monday.
export function monthGrid(year, month) {
    const first = weekday(new Date(year, month - 1, 1));
    const length = new Date(year, month, 0).getDate();
    const cells = [...Array(first).fill(null), ...Array.from({length}, (_, i) => i + 1)];
    while (cells.length % 7 !== 0)
        cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7)
        weeks.push(cells.slice(i, i + 7));
    return weeks;
}

// "2026-12-24" to [2026, 12, 24], or null when it is no real date.
export function parseDate(text) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text ?? '');
    if (!match)
        return null;
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
        return null;
    return [year, month, day];
}
