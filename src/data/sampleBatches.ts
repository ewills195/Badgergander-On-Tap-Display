import type { BrewfatherReading, TaproomData } from '../types/brewfather';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function generateFermentationCurve(
  days: number,
  og: number,
  currentSg: number,
  startTempC: number,
  endTempC: number,
  liveRecent: boolean
): BrewfatherReading[] {
  const now = Date.now();
  const start = now - days * DAY_MS;
  const points = days * 4; // every 6 hours
  const readings: BrewfatherReading[] = [];

  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const timestamp =
      i === points && liveRecent ? now - 12 * 60 * 1000 : start + t * (days * DAY_MS - (liveRecent ? 12 * 60 * 1000 : 4 * HOUR_MS));
    // Logistic-like fermentation drop after 12h lag phase
    const lagAdjusted = Math.max(0, (t - 0.08) / 0.92);
    const curve = 1 - Math.pow(1 - lagAdjusted, 2.4);
    const jitter = Math.sin(i * 1.7) * 0.0005;
    const sg = Number((og - (og - currentSg) * curve + (i === points ? 0 : jitter)).toFixed(4));
    const temp = Number(
      (startTempC + (endTempC - startTempC) * Math.pow(t, 1.5) + Math.cos(i * 0.9) * 0.25).toFixed(2)
    );
    readings.push({
      time: Math.round(timestamp),
      sg: Math.min(og, Math.max(currentSg - 0.001, sg)),
      temp,
      battery: 3.92,
    });
  }
  return readings;
}

export function createSampleTaproomData(): TaproomData {
  const now = Date.now();

  const readings1 = generateFermentationCurve(8, 1.064, 1.014, 19.2, 21.1, true);
  const readings2 = generateFermentationCurve(14, 1.050, 1.010, 10.5, 2.4, false);

  return {
    completed: [
      {
        _id: 'sample-tap-1',
        name: 'Northwoods Haze',
        batchNo: 42,
        status: 'Completed',
        brewDate: now - 34 * DAY_MS,
        bottlingDate: now - 16 * DAY_MS,
        measuredAbv: 6.7,
        ibu: 48,
        color: 5.8,
        measuredOg: 1.063,
        measuredFg: 1.012,
        tastingNotes: 'Lush pineapple, ripe peach, and soft pillowy oats with a clean citrus peel finish.',
        recipe: {
          name: 'Northwoods Haze',
          style: { name: 'New England IPA' },
          abv: 6.6,
          ibu: 48,
          color: 5.8,
          og: 1.062,
          fg: 1.012,
          boilTime: 60,
          batchSize: 19,
          fermentables: [
            { name: 'Maris Otter Pale Ale', amount: 4.5, percentage: 72 },
            { name: 'Flaked Oats', amount: 1.0, percentage: 16 },
            { name: 'White Wheat Malt', amount: 0.75, percentage: 12 },
          ],
          hops: [
            { name: 'Citra', amount: 85, time: 15, use: 'Aroma' },
            { name: 'Mosaic', amount: 85, time: 15, use: 'Aroma' },
            { name: 'Galaxy', amount: 100, time: 4, use: 'Dry Hop' },
          ],
          yeasts: [{ name: 'London Ale III', laboratory: 'Wyeast', productId: '1318' }],
        },
      },
      {
        _id: 'sample-tap-2',
        name: 'Midnight Badger Porter',
        batchNo: 41,
        status: 'Completed',
        brewDate: now - 52 * DAY_MS,
        bottlingDate: now - 28 * DAY_MS,
        measuredAbv: 5.6,
        ibu: 31,
        color: 29.4,
        measuredOg: 1.055,
        measuredFg: 1.013,
        tastingNotes: 'Dark cacao nibs, toasted hazelnut, and subtle espresso roast with balanced bitterness.',
        recipe: {
          name: 'Midnight Badger Porter',
          style: { name: 'English Porter' },
          abv: 5.6,
          ibu: 31,
          color: 29.4,
          og: 1.055,
          fg: 1.013,
          boilTime: 60,
          batchSize: 19,
          fermentables: [
            { name: 'Golden Promise', amount: 4.1, percentage: 77 },
            { name: 'Brown Malt', amount: 0.55, percentage: 10 },
            { name: 'Crystal 60L', amount: 0.4, percentage: 7.5 },
            { name: 'Chocolate Malt', amount: 0.3, percentage: 5.5 },
          ],
          hops: [
            { name: 'East Kent Goldings', amount: 45, time: 60, use: 'Boil' },
            { name: 'Fuggle', amount: 25, time: 15, use: 'Boil' },
          ],
          yeasts: [{ name: 'SafAle S-04', laboratory: 'Fermentis', productId: 'S-04' }],
        },
      },
      {
        _id: 'sample-tap-3',
        name: 'Copper Kettle Amber',
        batchNo: 40,
        status: 'Completed',
        brewDate: now - 68 * DAY_MS,
        bottlingDate: now - 45 * DAY_MS,
        measuredAbv: 5.4,
        ibu: 27,
        color: 14.2,
        measuredOg: 1.052,
        measuredFg: 1.011,
        tastingNotes: 'Toasted Munich bread crust, caramel toffee, and crisp Willamette floral finish.',
        recipe: {
          name: 'Copper Kettle Amber',
          style: { name: 'American Amber Ale' },
          abv: 5.4,
          ibu: 27,
          color: 14.2,
          og: 1.052,
          fg: 1.011,
          yeasts: [{ name: 'US-05', laboratory: 'Fermentis', productId: 'US-05' }],
        },
      },
    ],
    conditioning: [
      {
        _id: 'sample-cond-1',
        name: 'Frostbite Pilsner',
        batchNo: 43,
        status: 'Conditioning',
        brewDate: now - 14 * DAY_MS,
        measuredOg: 1.050,
        measuredFg: 1.010,
        estimatedFg: 1.009,
        abv: 5.2,
        ibu: 36,
        color: 3.1,
        tastingNotes: 'Cold-crashing at 36°F before transfer to serving keg.',
        recipe: {
          name: 'Frostbite Pilsner',
          style: { name: 'Czech Premium Pale Lager' },
          abv: 5.2,
          ibu: 36,
          color: 3.1,
          og: 1.050,
          fg: 1.009,
          hops: [{ name: 'Saaz', amount: 110, time: 60, use: 'Boil' }],
          yeasts: [{ name: 'Bohemian Lager', laboratory: 'Wyeast', productId: '2124' }],
        },
      },
    ],
    fermenting: [
      {
        _id: 'sample-ferm-1',
        name: 'Red Pine West Coast IPA',
        batchNo: 44,
        status: 'Fermenting',
        brewDate: now - 8 * DAY_MS,
        fermentationStartDate: now - 8 * DAY_MS,
        measuredOg: 1.064,
        estimatedFg: 1.011,
        ibu: 68,
        color: 6.4,
        batchNotes: 'Day 5 dry hop with Simcoe and Centennial. Tilt hydrometer active.',
        recipe: {
          name: 'Red Pine West Coast IPA',
          style: { name: 'American IPA' },
          abv: 7.0,
          ibu: 68,
          color: 6.4,
          og: 1.064,
          fg: 1.011,
          hops: [
            { name: 'Centennial', amount: 60, time: 60, use: 'Boil' },
            { name: 'Simcoe', amount: 75, time: 10, use: 'Boil' },
            { name: 'Amarillo', amount: 60, time: 5, use: 'Dry Hop' },
          ],
          yeasts: [{ name: 'Chico Ale', laboratory: 'White Labs', productId: 'WLP001' }],
        },
      },
    ],
    brewing: [],
    planning: [
      {
        _id: 'sample-plan-1',
        name: 'Velvet Antler Belgian Dubbel',
        batchNo: 45,
        status: 'Planning',
        brewDate: now + 5 * DAY_MS,
        recipe: {
          name: 'Velvet Antler Belgian Dubbel',
          style: { name: 'Belgian Dubbel' },
          abv: 7.4,
          ibu: 22,
          color: 18.5,
          og: 1.068,
          fg: 1.012,
          yeasts: [{ name: 'Belgian Abbey II', laboratory: 'Wyeast', productId: '1762' }],
        },
      },
      {
        _id: 'sample-plan-2',
        name: 'Golden Hour Kölsch',
        batchNo: 46,
        status: 'Planning',
        brewDate: now + 18 * DAY_MS,
        recipe: {
          name: 'Golden Hour Kölsch',
          style: { name: 'Kölsch' },
          abv: 4.8,
          ibu: 24,
          color: 3.4,
          og: 1.046,
          fg: 1.009,
          yeasts: [{ name: 'Kölsch', laboratory: 'Wyeast', productId: '2565' }],
        },
      },
    ],
    readingsByBatch: {
      'sample-ferm-1': readings1,
      'sample-cond-1': readings2,
    },
    fetchedAt: now,
  };
}
