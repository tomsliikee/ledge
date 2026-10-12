// What is playing, from the players that speak MPRIS on the session bus
// (Spotify, browsers, most music apps).

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const PREFIX = 'org.mpris.MediaPlayer2.';
const PATH = '/org/mpris/MediaPlayer2';
const PLAYER = 'org.mpris.MediaPlayer2.Player';
const PROPERTIES = 'org.freedesktop.DBus.Properties';
const COMMANDS = new Set(['PlayPause', 'Next', 'Previous']);

function describe(name, properties) {
    const metadata = properties.Metadata ?? {};
    const artists = metadata['xesam:artist'];
    return {
        name,
        playing: properties.PlaybackStatus === 'Playing',
        title: metadata['xesam:title'] || null,
        artist: Array.isArray(artists) ? artists.join(', ') : artists || null,
        art: metadata['mpris:artUrl'] || null,
        canNext: properties.CanGoNext !== false,
        canPrevious: properties.CanGoPrevious !== false,
    };
}

export function media() {
    const bus = Gio.DBus.session;
    // name -> {properties, subscription, changedAt}
    const players = new Map();
    let namesSubscription = 0;
    let emit = null;
    let cancellable = null;

    function current() {
        const list = [...players.entries()].filter(([, p]) => p.properties);
        if (list.length === 0)
            return null;
        // The one that plays; among several, or among none, the one that changed last.
        list.sort(([, a], [, b]) =>
            (b.properties.PlaybackStatus === 'Playing') - (a.properties.PlaybackStatus === 'Playing') ||
            b.changedAt - a.changedAt);
        return list[0];
    }

    function report() {
        const player = current();
        emit?.(player ? describe(player[0], player[1].properties) : {name: null});
    }

    function add(name) {
        if (players.has(name))
            return;
        const player = {properties: null, changedAt: GLib.get_monotonic_time(), subscription: 0};
        players.set(name, player);
        player.subscription = bus.signal_subscribe(name, PROPERTIES, 'PropertiesChanged', PATH, null,
            Gio.DBusSignalFlags.NONE, (_bus, _sender, _path, _iface, _signal, parameters) => {
                const [iface, changed] = parameters.recursiveUnpack();
                if (iface !== PLAYER || !player.properties)
                    return;
                Object.assign(player.properties, changed);
                player.changedAt = GLib.get_monotonic_time();
                report();
            });
        bus.call(name, PATH, PROPERTIES, 'GetAll', new GLib.Variant('(s)', [PLAYER]), null,
            Gio.DBusCallFlags.NONE, -1, cancellable, (_bus, result) => {
                try {
                    [player.properties] = bus.call_finish(result).recursiveUnpack();
                    report();
                } catch {
                    // The player left before it answered.
                }
            });
    }

    function remove(name) {
        const player = players.get(name);
        if (!player)
            return;
        bus.signal_unsubscribe(player.subscription);
        players.delete(name);
        report();
    }

    return {
        start(onReading) {
            emit = onReading;
            cancellable = new Gio.Cancellable();
            namesSubscription = bus.signal_subscribe('org.freedesktop.DBus', 'org.freedesktop.DBus',
                'NameOwnerChanged', '/org/freedesktop/DBus', PREFIX.slice(0, -1),
                Gio.DBusSignalFlags.MATCH_ARG0_NAMESPACE, (_bus, _sender, _path, _iface, _signal, parameters) => {
                    const [name, , owner] = parameters.recursiveUnpack();
                    if (owner)
                        add(name);
                    else
                        remove(name);
                });
            bus.call('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'ListNames',
                null, null, Gio.DBusCallFlags.NONE, -1, cancellable, (_bus, result) => {
                    try {
                        const [names] = bus.call_finish(result).recursiveUnpack();
                        names.filter(name => name.startsWith(PREFIX)).forEach(add);
                    } catch {
                        // Cancelled by stop().
                    }
                    report();
                });
        },
        stop() {
            cancellable?.cancel();
            bus.signal_unsubscribe(namesSubscription);
            for (const player of players.values())
                bus.signal_unsubscribe(player.subscription);
            players.clear();
            emit = null;
        },
        act(command) {
            const player = current();
            if (!player)
                return;
            // Brings the player's own window to the front.
            if (command === 'Raise') {
                bus.call(player[0], PATH, 'org.mpris.MediaPlayer2', 'Raise', null, null, Gio.DBusCallFlags.NONE, -1, null, null);
                return;
            }
            if (!COMMANDS.has(command))
                return;
            bus.call(player[0], PATH, PLAYER, command, null, null, Gio.DBusCallFlags.NONE, -1, null, null);
        },
    };
}
