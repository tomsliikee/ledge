// How each widget of the catalog is drawn: type name to build(ctx).

import {calendar} from './calendar.js';
import {clock} from './clock.js';
import {note, photo, processes} from './desk.js';
import {cpu, gpu, memory, temperature} from './gauges.js';
import {media} from './media.js';
import {battery, claude, disk, network} from './status.js';
import {system} from './system.js';
import {countdown, timer, worldclock} from './times.js';
import {daylight, weather} from './weather.js';

export const builders = {
    clock, weather, system, cpu, gpu, memory, temperature, calendar, battery, network, disk,
    media, claude, worldclock, timer, note, daylight, processes, countdown, photo,
};
