import {test, equal, done} from './harness.js';
import * as Layout from '../extension/lib/layout.js';
import {snap} from '../extension/lib/snap.js';
import {coveredMonitors} from '../extension/lib/visibility.js';

const TYPES = {clock: ['small', 'medium'], cpu: ['small']};
const BOUNDS = {width: 1280, height: 960};

test('a damaged layout is an empty one', () => {
    equal(Layout.parseLayout('not json', TYPES), []);
    equal(Layout.parseLayout('{"a":1}', TYPES), []);
});

test('unknown types and repeated ids are dropped', () => {
    const text = JSON.stringify([{id: 'a', type: 'clock', size: 'small', x: 1, y: 2}, {id: 'a', type: 'cpu'}, {id: 'b', type: 'gone'}]);
    equal(Layout.parseLayout(text, TYPES).map(w => w.id), ['a']);
});

test('missing fields get defaults and an unknown size the first one', () => {
    equal(Layout.parseLayout('[{"id":"c","type":"cpu","size":"large"}]', TYPES),
        [{id: 'c', type: 'cpu', size: 'small', enabled: true, placed: true, monitor: null, x: 24, y: 24, options: {}, stack: null, top: false}]);
});

test('a widget of a missing monitor shows on the primary one', () => {
    equal(Layout.monitorFor({monitor: 'DP-1'}, ['eDP-1'], 'eDP-1'), 'eDP-1');
    equal(Layout.monitorFor({monitor: 'DP-1'}, ['eDP-1', 'DP-1'], 'eDP-1'), 'DP-1');
});

test('clamp keeps a widget inside the work area', () => {
    equal(Layout.clamp({x: -5, y: 900, width: 160, height: 160}, BOUNDS), {x: 0, y: 800, width: 160, height: 160});
});

test('the first free spot is at the top right', () => {
    equal(Layout.freeSpot('small', [], BOUNDS), {x: 1096, y: 24});
});

test('a new widget goes below one that is in the way', () => {
    equal(Layout.freeSpot('small', [{x: 1096, y: 24, width: 160, height: 160}], BOUNDS), {x: 1096, y: 200});
});

test('ids count up per type', () => {
    equal(Layout.newId('clock', [{id: 'clock-1'}, {id: 'cpu-1'}]), 'clock-2');
});

const ENTRY = {sizes: ['medium', 'small'], defaults: {face: 'analog'}};

test('switching a type on adds a widget in its first size', () => {
    const [widget] = Layout.setTypeEnabled([], 'clock', true, ENTRY, {monitor: 'eDP-1', x: 40, y: 48});
    equal(widget, {id: 'clock-1', type: 'clock', size: 'medium', enabled: true, placed: true, monitor: 'eDP-1', x: 40, y: 48, options: {face: 'analog'}, stack: null, top: false});
});

test('a widget added without a position is left for the shell to place', () => {
    equal(Layout.addWidget([], 'clock', ENTRY)[0].placed, false);
});

test('switching a type off keeps its widgets, and on brings them back', () => {
    const one = [{id: 'clock-1', type: 'clock', enabled: true, x: 300, options: {face: 'digital'}}, {id: 'cpu-1', type: 'cpu', enabled: true}];
    const off = Layout.setTypeEnabled(one, 'clock', false, ENTRY);
    equal(off.map(w => w.enabled), [false, true]);
    equal([Layout.isTypeEnabled(off, 'clock'), Layout.isTypeEnabled(off, 'cpu')], [false, true]);
    equal(Layout.setTypeEnabled(off, 'clock', true, ENTRY), one);
});

test('removing takes one widget out for good', () => {
    equal(Layout.removeWidget([{id: 'a'}, {id: 'b'}], 'a'), [{id: 'b'}]);
});

test('a dropped widget rests on the grid', () => {
    equal(snap({x: 203, y: 98, width: 160, height: 160}, [], BOUNDS), {x: 200, y: 96, width: 160, height: 160});
});

test('a near neighbour pulls the widget one gap beside it', () => {
    const neighbour = {x: 100, y: 100, width: 160, height: 160};
    const dropped = snap({x: 281, y: 107, width: 160, height: 160}, [neighbour], BOUNDS);
    equal([dropped.x, dropped.y], [276, 100]);
});

test('a neighbour far away on the other axis does not pull', () => {
    const neighbour = {x: 100, y: 700, width: 160, height: 160};
    equal(snap({x: 103, y: 100, width: 160, height: 160}, [neighbour], BOUNDS).x, 104);
});

test('snapping never leaves the work area', () => {
    equal(snap({x: 1270, y: -20, width: 160, height: 160}, [], BOUNDS), {x: 1120, y: 0, width: 160, height: 160});
});

test('a maximised window on the active workspace covers its monitor', () => {
    const windows = [
        {monitor: 0, covers: true, minimized: false, onActiveWorkspace: true},
        {monitor: 1, covers: true, minimized: true, onActiveWorkspace: true},
        {monitor: 2, covers: true, minimized: false, onActiveWorkspace: false},
        {monitor: 3, covers: false, minimized: false, onActiveWorkspace: true},
    ];
    equal([...coveredMonitors(windows)], [0]);
});

done('layout');
