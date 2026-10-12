// Brings readings to the widgets that show them. A source runs only while
// someone is subscribed, so a hidden widget costs nothing.
//
// A key is a source's name, optionally with a parameter: "cpu",
// "processes:memory", "photo:/home/me/Pictures".

import GLib from 'gi://GLib';

export class Hub {
    // factories maps a name to (parameter, env) => source, where a source is
    // {start(emit), stop(), act?(command)}.
    constructor(factories, env) {
        this._factories = factories;
        this._env = {...env, pace: () => this._pace};
        this._entries = new Map();
        this._pace = 1;
    }

    // Calls back with every reading, and at once with the last one known.
    // Returns the function that ends the subscription.
    subscribe(key, callback) {
        let entry = this._entries.get(key);
        if (!entry) {
            const [name, ...parameter] = key.split(':');
            entry = {
                source: this._factories[name](parameter.join(':'), this._env),
                subscribers: new Set(),
                value: undefined,
                running: false,
            };
            this._entries.set(key, entry);
        }
        entry.subscribers.add(callback);
        if (entry.value !== undefined)
            callback(entry.value);
        if (!entry.running)
            this._start(entry);
        return () => {
            entry.subscribers.delete(callback);
            if (entry.subscribers.size === 0 && entry.running) {
                entry.running = false;
                entry.source.stop();
            }
        };
    }

    _start(entry) {
        entry.running = true;
        entry.source.start(value => {
            entry.value = value;
            for (const callback of [...entry.subscribers])
                callback(value);
        });
    }

    // Passes a command to a source, such as "PlayPause" to the media player.
    act(key, command) {
        this._entries.get(key)?.source.act?.(command);
    }

    // Reads a running source again from the start, after what it depends on changed.
    restart(key) {
        const entry = this._entries.get(key);
        if (!entry?.running)
            return;
        entry.source.stop();
        this._start(entry);
    }

    // Stretches every interval, to halve the work on battery.
    setPace(pace) {
        if (pace === this._pace)
            return;
        this._pace = pace;
        for (const key of this._entries.keys())
            this.restart(key);
    }

    destroy() {
        for (const entry of this._entries.values()) {
            if (entry.running)
                entry.source.stop();
            entry.source.destroy?.();
        }
        this._entries.clear();
    }
}

// A source that reads on an interval. read may be async and returns the
// reading, or undefined to keep the previous one.
export function polled(seconds, read, env) {
    let timer = 0;
    let run = 0;

    async function tick(emit, mine) {
        try {
            const value = await read();
            // A reading that arrives after stop() belongs to nobody.
            if (mine === run && value !== undefined)
                emit(value);
        } catch (e) {
            console.debug(`Ledge: reading failed: ${e.message}`);
        }
    }

    return {
        start(emit) {
            const mine = ++run;
            tick(emit, mine);
            // Whole seconds let GLib wake up once for all timers that are due.
            timer = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, Math.round(seconds * env.pace()), () => {
                tick(emit, mine);
                return GLib.SOURCE_CONTINUE;
            });
        },
        stop() {
            run++;
            if (timer)
                GLib.source_remove(timer);
            timer = 0;
        },
    };
}

// The last readings of a value, oldest first, for the small charts.
export function history(length) {
    const values = [];
    return value => {
        values.push(value);
        if (values.length > length)
            values.shift();
        return [...values];
    };
}
