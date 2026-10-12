// Fills the stylesheet template in for one colour scheme. Used when the
// extension is built, for the styles that ship with it, and while it runs,
// for the style taken from the wallpaper.

function rgba(hex, percent) {
    const value = Number.parseInt(hex.slice(1), 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${percent / 100})`;
}

// $token is a size or a colour; $token@80 is that colour at 80 % opacity.
// palette may be null for a part of the template that carries no colour.
export function expand(css, sizes, palette = null) {
    return css.replace(/\$([a-z0-9-]+)(?:@(\d+))?/g, (_, name, alpha) => {
        if (name in sizes)
            return `${sizes[name]}px`;
        if (!palette || !(name in palette))
            throw new Error(`Unknown token in the template: ${name}`);
        return alpha ? rgba(palette[name], Number(alpha)) : palette[name];
    });
}

// The coloured rules for one scheme, such as "violet-dark".
export function schemeSheet(themed, scheme, sizes, palette) {
    return expand(themed.replace(/\.lg-root/g, `.lg-root-${scheme}`), sizes, palette).trim();
}
