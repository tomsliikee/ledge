// The time, told once a minute or once a second. Both fire on the boundary,
// so a clock changes when the minute does and not somewhere inside it.

import GLib from 'gi://GLib';

function ticking(unitMs) {
    let timer = 0;
    return {
        start(emit) {
            const arm = () => {
                const now = Date.now();
                emit(new Date(now));
                timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, unitMs - (now % unitMs) + 5, () => {
                    arm();
                    return GLib.SOURCE_REMOVE;
                });
            };
            arm();
        },
        stop() {
            if (timer)
                GLib.source_remove(timer);
            timer = 0;
        },
    };
}

export const minute = () => ticking(60 * 1000);
export const second = () => ticking(1000);
