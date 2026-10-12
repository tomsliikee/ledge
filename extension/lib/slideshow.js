// GNOME's wallpapers that change through the day: an XML file that lists
// pictures, how long each stays, and when the round began.

const text = (xml, tag) => {
    const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml);
    return match ? match[1] : null;
};

// A file entry holds the path itself, or one path per screen size.
function pathIn(entry) {
    if (entry === null)
        return null;
    const path = (text(entry, 'size') ?? entry).trim();
    return path.startsWith('/') ? path : null;
}

// {start, slides: [{duration, file}]} with times in milliseconds, or null
// when the text is no such list. A transition counts as the picture it
// leads to.
export function parseSlideshow(xml) {
    const starttime = text(xml, 'starttime');
    const slides = [];
    for (const [, kind, body] of xml.matchAll(/<(static|transition)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
        const duration = Number(text(body, 'duration')) * 1000;
        const file = pathIn(text(body, kind === 'static' ? 'file' : 'to'));
        if (file && duration > 0)
            slides.push({duration, file});
    }
    if (slides.length === 0)
        return null;
    const part = (tag, fallback) => Number(text(starttime ?? '', tag) ?? fallback);
    const start = new Date(part('year', 2000), part('month', 1) - 1, part('day', 1),
        part('hour', 0), part('minute', 0), part('second', 0)).getTime();
    return {start: Number.isFinite(start) ? start : 0, slides};
}

// The picture that shows at a moment and when the next one takes over.
export function slideAt(show, now) {
    const round = show.slides.reduce((sum, slide) => sum + slide.duration, 0);
    let into = ((now - show.start) % round + round) % round;
    for (const slide of show.slides) {
        if (into < slide.duration)
            return {file: slide.file, until: now + slide.duration - into};
        into -= slide.duration;
    }
    return {file: show.slides[0].file, until: now + round};
}
