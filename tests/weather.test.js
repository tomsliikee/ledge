import {test, equal, done} from './harness.js';
import * as Weather from '../extension/lib/weather.js';

const NOW = 1_000_000 * 1000;
const HOUR = 3600;
const ANSWER = {
    utc_offset_seconds: 7200,
    current: {temperature_2m: 14.2, apparent_temperature: 12.9, weather_code: 61, is_day: 1, wind_speed_10m: 11, relative_humidity_2m: 80},
    hourly: {
        time: [1_000_000 - HOUR, 1_000_000, 1_000_000 + HOUR, 1_000_000 + 2 * HOUR],
        temperature_2m: [13, 14, 15, 16],
        weather_code: [3, 61, 2, 0],
        is_day: [1, 1, 1, 0],
    },
    daily: {
        time: [950_000, 950_000 + 24 * HOUR, 950_000 + 48 * HOUR],
        weather_code: [61, 3, 0],
        temperature_2m_min: [9, 8, 7],
        temperature_2m_max: [15, 17, 19],
        sunrise: [980_000, 1_066_000, 0],
        sunset: [1_020_000, 0, 0],
    },
};

test('forecast keeps the current weather and the hours still to come', () => {
    const forecast = Weather.parseForecast(ANSWER, NOW);
    equal(forecast.current.temperature, 14.2);
    equal(forecast.hours.map(h => h.temperature), [15, 16]);
    equal(forecast.hours[1].isDay, false);
});

test('forecast separates today from the days after', () => {
    const forecast = Weather.parseForecast(ANSWER, NOW);
    equal(forecast.today, {time: 950_000_000, code: 61, min: 9, max: 15});
    equal(forecast.days.map(d => d.max), [17, 19]);
    equal([forecast.sunrise, forecast.sunset, forecast.nextSunrise], [980_000_000, 1_020_000_000, 1_066_000_000]);
});

test('an answer without current weather is refused', () => {
    equal(Weather.parseForecast({error: true}, NOW), null);
    equal(Weather.parseForecast(null, NOW), null);
});

test('weather codes map to a label and an icon', () => {
    equal(Weather.condition(0), {label: 'Clear', icon: 'weather-clear-symbolic'});
    equal(Weather.condition(0, false).icon, 'weather-clear-night-symbolic');
    equal(Weather.condition(63, false), {label: 'Rain', icon: 'weather-showers-symbolic'});
    equal(Weather.condition(12345).label, 'Unknown');
});

test('places carry their region and coordinates', () => {
    const json = {results: [
        {name: 'Vienna', admin1: 'Vienna', country: 'Austria', latitude: 48.2, longitude: 16.4, timezone: 'Europe/Vienna'},
        {name: 'Broken'},
    ]};
    equal(Weather.parsePlaces(json), [{name: 'Vienna', region: 'Vienna, Austria', latitude: 48.2, longitude: 16.4, timezone: 'Europe/Vienna'}]);
    equal(Weather.parsePlaces({}), []);
});

test('a stored place must be complete', () => {
    equal(Weather.parsePlace(''), null);
    equal(Weather.parsePlace('{"name":"X"}'), null);
    equal(Weather.parsePlace('{"name":"X","latitude":1,"longitude":2}').name, 'X');
});

test('local time follows the place, not this machine', () => {
    equal(Weather.localTime(Date.UTC(2026, 9, 12, 23, 30), 7200), {hours: 1, minutes: 30, weekday: 1});
});

test('sun progress is null at night', () => {
    equal(Weather.sunProgress(100, 200, 150), 0.5);
    equal(Weather.sunProgress(100, 200, 250), null);
    equal(Weather.sunProgress(null, 200, 150), null);
});

done('weather');
