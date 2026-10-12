// Open-Meteo's answers, reduced to what the widgets show.

// WMO weather interpretation codes, as Open-Meteo reports them.
const CONDITIONS = [
    [[0], 'Clear', 'clear'],
    [[1, 2], 'Partly cloudy', 'few-clouds'],
    [[3], 'Overcast', 'overcast'],
    [[45, 48], 'Fog', 'fog'],
    [[51, 53, 55, 56, 57], 'Drizzle', 'showers-scattered'],
    [[61, 63, 65, 66, 67], 'Rain', 'showers'],
    [[71, 73, 75, 77, 85, 86], 'Snow', 'snow'],
    [[80, 81, 82], 'Showers', 'showers'],
    [[95, 96, 99], 'Thunderstorm', 'storm'],
];

// Only these two icons of the set have a night form.
const HAS_NIGHT = new Set(['clear', 'few-clouds']);

export function condition(code, isDay = true) {
    const found = CONDITIONS.find(([codes]) => codes.includes(code));
    if (!found)
        return {label: 'Unknown', icon: 'weather-overcast-symbolic'};
    const [, label, icon] = found;
    const night = !isDay && HAS_NIGHT.has(icon) ? '-night' : '';
    return {label, icon: `weather-${icon}${night}-symbolic`};
}

const HOURS_SHOWN = 6;
const DAYS_SHOWN = 5;
const SECOND = 1000;

// Asked with timeformat=unixtime. Returns null for an answer that lacks the
// current weather, so a broken reply never replaces a good one.
export function parseForecast(json, now) {
    const current = json?.current;
    if (!current || typeof current.temperature_2m !== 'number')
        return null;

    const hourly = json.hourly ?? {time: []};
    const hours = [];
    for (let i = 0; i < hourly.time.length && hours.length < HOURS_SHOWN; i++) {
        const time = hourly.time[i] * SECOND;
        // The running hour is the current weather; the list starts after it.
        if (time <= now)
            continue;
        hours.push({
            time,
            temperature: hourly.temperature_2m[i],
            code: hourly.weather_code[i],
            isDay: hourly.is_day?.[i] !== 0,
        });
    }

    const daily = json.daily ?? {time: []};
    const days = daily.time.slice(0, DAYS_SHOWN + 1).map((time, i) => ({
        time: time * SECOND,
        code: daily.weather_code[i],
        min: daily.temperature_2m_min[i],
        max: daily.temperature_2m_max[i],
    }));

    return {
        at: now,
        // Seconds east of UTC at the place, to print its local hours.
        utcOffset: json.utc_offset_seconds ?? 0,
        current: {
            temperature: current.temperature_2m,
            feelsLike: current.apparent_temperature ?? null,
            code: current.weather_code,
            isDay: current.is_day !== 0,
            wind: current.wind_speed_10m ?? null,
            humidity: current.relative_humidity_2m ?? null,
        },
        hours,
        today: days[0] ?? null,
        days: days.slice(1),
        sunrise: daily.sunrise?.[0] ? daily.sunrise[0] * SECOND : null,
        sunset: daily.sunset?.[0] ? daily.sunset[0] * SECOND : null,
        nextSunrise: daily.sunrise?.[1] ? daily.sunrise[1] * SECOND : null,
    };
}

// The geocoding answer as places to choose from.
export function parsePlaces(json) {
    return (json?.results ?? [])
        .filter(r => typeof r.latitude === 'number' && typeof r.longitude === 'number')
        .map(r => ({
            name: r.name,
            region: [r.admin1, r.country].filter(Boolean).join(', '),
            latitude: r.latitude,
            longitude: r.longitude,
            timezone: r.timezone ?? null,
        }));
}

// A stored place, or null when the setting is empty or damaged.
export function parsePlace(text) {
    try {
        const place = JSON.parse(text);
        if (typeof place.name === 'string' && typeof place.latitude === 'number' && typeof place.longitude === 'number')
            return place;
    } catch {
        // An empty setting is the normal case before a place is chosen.
    }
    return null;
}

// The hour and minute at the place, whatever this machine's time zone is.
export function localTime(ms, utcOffset) {
    const date = new Date(ms + utcOffset * SECOND);
    return {hours: date.getUTCHours(), minutes: date.getUTCMinutes(), weekday: (date.getUTCDay() + 6) % 7};
}

// Where the sun stands between rising and setting: 0–1 by day, null at night.
export function sunProgress(sunrise, sunset, now) {
    if (!sunrise || !sunset || sunset <= sunrise || now < sunrise || now > sunset)
        return null;
    return (now - sunrise) / (sunset - sunrise);
}
