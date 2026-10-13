import {test, equal, done} from './harness.js';
import {HIGHEST_SWELL, IDLE_SPEED, RUNNING_SPEED, advance, swellOf} from '../extension/lib/wave.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;

test('a wave travels forward at its idle speed, faster while running', () => {
    equal(near(advance(0, 1), IDLE_SPEED), true);
    equal(near(advance(0, 0.5, {running: true}), RUNNING_SPEED / 2), true);
});

test('a wave travels back when its direction is turned', () => {
    equal(near(advance(0.5, 1, {direction: -1}), 0.5 - IDLE_SPEED), true);
});

test('the phase stays within one wavelength, either way', () => {
    for (const direction of [1, -1]) {
        let phase = 0;
        for (let i = 0; i < 500; i++) {
            phase = advance(phase, 0.1, {running: true, direction, stir: 1});
            equal(phase >= 0 && phase < 1, true);
        }
    }
});

test('a stirred wave travels faster and stands higher, a calm one as before', () => {
    equal(advance(0, 0.1, {stir: 1}) > advance(0, 0.1), true);
    equal(swellOf({stir: 1}) > 1, true);
    equal(swellOf({stir: 0}), 1);
    equal(near(advance(0, 0.1, {stir: -0.02}), advance(0, 0.1)), true);
});

test('a wave never stands higher than its room, nor below flat', () => {
    equal(swellOf({swell: 1.15, stir: 1}), HIGHEST_SWELL);
    equal(swellOf({swell: -0.1}), 0);
    equal(swellOf({swell: 0, stir: 1}), 0);
});

test('an urgent wave sinks to half and comes back, starting at full', () => {
    equal(swellOf({urgent: true, beat: 0}), 1);
    equal(near(swellOf({urgent: true, beat: 0.6}), 0.5), true);
    equal(near(swellOf({urgent: true, beat: 1.2}), 1), true);
    equal(swellOf({urgent: false, beat: 0.6}), 1);
});

done('wave');
