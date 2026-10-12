// The whole arrangement as one file, to carry it to another machine.

import {parseLayout} from './layout.js';
import {parsePlace} from './weather.js';

const VERSION = 1;
const SCREENS = ['own', 'mirror', 'primary'];

// settings: {widgets, style, expressive, translucent, animations,
//            livelyMotion, ambientMotion, screens, place}
export function toBackup(settings) {
    return `${JSON.stringify({ledge: VERSION, ...settings}, null, 2)}\n`;
}

// The settings in a backup, or null when the text is not one. A value that
// is missing or makes no sense is left out, so the present one stays.
// types and styles: what this version knows.
export function fromBackup(text, types, styles) {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        return null;
    }
    if (!data || typeof data !== 'object' || data.ledge !== VERSION || !Array.isArray(data.widgets))
        return null;
    const settings = {widgets: parseLayout(JSON.stringify(data.widgets), types)};
    if (styles.includes(data.style))
        settings.style = data.style;
    for (const key of ['expressive', 'translucent', 'animations', 'livelyMotion', 'ambientMotion']) {
        if (typeof data[key] === 'boolean')
            settings[key] = data[key];
    }
    if (SCREENS.includes(data.screens))
        settings.screens = data.screens;
    const place = data.place ? parsePlace(JSON.stringify(data.place)) : null;
    if (place)
        settings.place = place;
    return settings;
}
