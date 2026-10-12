import {test, equal, done} from './harness.js';
import {describePollen, parseAir} from '../extension/lib/air.js';

// Open-Meteo's answer for Vienna on 2026-10-12, shortened.
const vienna = {current: {
    european_aqi: 31, pm10: 13.4, pm2_5: 8.6, ozone: 39.0,
    alder_pollen: 0.0, birch_pollen: 0.0, grass_pollen: 0.2, mugwort_pollen: 1.7, olive_pollen: 0.0, ragweed_pollen: 0.0,
}};

test('a real answer is read', () => {
    equal(parseAir(vienna), {
        index: 31, name: 'Fair', share: 0.31, tone: 'primary', pm25: 8.6, pm10: 13.4,
        pollen: {plant: 'Mugwort', grains: 1.7, level: 'low'},
    });
});

test('the bands of the index and where the colours turn', () => {
    const at = index => parseAir({current: {european_aqi: index}});
    equal([at(0).name, at(19.9).name, at(20).name, at(59).name], ['Good', 'Good', 'Fair', 'Moderate']);
    equal([at(59).tone, at(60).tone, at(80).tone], ['primary', 'warn', 'bad']);
    equal([at(140).name, at(140).share], ['Extremely poor', 1]);
});

test('outside Europe there is no pollen, and without an index nothing', () => {
    equal(parseAir({current: {european_aqi: 50, grass_pollen: null}}).pollen, null);
    equal(parseAir({current: {}}), null);
    equal(parseAir(null), null);
});

test('pollen is put in words', () => {
    equal(describePollen({plant: 'Birch', grains: 80, level: 'high'}), 'Birch pollen: high');
    equal(describePollen({plant: 'Grass', grains: 0.2, level: 'none'}), 'No pollen');
    equal(describePollen(null), '');
});

done('air');
