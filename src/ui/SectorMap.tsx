import { SECTORS } from '../data/sectors';

interface Props {
  requestSector: string;
  /** Number of selected donors in each sector. */
  picked: Record<string, number>;
  radiusKm: number;
}

const W = 520;
const H = 340;
const PAD = 36;

/** Schematic sector map. Donors are shown by sector only, never by exact position. */
export function SectorMap({ requestSector, picked, radiusKm }: Props) {
  const lats = SECTORS.map((s) => s.lat);
  const lngs = SECTORS.map((s) => s.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const x = (lng: number) => PAD + ((lng - minLng) / (maxLng - minLng)) * (W - 2 * PAD);
  const y = (lat: number) => PAD + (1 - (lat - minLat) / (maxLat - minLat)) * (H - 2 * PAD);
  const req = SECTORS.find((s) => s.id === requestSector);
  // One degree of longitude is about 92.5 km at this latitude; scale the ring from the plotted span.
  const kmPerPx = ((maxLng - minLng) * 92.5) / (W - 2 * PAD);
  const ringR = radiusKm / kmPerPx;

  return (
    <svg className="map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Selected donors by sector around ${requestSector}`}>
      {req && <circle className="ring" cx={x(req.lng)} cy={y(req.lat)} r={ringR} />}
      {SECTORS.map((s) => {
        const n = picked[s.id] ?? 0;
        const isReq = s.id === requestSector;
        return (
          <g key={s.id}>
            <circle className="sector" cx={x(s.lng)} cy={y(s.lat)} r={3} />
            {n > 0 && <circle className="pick" cx={x(s.lng)} cy={y(s.lat)} r={5 + n * 2.5} opacity={0.9} />}
            {isReq && <circle className="req" cx={x(s.lng)} cy={y(s.lat)} r={11} />}
            <text x={x(s.lng) + 8} y={y(s.lat) - 7}>{s.id}</text>
          </g>
        );
      })}
    </svg>
  );
}
