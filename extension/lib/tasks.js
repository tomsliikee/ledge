// A list of things to do: [{text, done}], in the order they were written.

const LONGEST = 120;

export function parse(items) {
    if (!Array.isArray(items))
        return [];
    return items.filter(item => item && typeof item.text === 'string' && item.text.trim() !== '')
        .map(item => ({text: item.text, done: item.done === true}));
}

export function add(items, text) {
    const trimmed = text.trim().slice(0, LONGEST);
    return trimmed ? [...items, {text: trimmed, done: false}] : items;
}

export function toggle(items, index) {
    return items.map((item, i) => i === index ? {...item, done: !item.done} : item);
}

export function clearDone(items) {
    return items.filter(item => !item.done);
}

// As they are shown: what is open first, what is done after it, each with
// its place in the list.
export function ordered(items) {
    const indexed = items.map((item, index) => ({...item, index}));
    return [...indexed.filter(item => !item.done), ...indexed.filter(item => item.done)];
}

export function openCount(items) {
    return items.filter(item => !item.done).length;
}
