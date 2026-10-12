import {test, equal, done} from './harness.js';
import {fromBackup, toBackup} from '../extension/lib/backup.js';

const types = {clock: ['small', 'medium'], note: ['small']};
const styles = ['blue', 'green'];
const widget = {id: 'clock-1', type: 'clock', size: 'medium', enabled: true, placed: true, monitor: 'eDP-1', x: 24, y: 40, options: {face: 'digital'}, stack: null, top: false};
const settings = {
    widgets: [widget], style: 'green', expressive: false, translucent: true, animations: true, screens: 'mirror',
    place: {name: 'Vienna', region: 'Austria', latitude: 48.2, longitude: 16.4, timezone: 'Europe/Vienna'},
};

test('a backup comes back as it went in', () => {
    equal(fromBackup(toBackup(settings), types, styles), settings);
});

test('what is not a backup is refused', () => {
    equal(fromBackup('not json', types, styles), null);
    equal(fromBackup('{"widgets": []}', types, styles), null);
    equal(fromBackup('{"ledge": 1}', types, styles), null);
    equal(fromBackup('{"ledge": 2, "widgets": []}', types, styles), null);
});

test('unknown widgets and senseless values are left out', () => {
    const text = JSON.stringify({
        ledge: 1,
        widgets: [widget, {id: 'x-1', type: 'unknown', size: 'small'}],
        style: 'mauve', expressive: 'yes', screens: 'all', place: {name: 'Nowhere'},
    });
    equal(fromBackup(text, types, styles), {widgets: [widget]});
});

done('backup');
