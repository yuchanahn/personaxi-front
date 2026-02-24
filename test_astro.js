import pkg from 'circular-natal-horoscope-js';
const { Origin, Horoscope } = pkg;

const origin = new Origin({
    year: 1990,
    month: 0, // Jan (0)?
    date: 1,
    hour: 12,
    minute: 0,
    latitude: 37.5665,
    longitude: 126.9780
});

const horoscope = new Horoscope({
    origin: origin,
    houseSystem: "placidus",
    zodiac: "tropical",
    aspectPoints: ['bodies', 'points', 'angles'],
    aspectWithPoints: ['bodies', 'points', 'angles'],
    aspectTypes: ["major", "minor"],
    customOrbs: {},
    language: 'en'
});

console.log("Sun:", horoscope.CelestialBodies.sun.ChartPosition.Ecliptic.DecimalDegrees);
console.log("Ascendant:", horoscope.Angles.ascendant.ChartPosition.Ecliptic.DecimalDegrees);
console.log("Houses:");
horoscope.Houses.forEach(h => {
    console.log(h.id, h.ChartPosition.StartPosition.Ecliptic.DecimalDegrees);
});
