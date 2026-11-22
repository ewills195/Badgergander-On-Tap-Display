import type { TapAssignment, TaproomSettings } from '../types/brewfather';

const KEYS = {
  USER_ID: 'bf_user_id',
  API_KEY: 'bf_api_key',
  TAP_ASSIGNMENTS: 'bf_tap_assignments',
  SETTINGS: 'bf_taproom_settings',
} as const;

export const DEFAULT_SETTINGS: TaproomSettings = {
  breweryName: 'Badgergander Homebrewery',
  tapLabels: ['Left Tap', 'Right Tap'],
  tempUnit: 'F',
  layoutMode: 'auto',
  refreshMinutes: 15,
  includeConditioningOnTap: true,
  showHiddenBatches: false,
};

export interface StoredCredentials {
  userId: string;
  apiKey: string;
}

export function getCredentials(): StoredCredentials {
  return {
    userId: localStorage.getItem(KEYS.USER_ID) || '',
    apiKey: localStorage.getItem(KEYS.API_KEY) || '',
  };
}

export function saveCredentials(userId: string, apiKey: string): void {
  localStorage.setItem(KEYS.USER_ID, userId.trim());
  localStorage.setItem(KEYS.API_KEY, apiKey.trim());
}

export function clearCredentials(): void {
  localStorage.removeItem(KEYS.USER_ID);
  localStorage.removeItem(KEYS.API_KEY);
}

export function getTapAssignments(): Record<string, TapAssignment> {
  try {
    const raw = localStorage.getItem(KEYS.TAP_ASSIGNMENTS);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    // Backward compatibility with prototype values ('Left Tap', 'Right Tap', 'On Deck')
    const normalized: Record<string, TapAssignment> = {};
    for (const [id, val] of Object.entries(parsed)) {
      if (val === 'Left Tap') normalized[id] = 'tap:0';
      else if (val === 'Right Tap') normalized[id] = 'tap:1';
      else if (val === 'On Deck') normalized[id] = 'on-deck';
      else normalized[id] = val;
    }
    return normalized;
  } catch {
    return {};
  }
}

export function saveTapAssignments(map: Record<string, TapAssignment>): void {
  localStorage.setItem(KEYS.TAP_ASSIGNMENTS, JSON.stringify(map));
}

export function getSettings(): TaproomSettings {
  try {
    const raw = localStorage.getItem(KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<TaproomSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      tapLabels:
        Array.isArray(parsed.tapLabels) && parsed.tapLabels.length > 0
          ? parsed.tapLabels
          : DEFAULT_SETTINGS.tapLabels,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: TaproomSettings): void {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export interface ExportedConfig {
  version: 1;
  credentials?: StoredCredentials;
  settings: TaproomSettings;
  tapAssignments: Record<string, TapAssignment>;
}

export function exportConfigJson(includeCredentials: boolean): string {
  const payload: ExportedConfig = {
    version: 1,
    settings: getSettings(),
    tapAssignments: getTapAssignments(),
  };
  if (includeCredentials) {
    payload.credentials = getCredentials();
  }
  return JSON.stringify(payload, null, 2);
}

export function importConfigJson(jsonText: string): {
  settings: TaproomSettings;
  tapAssignments: Record<string, TapAssignment>;
  credentials?: StoredCredentials;
} {
  const parsed = JSON.parse(jsonText) as Partial<ExportedConfig>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid configuration JSON.');
  }
  const nextSettings: TaproomSettings = {
    ...DEFAULT_SETTINGS,
    ...(parsed.settings || {}),
  };
  saveSettings(nextSettings);

  const nextAssignments = parsed.tapAssignments || {};
  saveTapAssignments(nextAssignments);

  if (parsed.credentials?.userId && parsed.credentials?.apiKey) {
    saveCredentials(parsed.credentials.userId, parsed.credentials.apiKey);
  }

  return {
    settings: nextSettings,
    tapAssignments: nextAssignments,
    credentials: parsed.credentials,
  };
}
