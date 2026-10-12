// The weather from Open-Meteo, a free service that needs no account. The
// only thing sent is the chosen place: its coordinates for the forecast,
// the typed name for the search.

import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import {parseAir} from '../air.js';
import * as Weather from '../weather.js';
import {polled} from '../hub.js';

const INTERVAL = 30 * 60;
const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const AIR_INTERVAL = 60 * 60;
const SEARCH = 'https://geocoding-api.open-meteo.com/v1/search';
const TIMEOUT = 20;

export function newSession() {
    return new Soup.Session({user_agent: 'Ledge (GNOME Shell extension)', timeout: TIMEOUT});
}

function getJson(session, url) {
    return new Promise((resolve, reject) => {
        const message = Soup.Message.new('GET', url);
        session.send_and_read_async(message, GLib.PRIORITY_LOW, null, (_session, result) => {
            try {
                const bytes = session.send_and_read_finish(result);
                if (message.get_status() !== Soup.Status.OK)
                    throw new Error(`HTTP ${message.get_status()}`);
                resolve(JSON.parse(new TextDecoder().decode(bytes.get_data())));
            } catch (e) {
                reject(e);
            }
        });
    });
}

function query(parameters) {
    return Object.entries(parameters).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
}

export async function searchPlaces(session, name) {
    const json = await getJson(session, `${SEARCH}?${query({name, count: 5, language: 'en', format: 'json'})}`);
    return Weather.parsePlaces(json);
}

async function fetchForecast(session, place) {
    const json = await getJson(session, `${FORECAST}?${query({
        latitude: place.latitude.toFixed(3),
        longitude: place.longitude.toFixed(3),
        current: 'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m',
        hourly: 'temperature_2m,weather_code,is_day',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset',
        forecast_days: 6,
        forecast_hours: 8,
        timeformat: 'unixtime',
        timezone: 'auto',
    })}`);
    return Weather.parseForecast(json, Date.now());
}

// Emits {place, forecast, problem}. A failed request keeps the last
// forecast of the same place and says that it could not be renewed.
export function weather(_parameter, env) {
    let session = null;
    let last = null;
    const source = polled(INTERVAL, async () => {
        const place = env.place();
        if (!place)
            return {place: null, forecast: null, problem: null};
        if (last && last.place.name !== place.name)
            last = null;
        try {
            const forecast = await fetchForecast(session, place);
            if (forecast)
                last = {place, forecast};
            return {place, forecast: last?.forecast ?? null, problem: forecast ? null : 'failed'};
        } catch (e) {
            console.debug(`Ledge: weather request failed: ${e.message}`);
            return {place, forecast: last?.forecast ?? null, problem: 'failed'};
        }
    }, env);
    return {
        start(emit) {
            session ??= newSession();
            source.start(emit);
        },
        stop() {
            source.stop();
        },
        destroy() {
            session?.abort();
            session = null;
        },
    };
}

async function fetchAir(session, place) {
    const json = await getJson(session, `${AIR}?${query({
        latitude: place.latitude.toFixed(3),
        longitude: place.longitude.toFixed(3),
        current: 'european_aqi,pm10,pm2_5,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen',
        timezone: 'auto',
    })}`);
    return parseAir(json);
}

// Emits {place, air, problem} for the place of the weather, the way the
// forecast does.
export function air(_parameter, env) {
    let session = null;
    let last = null;
    const source = polled(AIR_INTERVAL, async () => {
        const place = env.place();
        if (!place)
            return {place: null, air: null, problem: null};
        if (last && last.place.name !== place.name)
            last = null;
        try {
            const reading = await fetchAir(session, place);
            if (reading)
                last = {place, air: reading};
            return {place, air: last?.air ?? null, problem: reading ? null : 'failed'};
        } catch (e) {
            console.debug(`Ledge: air quality request failed: ${e.message}`);
            return {place, air: last?.air ?? null, problem: 'failed'};
        }
    }, env);
    return {
        start(emit) {
            session ??= newSession();
            source.start(emit);
        },
        stop() {
            source.stop();
        },
        destroy() {
            session?.abort();
            session = null;
        },
    };
}
