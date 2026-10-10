import type { StationCode } from './types';

export interface Station {
  code: StationCode;
  name: string;
  latitude: number;
  longitude: number;
  /** Geofence radius around the airport reference point. */
  radiusKm: number;
}

export const STATIONS: Station[] = [
  { code: 'JNB', name: 'O.R. Tambo International', latitude: -26.1337, longitude: 28.242, radiusKm: 6 },
  { code: 'CPT', name: 'Cape Town International', latitude: -33.9696, longitude: 18.5972, radiusKm: 5 },
];

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** The station whose geofence contains the position, or null (flagged for supervisor review). */
export function stationForPosition(latitude: number, longitude: number): StationCode | null {
  for (const s of STATIONS) {
    if (distanceKm(latitude, longitude, s.latitude, s.longitude) <= s.radiusKm) return s.code;
  }
  return null;
}
