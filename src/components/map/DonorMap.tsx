/**
 * Offline donor map, drawn as inline SVG.
 *
 * No tile server, no mapping library, no API key, and no network request. The
 * base layer is a stylised sector grid: a schematic, not a rendering of any
 * real city. Real map integration is implementation-phase work.
 *
 * Privacy is structural here. Markers sit at generalised sector centroids in a
 * fictional coordinate space, and the prototype holds no addresses, so an exact
 * donor location cannot be shown even by mistake.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchResult } from '../../types';
import { REQUEST_ORIGIN, SECTORS } from '../../mock/donors';

const DEFAULT_VIEW = { x: 8, y: 12, width: 76, height: 62 };
const MIN_WIDTH = 22;
const MAX_WIDTH = 90;
const ZOOM_STEP = 1.25;

/** Kilometres per map unit. The map space is fictional, not geographic. */
const KM_PER_MAP_UNIT = 0.4;
const DISTANCE_RINGS_KM = [5, 10];

const TIER_COLOUR: Record<string, string> = {
  Excellent: '#047857',
  Good: '#0369a1',
  Moderate: '#b45309',
};

interface Props {
  results: MatchResult[];
  selectedDonorId?: string | null;
  hoveredDonorId?: string | null;
  onSelect?: (donorId: string) => void;
  onHover?: (donorId: string | null) => void;
  className?: string;
}

export default function DonorMap({
  results, selectedDonorId, hoveredDonorId, onSelect, onHover, className = '',
}: Props) {
  const [view, setView] = useState(DEFAULT_VIEW);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragOrigin = useRef<{ pointerX: number; pointerY: number; viewX: number; viewY: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const zoomBy = useCallback((factor: number) => {
    setView((current) => {
      const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, current.width * factor));
      const height = width * (DEFAULT_VIEW.height / DEFAULT_VIEW.width);
      const centreX = current.x + current.width / 2;
      const centreY = current.y + current.height / 2;
      return { x: centreX - width / 2, y: centreY - height / 2, width, height };
    });
  }, []);

  function startPan(event: React.PointerEvent<SVGSVGElement>) {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    dragOrigin.current = {
      pointerX: event.clientX, pointerY: event.clientY,
      viewX: view.x, viewY: view.y,
    };
    setDragging(true);
  }

  function pan(event: React.PointerEvent<SVGSVGElement>) {
    const origin = dragOrigin.current;
    if (!origin || !svgRef.current) return;
    const bounds = svgRef.current.getBoundingClientRect();
    const deltaX = ((event.clientX - origin.pointerX) / bounds.width) * view.width;
    const deltaY = ((event.clientY - origin.pointerY) / bounds.height) * view.height;
    setView((current) => ({ ...current, x: origin.viewX - deltaX, y: origin.viewY - deltaY }));
  }

  function endPan() {
    dragOrigin.current = null;
    setDragging(false);
  }

  // Bound natively so the handler can be non-passive and not scroll the page.
  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;
    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      zoomBy(event.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    }
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [zoomBy]);

  /** Keeps label sizes stable as the view scales. */
  const textScale = view.width / DEFAULT_VIEW.width;

  return (
    <div className={`relative border border-slate-200 rounded-lg shadow-surface overflow-hidden bg-white ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        className={`w-full h-full block touch-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={startPan}
        onPointerMove={pan}
        onPointerUp={endPan}
        onPointerLeave={endPan}
        role="img"
        aria-label="Approximate sector-level donor locations"
      >
        {/* Arterial roads, for orientation only */}
        <g stroke="#eef2f6" strokeLinecap="round" fill="none">
          <path d="M10 38 H 78" strokeWidth="1.2" />
          <path d="M10 53.5 H 78" strokeWidth="0.9" />
          <path d="M42.5 16 V 70" strokeWidth="0.9" />
        </g>

        {/* Sector labels. No boxes: the markers are the only objects that matter. */}
        {SECTORS.map((sector) => (
          <text
            key={sector.name}
            x={sector.x} y={sector.y + 5.4} fontSize={1.55 * textScale}
            fill="#b3bfcd" textAnchor="middle" className="select-none"
          >
            {sector.name}
          </text>
        ))}

        {/* Distance rings from the request location */}
        {DISTANCE_RINGS_KM.map((km) => (
          <g key={km}>
            <circle
              cx={REQUEST_ORIGIN.x} cy={REQUEST_ORIGIN.y} r={km / KM_PER_MAP_UNIT}
              fill="none" stroke="#cbd5e1" strokeWidth={0.16} strokeDasharray="1 1.2"
            />
            <text
              x={REQUEST_ORIGIN.x} y={REQUEST_ORIGIN.y - km / KM_PER_MAP_UNIT + 1.5}
              fontSize={1.4 * textScale} fill="#94a3b8" textAnchor="middle"
            >
              {km} km
            </text>
          </g>
        ))}

        {/* Request location */}
        <g>
          <circle cx={REQUEST_ORIGIN.x} cy={REQUEST_ORIGIN.y} r={1.3} fill="#98283a" stroke="#fff" strokeWidth={0.4} />
          <text
            x={REQUEST_ORIGIN.x} y={REQUEST_ORIGIN.y - 2.4} fontSize={1.7 * textScale}
            fill="#7f2433" textAnchor="middle" fontWeight={600}
          >
            Request
          </text>
        </g>

        {/* Donors, with the selected marker drawn last so it sits on top */}
        {[...results]
          .sort((a, b) => Number(a.donor.id === selectedDonorId) - Number(b.donor.id === selectedDonorId))
          .map((result) => {
            const donor = result.donor;
            const selected = donor.id === selectedDonorId;
            const hovered = donor.id === hoveredDonorId;
            const emphasised = selected || hovered;
            const radius = selected ? 2.2 : 1.8;
            const colour = TIER_COLOUR[result.tier] ?? '#0369a1';
            // A small deterministic offset stops co-located markers overlapping.
            const offsetX = ((result.rank % 3) - 1) * 0.9;
            const offsetY = ((result.rank % 2) - 0.5) * 1.2;
            const x = donor.coords.x + offsetX;
            const y = donor.coords.y + offsetY;

            return (
              <g
                key={donor.id}
                onClick={(event) => { event.stopPropagation(); onSelect?.(donor.id); }}
                onPointerEnter={() => onHover?.(donor.id)}
                onPointerLeave={() => onHover?.(null)}
                className="cursor-pointer"
              >
                <circle cx={x} cy={y} r={3} fill={colour} opacity={emphasised ? 0.14 : 0.07} />
                <circle
                  cx={x} cy={y} r={radius} fill={colour}
                  stroke="#ffffff" strokeWidth={selected ? 0.55 : 0.4}
                />
                <text
                  x={x} y={y + radius * 0.4} fontSize={radius * 0.95}
                  fill="#ffffff" textAnchor="middle" fontWeight={600}
                  className="pointer-events-none select-none"
                >
                  {result.rank}
                </text>

                {emphasised && (
                  <g className="pointer-events-none">
                    <rect x={x - 10.5} y={y - 8.6} width={21} height={5.4} rx={0.6} fill="#0f172a" opacity={0.92} />
                    <text x={x} y={y - 6.4} fontSize={1.75 * textScale} fill="#ffffff" textAnchor="middle" fontWeight={600}>
                      {donor.name}
                    </text>
                    <text x={x} y={y - 4.3} fontSize={1.5 * textScale} fill="#cbd5e1" textAnchor="middle">
                      {donor.bloodGroup}, Sector {donor.sector}, {donor.distanceKm} km
                    </text>
                  </g>
                )}
              </g>
            );
          })}
      </svg>

      <div className="absolute top-2 right-2 flex flex-col">
        <button
          type="button" onClick={() => zoomBy(1 / ZOOM_STEP)} aria-label="Zoom in"
          className="w-7 h-7 grid place-items-center bg-white border border-slate-300 rounded-t-md text-slate-600 hover:bg-slate-50 text-[15px] leading-none"
        >
          +
        </button>
        <button
          type="button" onClick={() => zoomBy(ZOOM_STEP)} aria-label="Zoom out"
          className="w-7 h-7 grid place-items-center bg-white border-x border-slate-300 text-slate-600 hover:bg-slate-50 text-[15px] leading-none"
        >
          &minus;
        </button>
        <button
          type="button" onClick={() => setView(DEFAULT_VIEW)} aria-label="Reset view"
          className="w-7 h-7 grid place-items-center bg-white border border-slate-300 rounded-b-md text-slate-600 hover:bg-slate-50 text-[10px] leading-none"
        >
          Fit
        </button>
      </div>

      <p className="absolute bottom-0 inset-x-0 bg-white/95 border-t border-slate-200 px-3 py-1.5 text-[11px] leading-snug text-slate-500">
        Approximate sector-level locations. Donor addresses are never stored or displayed.
        Schematic offline map.
      </p>
    </div>
  );
}
