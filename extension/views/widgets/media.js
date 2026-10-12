import St from 'gi://St';

import {CENTER, FILL, column, hint, iconButton, row, spacer} from '../parts.js';
import {text} from '../text.js';
import {loadThumb} from '../thumb.js';

const NOTHING = 'Nothing is playing.';

function build(ctx) {
    const small = ctx.size === 'small';
    const large = ctx.size === 'large';
    const side = small ? 56 : large ? 188 : ctx.height;
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
    const previous = iconButton('media-skip-backward-symbolic', () => ctx.act('media', 'Previous'), {label: 'Previous'});
    const next = iconButton('media-skip-forward-symbolic', () => ctx.act('media', 'Next'), {label: 'Next'});
    const names = column({gap: 'lg-stack', children: [title, artist]});

    let content;
    if (small) {
        content = column({children: [row({children: [cover, spacer(), play]}), names]});
    } else if (large) {
        content = column({gap: 'lg-column-wide', children: [cover, row({children: [names, previous, play, next]})]});
    } else {
        content = row({gap: 'lg-row-wide', children: [
            cover,
            column({y: CENTER, children: [names, row({gap: 'lg-row-tight', children: [previous, play, next, spacer()]})]}),
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
        play.child.icon_name = player.playing ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
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
