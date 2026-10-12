// Every source by the name the widgets ask for.

import {gpu} from './gpu.js';
import {battery, claude, disk, photo} from './local.js';
import {media} from './media.js';
import {cpu, memory, network, processes, temperature} from './system.js';
import {minute, second} from './time.js';
import {air, weather} from './weather.js';

export const factories = {
    air, battery, claude, cpu, disk, gpu, media, memory, minute, network, photo, processes, second, temperature, weather,
};
