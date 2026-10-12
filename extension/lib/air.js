// What Open-Meteo's air quality answer says, as the widget shows it.

// The European Air Quality Index: the upper end of each band and its name.
const BANDS = [[20, 'Good'], [40, 'Fair'], [60, 'Moderate'], [80, 'Poor'], [100, 'Very poor'], [Infinity, 'Extremely poor']];
const WARN_FROM = 60;
const BAD_FROM = 80;
// Where the index stands as a share: 100 and above is all of it.
const FULL = 100;

const POLLEN = {
    alder_pollen: 'Alder', birch_pollen: 'Birch', grass_pollen: 'Grass',
    mugwort_pollen: 'Mugwort', olive_pollen: 'Olive', ragweed_pollen: 'Ragweed',
};
// Grains per cubic metre. Rough bands: what bothers people differs by plant.
const POLLEN_BANDS = [[1, 'none'], [10, 'low'], [50, 'moderate'], [200, 'high'], [Infinity, 'very high']];

const band = (bands, value) => bands.find(([upTo]) => value < upTo)[1];
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;

// {index, name, share, tone, pm25, pm10, pollen} or null without an index.
// pollen: {plant, grains, level} of the strongest, or null where the
// service has none (it covers Europe only).
export function parseAir(json) {
    const current = json?.current;
    const index = number(current?.european_aqi);
    if (index === null)
        return null;
    const counts = Object.entries(POLLEN)
        .map(([key, plant]) => ({plant, grains: number(current[key])}))
        .filter(count => count.grains !== null);
    const strongest = counts.reduce((most, count) => !most || count.grains > most.grains ? count : most, null);
    return {
        index: Math.round(index),
        name: band(BANDS, index),
        share: Math.min(1, index / FULL),
        tone: index >= BAD_FROM ? 'bad' : index >= WARN_FROM ? 'warn' : 'primary',
        pm25: number(current.pm2_5),
        pm10: number(current.pm10),
        pollen: strongest ? {...strongest, level: band(POLLEN_BANDS, strongest.grains)} : null,
    };
}

// "Mugwort pollen: low", or that there is none in the air.
export function describePollen(pollen) {
    if (!pollen)
        return '';
    return pollen.level === 'none' ? 'No pollen' : `${pollen.plant} pollen: ${pollen.level}`;
}
