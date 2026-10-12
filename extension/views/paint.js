// Shared helpers for the Cairo-drawn marks.

import {colors} from '../lib/tokens.js';

const TONE_COLOR = {
    primary: 'primary',
    warn: 'status-warn',
    bad: 'status-bad',
};

// accent: the tone of the scheme that stands for "nothing to report" on this
// tile; a warning or an error keeps its own colour on every tile.
export function toneColor(theme, tone, accent = 'primary') {
    return colors[theme][tone === 'primary' ? accent : TONE_COLOR[tone]];
}

// The colour for what is written or drawn on a filled tone.
export function onToneColor(theme, tone, accent = 'primary') {
    return colors[theme][`on-${tone === 'primary' ? accent : TONE_COLOR[tone]}`];
}

export function setSource(cr, hex, alpha = 1) {
    const value = Number.parseInt(hex.slice(1), 16);
    cr.setSourceRGBA(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, alpha);
}

export function fraction(percent) {
    if (percent === null || percent === undefined)
        return 0;
    return Math.min(1, Math.max(0, percent / 100));
}
