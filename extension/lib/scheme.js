// A colour scheme from a single colour, and that colour from a picture.
// The five styles that ship with Ledge were derived the same way (see
// tools/derive-styles), so a scheme made here sits beside them as one more.

import {MaterialDynamicColors} from './vendor/material-color-utilities/dynamiccolor/material_dynamic_colors.js';
import {Hct} from './vendor/material-color-utilities/hct/hct.js';
import {QuantizerCelebi} from './vendor/material-color-utilities/quantize/quantizer_celebi.js';
import {SchemeVibrant} from './vendor/material-color-utilities/scheme/scheme_vibrant.js';
import {Score} from './vendor/material-color-utilities/score/score.js';

// The roles a style derives; every other role comes from the design system.
export const ROLES = [
    'primary', 'on-primary', 'primary-container', 'on-primary-container',
    'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container',
    'tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container',
    'surface', 'surface-container-lowest', 'surface-container-low', 'surface-container',
    'surface-container-high', 'surface-container-highest', 'surface-bright',
    'on-surface', 'on-surface-variant', 'outline', 'outline-variant',
    'inverse-surface', 'inverse-on-surface', 'inverse-primary',
];

const QUANTIZED_COLORS = 128;
const OPAQUE = 0xff000000;

const toHex = argb => `#${(argb & 0xffffff).toString(16).padStart(6, '0')}`;
const camel = role => role.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());

export function parseHex(hex) {
    const match = /^#([0-9a-f]{6})$/i.exec(hex ?? '');
    return match ? (Number.parseInt(match[1], 16) | OPAQUE) >>> 0 : null;
}

// {light: {role: "#rrggbb"}, dark: {…}} for a seed given as "#rrggbb".
export function rolesFor(seed) {
    const source = Hct.fromInt(parseHex(seed));
    const result = {};
    for (const theme of ['light', 'dark']) {
        const scheme = new SchemeVibrant(source, theme === 'dark', 0);
        result[theme] = Object.fromEntries(ROLES.map(role => [role, toHex(MaterialDynamicColors[camel(role)].getArgb(scheme))]));
    }
    return result;
}

// The colour that carries a picture, as "#rrggbb": its colours are reduced
// to a few and those ranked by how much of the picture they cover and how
// well they serve as the seed of a scheme. bytes: the pixels row by row,
// channels of them each (3 for RGB, 4 for RGBA); rowstride: bytes per row.
export function seedOf(bytes, {width, height, channels, rowstride}) {
    const pixels = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * rowstride + x * channels;
            if (channels === 4 && bytes[i + 3] < 255)
                continue;
            pixels.push(((bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2] | OPAQUE) >>> 0);
        }
    }
    if (pixels.length === 0)
        return null;
    return toHex(Score.score(QuantizerCelebi.quantize(pixels, QUANTIZED_COLORS))[0]);
}
