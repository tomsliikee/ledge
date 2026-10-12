import {test, equal, done} from './harness.js';
import * as Stack from '../extension/lib/stack.js';
import {shownWidgets} from '../extension/lib/visibility.js';

const types = {clock: ['small', 'medium'], cpu: ['small', 'medium'], system: ['medium', 'large']};
const w = (id, type, rest = {}) => ({
    id, type, size: 'small', enabled: true, placed: true, monitor: 'A', x: 0, y: 0, options: {}, stack: null, top: false, ...rest,
});
const base = [w('a', 'clock', {x: 10, y: 20}), w('b', 'cpu', {x: 300, monitor: 'B'}), w('c', 'cpu', {x: 600}), w('d', 'system', {size: 'medium'})];
const brief = widgets => widgets.map(x => `${x.id}${x.stack ? `:${x.stack}` : ''}${x.top ? '*' : ''}`);

test('a widget laid on another takes its place and shows', () => {
    const stacked = Stack.join(base, 'b', 'a', types);
    equal(brief(stacked), ['a:stack-1', 'b:stack-1*', 'c', 'd']);
    const b = stacked.find(x => x.id === 'b');
    equal([b.x, b.y, b.monitor], [10, 20, 'A']);
});

test('a third joins the same stack, behind its last member', () => {
    const stacked = Stack.join(Stack.join(base, 'b', 'a', types), 'c', 'b', types);
    equal(brief(stacked), ['a:stack-1', 'b:stack-1', 'c:stack-1*', 'd']);
});

test('a widget that does not offer the size cannot join', () => {
    equal(Stack.canJoin(base, 'd', 'a', types), false);
    equal(Stack.join(base, 'd', 'a', types), base);
    equal(Stack.canJoin(base, 'a', 'd', types), true);
    equal(Stack.join(base, 'a', 'd', types).find(x => x.id === 'a').size, 'medium');
});

test('a stacked widget cannot be laid on another, nor a widget on itself', () => {
    const stacked = Stack.join(base, 'b', 'a', types);
    equal(Stack.canJoin(stacked, 'b', 'c', types), false);
    equal(Stack.canJoin(base, 'a', 'a', types), false);
});

test('turning goes round, both ways', () => {
    let stacked = Stack.join(Stack.join(base, 'b', 'a', types), 'c', 'b', types);
    stacked = Stack.turn(stacked, 'stack-1', 1);
    equal(Stack.topOf(Stack.membersOf(stacked, 'stack-1')).id, 'a');
    stacked = Stack.turn(stacked, 'stack-1', -1);
    equal(Stack.topOf(Stack.membersOf(stacked, 'stack-1')).id, 'c');
    stacked = Stack.turn(stacked, 'stack-1', -1);
    equal(Stack.topOf(Stack.membersOf(stacked, 'stack-1')).id, 'b');
});

test('turning passes over members that cannot show', () => {
    let stacked = Stack.join(Stack.join(base, 'b', 'a', types), 'c', 'b', types);
    stacked = stacked.map(x => x.id === 'a' ? {...x, enabled: false} : x);
    stacked = Stack.turn(stacked, 'stack-1', 1, stacked.filter(x => x.enabled));
    equal(Stack.topOf(Stack.membersOf(stacked, 'stack-1')).id, 'b');
});

test('taking the top out leaves the next one on top, and two fall apart', () => {
    const three = Stack.join(Stack.join(base, 'b', 'a', types), 'c', 'b', types);
    const two = Stack.leave(three, 'c');
    equal(brief(two), ['a:stack-1*', 'b:stack-1', 'c', 'd']);
    equal(two.find(x => x.id === 'c').placed, false);
    equal(brief(Stack.leave(two, 'a')), ['a', 'b', 'c', 'd']);
});

test('a stack moves and resizes as one', () => {
    const stacked = Stack.setShared(Stack.join(base, 'b', 'a', types), 'b', {x: 99, size: 'medium'});
    equal(stacked.map(x => [x.x, x.size]), [[99, 'medium'], [99, 'medium'], [600, 'small'], [0, 'medium']]);
    equal(Stack.sharedSizes(Stack.join(base, 'a', 'd', types), 'a', types), ['medium']);
    equal(Stack.sharedSizes(base, 'a', types), ['small', 'medium']);
});

test('only the top of a stack shows, or the next when it cannot', () => {
    const stacked = Stack.join(base, 'b', 'a', types);
    equal(shownWidgets(stacked, {onBattery: false}).map(x => x.id), ['b', 'c', 'd']);
    const off = stacked.map(x => x.id === 'b' ? {...x, options: {hideOnBattery: true}} : x);
    equal(shownWidgets(off, {onBattery: true}).map(x => x.id), ['a', 'c', 'd']);
});

test('tidying mends a stack without a top and one with a single member', () => {
    const broken = [w('a', 'clock', {stack: 's'}), w('b', 'cpu', {stack: 's'}), w('c', 'cpu', {stack: 't', top: true})];
    equal(brief(Stack.tidy(broken)), ['a:s*', 'b:s', 'c']);
});

done('stack');
