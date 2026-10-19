import * as vscode from 'vscode';

export interface CityPreset {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  recommendedMethod?: string;
}

export const CITY_PRESETS: CityPreset[] = [
  { name: 'Makkah', country: 'Saudi Arabia', latitude: 21.4225, longitude: 39.8262, recommendedMethod: 'UmmAlQura' },
  { name: 'Madinah', country: 'Saudi Arabia', latitude: 24.4672, longitude: 39.6112, recommendedMethod: 'UmmAlQura' },
  { name: 'Riyadh', country: 'Saudi Arabia', latitude: 24.7136, longitude: 46.6753, recommendedMethod: 'UmmAlQura' },
  { name: 'Jeddah', country: 'Saudi Arabia', latitude: 21.5433, longitude: 39.1728, recommendedMethod: 'UmmAlQura' },
  { name: 'Cairo', country: 'Egypt', latitude: 30.0444, longitude: 31.2357, recommendedMethod: 'Egyptian' },
  { name: 'Alexandria', country: 'Egypt', latitude: 31.2001, longitude: 29.9187, recommendedMethod: 'Egyptian' },
  { name: 'Istanbul', country: 'Turkey', latitude: 41.0082, longitude: 28.9784, recommendedMethod: 'Turkey' },
  { name: 'Ankara', country: 'Turkey', latitude: 39.9334, longitude: 32.8597, recommendedMethod: 'Turkey' },
  { name: 'Dubai', country: 'UAE', latitude: 25.2048, longitude: 55.2708, recommendedMethod: 'Dubai' },
  { name: 'Abu Dhabi', country: 'UAE', latitude: 24.4539, longitude: 54.3773, recommendedMethod: 'Dubai' },
  { name: 'Doha', country: 'Qatar', latitude: 25.2854, longitude: 51.5310, recommendedMethod: 'Qatar' },
  { name: 'Kuwait City', country: 'Kuwait', latitude: 29.3759, longitude: 47.9774, recommendedMethod: 'Kuwait' },
  { name: 'Amman', country: 'Jordan', latitude: 31.9454, longitude: 35.9284, recommendedMethod: 'MuslimWorldLeague' },
  { name: 'Jerusalem (Al-Quds)', country: 'Palestine', latitude: 31.7683, longitude: 35.2137, recommendedMethod: 'MuslimWorldLeague' },
  { name: 'Casablanca', country: 'Morocco', latitude: 33.5731, longitude: -7.5898, recommendedMethod: 'MuslimWorldLeague' },
  { name: 'Algiers', country: 'Algeria', latitude: 36.7538, longitude: 3.0588, recommendedMethod: 'MuslimWorldLeague' },
  { name: 'Tunis', country: 'Tunisia', latitude: 36.8065, longitude: 10.1815, recommendedMethod: 'MuslimWorldLeague' },
  { name: 'Karachi', country: 'Pakistan', latitude: 24.8607, longitude: 67.0011, recommendedMethod: 'Karachi' },
  { name: 'Lahore', country: 'Pakistan', latitude: 31.5204, longitude: 74.3587, recommendedMethod: 'Karachi' },
  { name: 'Islamabad', country: 'Pakistan', latitude: 33.6844, longitude: 73.0479, recommendedMethod: 'Karachi' },
  { name: 'Dhaka', country: 'Bangladesh', latitude: 23.8103, longitude: 90.4125, recommendedMethod: 'Karachi' },
  { name: 'Jakarta', country: 'Indonesia', latitude: -6.2088, longitude: 106.8456, recommendedMethod: 'Singapore' },
  { name: 'Kuala Lumpur', country: 'Malaysia', latitude: 3.1390, longitude: 101.6869, recommendedMethod: 'Singapore' },
  { name: 'Singapore', country: 'Singapore', latitude: 1.3521, longitude: 103.8198, recommendedMethod: 'Singapore' },
  { name: 'London', country: 'United Kingdom', latitude: 51.5074, longitude: -0.1278, recommendedMethod: 'MoonsightingCommittee' },
  { name: 'Birmingham', country: 'United Kingdom', latitude: 52.4862, longitude: -1.8904, recommendedMethod: 'MoonsightingCommittee' },
  { name: 'Paris', country: 'France', latitude: 48.8566, longitude: 2.3522, recommendedMethod: 'MuslimWorldLeague' },
  { name: 'Berlin', country: 'Germany', latitude: 52.5200, longitude: 13.4050, recommendedMethod: 'MuslimWorldLeague' },
  { name: 'New York', country: 'United States', latitude: 40.7128, longitude: -74.0060, recommendedMethod: 'NorthAmerica' },
  { name: 'Chicago', country: 'United States', latitude: 41.8781, longitude: -87.6298, recommendedMethod: 'NorthAmerica' },
  { name: 'Houston', country: 'United States', latitude: 29.7604, longitude: -95.3698, recommendedMethod: 'NorthAmerica' },
  { name: 'Los Angeles', country: 'United States', latitude: 34.0522, longitude: -118.2437, recommendedMethod: 'NorthAmerica' },
  { name: 'Toronto', country: 'Canada', latitude: 43.6532, longitude: -79.3832, recommendedMethod: 'NorthAmerica' },
  { name: 'Sydney', country: 'Australia', latitude: -33.8688, longitude: 151.2093, recommendedMethod: 'MuslimWorldLeague' }
];

export interface DetectedLocation {
  latitude: number;
  longitude: number;
  cityName: string;
  countryCode?: string;
}

export function suggestCalculationMethodByCountry(countryCode?: string): string | undefined {
  if (!countryCode) {
    return undefined;
  }
  const code = countryCode.toUpperCase();
  if (['SA', 'YE', 'BH', 'OM'].includes(code)) {
    return 'UmmAlQura';
  }
  if (['AE'].includes(code)) {
    return 'Dubai';
  }
  if (['QA'].includes(code)) {
    return 'Qatar';
  }
  if (['KW'].includes(code)) {
    return 'Kuwait';
  }
  if (['EG', 'SD', 'SY', 'LB'].includes(code)) {
    return 'Egyptian';
  }
  if (['TR'].includes(code)) {
    return 'Turkey';
  }
  if (['PK', 'BD', 'IN', 'AF'].includes(code)) {
    return 'Karachi';
  }
  if (['SG', 'MY', 'ID', 'BN'].includes(code)) {
    return 'Singapore';
  }
  if (['US', 'CA'].includes(code)) {
    return 'NorthAmerica';
  }
  if (['IR'].includes(code)) {
    return 'Tehran';
  }
  if (['GB'].includes(code)) {
    return 'MoonsightingCommittee';
  }
  return 'MuslimWorldLeague';
}

/**
 * Attempts to detect the user's location via public IP geolocation APIs.
 */
export async function detectLocationViaIP(): Promise<DetectedLocation | null> {
  // Primary provider: ipwho.is (HTTPS, free, no API key needed)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://ipwho.is/', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = (await res.json()) as {
        success?: boolean;
        latitude?: number;
        longitude?: number;
        city?: string;
        country?: string;
        country_code?: string;
      };
      if (data.success !== false && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        const city = [data.city, data.country].filter(Boolean).join(', ');
        return {
          latitude: Number(data.latitude.toFixed(4)),
          longitude: Number(data.longitude.toFixed(4)),
          cityName: city || 'Auto-detected Location',
          countryCode: data.country_code
        };
      }
    }
  } catch {
    // Fallback to second provider
  }

  // Fallback provider: ipapi.co/json
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = (await res.json()) as {
        latitude?: number;
        longitude?: number;
        city?: string;
        country_name?: string;
        country_code?: string;
      };
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        const city = [data.city, data.country_name].filter(Boolean).join(', ');
        return {
          latitude: Number(data.latitude.toFixed(4)),
          longitude: Number(data.longitude.toFixed(4)),
          cityName: city || 'Auto-detected Location',
          countryCode: data.country_code
        };
      }
    }
  } catch {
    // Ignore network errors
  }

  return null;
}

export async function saveLocationToConfig(
  latitude: number,
  longitude: number,
  cityName: string,
  recommendedMethod?: string
): Promise<void> {
  const config = vscode.workspace.getConfiguration('prayerBreaks');
  await config.update('latitude', latitude, vscode.ConfigurationTarget.Global);
  await config.update('longitude', longitude, vscode.ConfigurationTarget.Global);
  await config.update('cityName', cityName, vscode.ConfigurationTarget.Global);

  if (recommendedMethod) {
    const inspect = config.inspect<string>('calculationMethod');
    const hasCustomMethod = inspect?.globalValue !== undefined || inspect?.workspaceValue !== undefined;
    if (!hasCustomMethod) {
      await config.update('calculationMethod', recommendedMethod, vscode.ConfigurationTarget.Global);
    }
  }
}
