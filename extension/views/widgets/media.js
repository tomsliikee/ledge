import St from 'gi://St';

import {livelyEnabled, pop, springTo} from '../motion.js';
import {CENTER, END, FILL, column, hint, iconButton, row, spacer} from '../parts.js';
import {text} from '../text.js';
import {loadThumb} from '../thumb.js';
import {WavyProgress} from '../wavy.js';

const NOTHING = 'Nothing is playing.';

function build(ctx) {
    const small = ctx.size === 'small';
    const large = ctx.size === 'large';
    // The expressive look's wide play button leaves the small tile less room.
    const side = small ? ctx.expressive ? 48 : 56 : large ? 188 : ctx.height;
    const coverWidth = large ? ctx.width : side;

    const cover = new St.Bin({
        style_class: 'lg-cover lg-cover-empty',
        width: coverWidth,
        height: side,
        x_align: large ? FILL : CENTER,
        y_align: CENTER,
        child: new St.Icon({icon_name: 'audio-x-generic-symbolic', icon_size: small ? 24 : 40}),
    });
    const title = text(small ? 'body-strong' : 'title');
    const artist = text('label', {tone: 'muted'});
    const play = iconButton('media-playback-start-symbolic', () => ctx.act('media', 'PlayPause'), {kind: 'loud', label: 'Play or pause'});
    // Beside the wide play button of the expressive look, the medium tile
    // only has room for small ones.
    const tight = ctx.size === 'medium' && ctx.expressive;
    const previous = iconButton('media-skip-backward-symbolic', () => ctx.act('media', 'Previous'), {label: 'Previous', small: tight});
    const next = iconButton('media-skip-forward-symbolic', () => ctx.act('media', 'Next'), {label: 'Next', small: tight});
    const names = column({gap: 'lg-stack', children: [title, artist]});
    // With expressive motion a wave says that something plays: it travels
    // with the music and lies flat while it is paused. The player tells no
    // position, so the line is always full.
    const wave = !small && livelyEnabled() ? new WavyProgress({theme: ctx.theme, accent: ctx.accent}) : null;
    wave?.set(100, 'primary');

    let content;
    if (small) {
        play.x_expand = true;
        play.x_align = END;
        content = column({children: [row({gap: 'lg-row-tight', children: [cover, play]}), names]});
    } else if (large) {
        content = column({gap: 'lg-column-wide', children: [cover, wave, row({children: [names, previous, play, next]})]});
    } else {
        content = row({gap: 'lg-row-wide', children: [
            cover,
            column({y: CENTER, children: [names, wave, row({gap: 'lg-row-tight', children: [previous, play, next, spacer()]})]}),
        ]});
    }
    const message = hint(NOTHING);
    content.visible = false;

    let art = null;
    let alive = true;
    ctx.watch('media', async player => {
        const playing = Boolean(player.name && (player.title || player.playing));
        content.visible = playing;
        message.visible = !playing;
        if (!playing)
            return;
        title.text = player.title ?? 'Unknown title';
        artist.text = player.artist ?? '';
        const symbol = player.playing ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
        if (play.child.icon_name !== symbol) {
            play.child.icon_name = symbol;
            pop(play.child);
        }
        wave?.setRunning(player.playing);
        wave?.setFlat(!player.playing);
        previous.visible = player.canPrevious;
        next.visible = player.canNext;
        if (player.art === art)
            return;
        art = player.art;
        const path = await loadThumb({slot: `cover-${ctx.id}`, source: art, width: coverWidth, height: side});
        // The song may have changed, or the widget gone, while the cover loaded.
        if (!alive || art !== player.art)
            return;
        cover.style = path ? `background-image: url("file://${path}");` : null;
        // The new cover fades in and swells into its place.
        if (livelyEnabled() && cover.get_stage()) {
            cover.set_pivot_point(0.5, 0.5);
            cover.set({opacity: 0, scale_x: 0.92, scale_y: 0.92});
            springTo(cover, {opacity: 255, scale_x: 1, scale_y: 1});
        }
        cover.child.visible = !path;
        if (path)
            cover.remove_style_class_name('lg-cover-empty');
        else
            cover.add_style_class_name('lg-cover-empty');
    });
    return {
        actor: column({children: [message, content]}),
        destroy: () => {
            alive = false;
        },
    };
}

export const media = build;
