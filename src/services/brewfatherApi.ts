import type {
  BatchStatus,
  BrewfatherBatch,
  BrewfatherReading,
  TaproomData,
  TempUnit,
} from '../types/brewfather';

const BASE_URL = 'https://api.brewfather.app/v2';

export class BrewfatherApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = 'BrewfatherApiError';
    this.status = status;
  }
}

function buildAuthHeader(userId: string, apiKey: string): string {
  return 'Basic ' + btoa(`${userId.trim()}:${apiKey.trim()}`);
}

export async function brewfatherFetch<T>(
  endpoint: string,
  userId: string,
  apiKey: string
): Promise<T> {
  const response = await fetch(`${BASE_URL}/${endpoint}`, {
    headers: {
      Authorization: buildAuthHeader(userId, apiKey),
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new BrewfatherApiError(
        'Invalid Brewfather User ID or API Key, or missing batches.read scope.',
        response.status
      );
    }
    if (response.status === 429) {
      throw new BrewfatherApiError(
        'Brewfather API rate limit reached. Try increasing the refresh interval.',
        429
      );
    }
    throw new BrewfatherApiError(
      `Brewfather API error (${response.status} ${response.statusText})`,
      response.status
    );
  }

  return response.json() as Promise<T>;
}

async function fetchBatchesByStatus(
  status: BatchStatus,
  userId: string,
  apiKey: string,
  limit = 50
): Promise<BrewfatherBatch[]> {
  return brewfatherFetch<BrewfatherBatch[]>(
    `batches?status=${encodeURIComponent(status)}&complete=true&limit=${limit}`,
    userId,
    apiKey
  );
}

export async function fetchBatchReadings(
  batchId: string,
  userId: string,
  apiKey: string
): Promise<BrewfatherReading[]> {
  const raw = await brewfatherFetch<BrewfatherReading[]>(
    `batches/${encodeURIComponent(batchId)}/readings`,
    userId,
    apiKey
  );

  return raw
    .map((r) => ({
      ...r,
      // Normalize seconds to ms if an older device logged seconds
      time: r.time < 1e12 ? r.time * 1000 : r.time,
    }))
    .sort((a, b) => a.time - b.time);
}

export async function fetchAllTaproomData(
  userId: string,
  apiKey: string
): Promise<TaproomData> {
  const [completed, conditioning, fermenting, brewing, planning] =
    await Promise.all([
      fetchBatchesByStatus('Completed', userId, apiKey, 50),
      fetchBatchesByStatus('Conditioning', userId, apiKey, 25),
      fetchBatchesByStatus('Fermenting', userId, apiKey, 25),
      fetchBatchesByStatus('Brewing', userId, apiKey, 10),
      fetchBatchesByStatus('Planning', userId, apiKey, 25),
    ]);

  // Fetch telemetry readings for active fermenting and conditioning batches
  const telemetryBatches = [...fermenting, ...conditioning];
  const readingsEntries = await Promise.all(
    telemetryBatches.map(async (batch) => {
      try {
        const readings = await fetchBatchReadings(batch._id, userId, apiKey);
        return [batch._id, readings] as const;
      } catch (err) {
        console.warn(`Could not load readings for batch ${batch._id}:`, err);
        return [batch._id, [] as BrewfatherReading[]] as const;
      }
    })
  );

  const readingsByBatch: Record<string, BrewfatherReading[]> = {};
  for (const [id, readings] of readingsEntries) {
    readingsByBatch[id] = readings;
  }

  return {
    completed,
    conditioning,
    fermenting,
    brewing,
    planning,
    readingsByBatch,
    fetchedAt: Date.now(),
  };
}

// --- Domain calculation & formatting helpers ---

export function getBatchName(batch: BrewfatherBatch): string {
  if (batch.name && batch.name !== 'Batch') {
    return batch.name;
  }
  return batch.recipe?.name || batch.name || 'Unnamed Batch';
}

export function getStyleName(batch: BrewfatherBatch): string {
  return batch.recipe?.style?.name || batch.style || 'Custom Style';
}

export function getAbv(batch: BrewfatherBatch): number | null {
  const val = batch.measuredAbv ?? batch.abv ?? batch.recipe?.abv;
  return typeof val === 'number' && !Number.isNaN(val) ? val : null;
}

export function getIbu(batch: BrewfatherBatch): number | null {
  const val =
    batch.measuredIbu ??
    batch.ibu ??
    batch.estimatedIbu ??
    batch.recipe?.ibu;
  return typeof val === 'number' && !Number.isNaN(val) ? val : null;
}

export function getSrm(batch: BrewfatherBatch): number | null {
  const val =
    batch.measuredColor ??
    batch.color ??
    batch.estimatedColor ??
    batch.recipe?.color;
  return typeof val === 'number' && !Number.isNaN(val) ? val : null;
}

export function getOg(batch: BrewfatherBatch): number | null {
  const val =
    batch.measuredOg ?? batch.og ?? batch.estimatedOg ?? batch.recipe?.og;
  return typeof val === 'number' && !Number.isNaN(val) ? val : null;
}

export function getEstFg(batch: BrewfatherBatch): number | null {
  const val = batch.estimatedFg ?? batch.fg ?? batch.recipe?.fg;
  return typeof val === 'number' && !Number.isNaN(val) ? val : null;
}

export function cToF(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

export function formatTemp(celsius: number | null | undefined, unit: TempUnit): string {
  if (celsius == null || Number.isNaN(celsius)) return '—';
  const converted = unit === 'F' ? cToF(celsius) : celsius;
  return `${converted.toFixed(1)}°${unit}`;
}

export function convertTempValue(celsius: number, unit: TempUnit): number {
  return unit === 'F' ? Number(cToF(celsius).toFixed(1)) : Number(celsius.toFixed(1));
}

export function calcTargetAttenuationProgress(
  og: number | null,
  currentSg: number | null | undefined,
  estFg: number | null
): number | null {
  if (og == null || currentSg == null || estFg == null || og <= estFg) {
    return null;
  }
  const pct = ((og - currentSg) / (og - estFg)) * 100;
  return Math.min(Math.max(pct, 0), 100);
}

export function calcApparentAttenuation(
  og: number | null,
  currentSg: number | null | undefined
): number | null {
  if (og == null || currentSg == null || og <= 1.0) {
    return null;
  }
  const aa = ((og - currentSg) / (og - 1.0)) * 100;
  return Math.min(Math.max(aa, 0), 100);
}

export function calcLiveAbv(
  og: number | null,
  currentSg: number | null | undefined
): number | null {
  if (og == null || currentSg == null || og <= currentSg) {
    return null;
  }
  return (og - currentSg) * 131.25;
}

const SRM_TABLE: Array<{ srm: number; hex: string }> = [
  { srm: 1, hex: '#F8F753' },
  { srm: 2, hex: '#F6F513' },
  { srm: 3, hex: '#ECE81A' },
  { srm: 4, hex: '#DFD21D' },
  { srm: 5, hex: '#D8BC23' },
  { srm: 6, hex: '#D1A825' },
  { srm: 7, hex: '#CA9627' },
  { srm: 8, hex: '#C18527' },
  { srm: 9, hex: '#B87628' },
  { srm: 10, hex: '#B06929' },
  { srm: 11, hex: '#A65D2A' },
  { srm: 12, hex: '#9F532B' },
  { srm: 13, hex: '#94492B' },
  { srm: 14, hex: '#8D402B' },
  { srm: 15, hex: '#85372B' },
  { srm: 16, hex: '#7C2F2B' },
  { srm: 17, hex: '#772A2A' },
  { srm: 18, hex: '#6F2229' },
  { srm: 19, hex: '#681C29' },
  { srm: 20, hex: '#631829' },
  { srm: 22, hex: '#5B1328' },
  { srm: 24, hex: '#530F26' },
  { srm: 26, hex: '#4D0C25' },
  { srm: 28, hex: '#480A24' },
  { srm: 30, hex: '#430822' },
  { srm: 35, hex: '#3A061F' },
  { srm: 40, hex: '#31041B' },
];

export function srmToHex(srm: number | null | undefined): string {
  if (srm == null || Number.isNaN(srm)) return '#D8BC23';
  if (srm <= 1) return SRM_TABLE[0].hex;
  if (srm >= 40) return SRM_TABLE[SRM_TABLE.length - 1].hex;

  for (let i = 0; i < SRM_TABLE.length - 1; i++) {
    if (srm >= SRM_TABLE[i].srm && srm <= SRM_TABLE[i + 1].srm) {
      return SRM_TABLE[i].hex;
    }
  }
  return '#31041B';
}

export function formatShortDate(timestamp?: number): string {
  if (!timestamp) return '—';
  const normalized = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  return new Date(normalized).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function daysElapsedSince(timestamp?: number): number | null {
  if (!timestamp) return null;
  const normalized = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const diff = Date.now() - normalized;
  if (diff < 0) return 0;
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
}
