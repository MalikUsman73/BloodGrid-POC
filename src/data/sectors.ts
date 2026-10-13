export interface Sector {
  id: string;
  lat: number;
  lng: number;
}

/** Approximate sector centroids in Islamabad. Donors are located at sector level only. */
export const SECTORS: Sector[] = [
  { id: 'E-7', lat: 33.735, lng: 73.045 },
  { id: 'E-11', lat: 33.701, lng: 72.965 },
  { id: 'F-6', lat: 33.7294, lng: 73.0791 },
  { id: 'F-7', lat: 33.7215, lng: 73.0551 },
  { id: 'F-8', lat: 33.71, lng: 73.035 },
  { id: 'F-10', lat: 33.6985, lng: 73.009 },
  { id: 'F-11', lat: 33.685, lng: 72.988 },
  { id: 'G-6', lat: 33.712, lng: 73.083 },
  { id: 'G-7', lat: 33.705, lng: 73.06 },
  { id: 'G-8', lat: 33.695, lng: 73.039 },
  { id: 'G-9', lat: 33.688, lng: 73.02 },
  { id: 'G-10', lat: 33.679, lng: 73.003 },
  { id: 'G-11', lat: 33.668, lng: 72.985 },
  { id: 'H-8', lat: 33.678, lng: 73.045 },
  { id: 'H-9', lat: 33.67, lng: 73.027 },
  { id: 'H-10', lat: 33.66, lng: 73.01 },
  { id: 'I-8', lat: 33.665, lng: 73.068 },
  { id: 'I-9', lat: 33.656, lng: 73.048 },
  { id: 'I-10', lat: 33.647, lng: 73.028 },
  { id: 'I-11', lat: 33.638, lng: 73.009 },
];

const sectorById = new Map(SECTORS.map((s) => [s.id, s]));

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Distance between two sectors. Donors sit at sector level, so a donor in the request sector
 * is given a nominal 0.5 km rather than zero.
 */
export function sectorDistanceKm(from: string, to: string): number {
  const a = sectorById.get(from);
  const b = sectorById.get(to);
  if (!a || !b) throw new Error(`Unknown sector: ${!a ? from : to}`);
  return Math.max(0.5, Math.round(haversineKm(a, b) * 10) / 10);
}
