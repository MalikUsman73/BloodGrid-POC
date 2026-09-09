/**
 * OFFLINE DONOR MAP — self-contained SVG. No tile server, no map library,
 * no API key, no network request of any kind.
 *
 * PRIVACY BY CONSTRUCTION:
 * Markers are drawn at generalised SECTOR centroids in a fictional map space.
 * The prototype holds no street addresses and no real coordinates, so an exact
 * donor residence cannot be displayed even in principle.
 *
 * The base layer is a stylised sector grid. It is a schematic, not a
 * geographic rendering of any real city. Real map integration is scheduled for
 * the FYP implementation phase.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, Minus, Plus, ShieldCheck } from 'lucide-react';
import type { MatchResult } from '../../types';
import { REQUEST_ORIGIN, SECTORS } from '../../mock/donors';

const VIEW = { x: 8, y: 12, w: 76, h: 62 };
const MIN_W = 22;
const MAX_W = 90;

/** Kilometres per map-space unit. Map space is fictional, not geographic. */
const KM_PER_UNIT = 0.4;

const TIER_FILL: Record<string, string> = {
  Excellent: '#059669',
  Good: '#0284c7',
  Moderate: '#d97706',
};

interface Props {
  results: MatchResult[];
  selectedId?: string | null;
  hoveredId?: string | null;
  onSelect?: (donorId: string) => void;
  onHover?: (donorId: string | null) => void;
  className?: string;
  /** Show the 5 km / 10 km reference rings around the request location. */
  showRings?: boolean;
}

export default function DonorMap({
  results, selectedId, hoveredId, onSelect, onHover, className = '', showRings = true,
}: Props) {
  const [view, setView] = useState(VIEW);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const zoom = useCallback((factor: number) => {
    setView((v) => {
      const w = Math.max(MIN_W, Math.min(MAX_W, v.w * factor));
      const h = w * (VIEW.h / VIEW.w);
      // Zoom about the centre of the current view.
      const cx = v.x + v.w / 2;
      const cy = v.y + v.h / 2;
      return { x: cx - w / 2, y: cy - h / 2, w, h };
    });
  }, []);

  const reset = useCallback(() => setView(VIEW), []);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.current.x) / rect.width) * view.w;
    const dy = ((e.clientY - drag.current.y) / rect.height) * view.h;
    setView((v) => ({ ...v, x: drag.current!.vx - dx, y: drag.current!.vy - dy }));
  };

  const endDrag = () => { drag.current = null; setDragging(false); };

  // Wheel zoom, bound natively so it can be non-passive and not scroll the page.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      zoom(e.deltaY > 0 ? 1.12 : 0.89);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [zoom]);

  const scale = VIEW.w / view.w;
  /** Keep marker and label sizes visually stable while zooming. */
  const k = 1 / scale;

  return (
    <div className={`relative rounded-xl overflow-hidden border border-slate-200 bg-[#eef3f8] ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className={`w-full h-full block touch-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        role="img"
        aria-label="Approximate sector-level donor locations"
      >
        <defs>
          <pattern id="bgGrid" width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M4 0 L0 0 0 4" fill="none" stroke="#dbe4ee" strokeWidth="0.15" />
          </pattern>
          <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0.35" stdDeviation="0.35" floodColor="#0f172a" floodOpacity="0.28" />
          </filter>
        </defs>

        <rect x={-20} y={-20} width={200} height={200} fill="url(#bgGrid)" />

        {/* Green belt / open ground, for visual texture only */}
        <ellipse cx={70} cy={20} rx={16} ry={9} fill="#dcece0" opacity="0.85" />
        <ellipse cx={16} cy={66} rx={12} ry={7} fill="#dcece0" opacity="0.7" />

        {/* Arterial roads */}
        <g stroke="#cbd5e1" strokeLinecap="round" fill="none">
          <path d="M10 38 H 78" strokeWidth="1.5" />
          <path d="M10 53.5 H 78" strokeWidth="1.1" />
          <path d="M42.5 16 V 70" strokeWidth="1.1" />
          <path d="M18 16 V 70" strokeWidth="0.6" />
          <path d="M59 16 V 70" strokeWidth="0.6" />
        </g>
        <text x={11} y={37.2} fontSize={1.5 * k} fill="#94a3b8" fontWeight={600}>KASHMIR HIGHWAY</text>
        <text x={11} y={52.7} fontSize={1.5 * k} fill="#94a3b8" fontWeight={600}>SRINAGAR HIGHWAY</text>

        {/* Commercial district block */}
        <rect x={54} y={35.4} width={11} height={5.2} rx={0.8} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.15" />
        <text x={59.5} y={38.6} fontSize={1.5 * k} fill="#94a3b8" textAnchor="middle" fontWeight={600}>
          BLUE AREA
        </text>

        {/* Sector zones */}
        {SECTORS.map((s) => (
          <g key={s.name}>
            <rect
              x={s.x - 3.6} y={s.y - 4.2} width={7.2} height={8.4} rx={0.9}
              fill="#ffffff" stroke="#cfdae7" strokeWidth="0.2" opacity="0.92"
            />
            <text
              x={s.x} y={s.y + 5.6} fontSize={1.7 * k} fill="#94a3b8"
              textAnchor="middle" fontWeight={600}
            >
              {s.name}
            </text>
          </g>
        ))}

        {/* Distance reference rings around the request location */}
        {showRings && [5, 10].map((km) => (
          <g key={km}>
            <circle
              cx={REQUEST_ORIGIN.x} cy={REQUEST_ORIGIN.y} r={km / KM_PER_UNIT}
              fill="none" stroke="#cf2544" strokeWidth={0.18} strokeDasharray="1.2 1.2" opacity={0.35}
            />
            <text
              x={REQUEST_ORIGIN.x} y={REQUEST_ORIGIN.y - km / KM_PER_UNIT + 1.6}
              fontSize={1.5 * k} fill="#cf2544" opacity={0.65} textAnchor="middle" fontWeight={600}
            >
              {km} km
            </text>
          </g>
        ))}

        {/* Request origin */}
        <g>
          <circle
            cx={REQUEST_ORIGIN.x} cy={REQUEST_ORIGIN.y} r={2.4}
            fill="#cf2544" opacity={0.28} className="animate-pulseRing"
            style={{ transformOrigin: `${REQUEST_ORIGIN.x}px ${REQUEST_ORIGIN.y}px` }}
          />
          <circle cx={REQUEST_ORIGIN.x} cy={REQUEST_ORIGIN.y} r={1.5} fill="#cf2544" stroke="#fff" strokeWidth={0.45} />
          <text
            x={REQUEST_ORIGIN.x} y={REQUEST_ORIGIN.y - 2.8} fontSize={1.9 * k}
            fill="#7d1732" textAnchor="middle" fontWeight={700}
          >
            Request
          </text>
        </g>

        {/* Donor markers, drawn so the selected pin sits on top */}
        {[...results]
          .sort((a, b) => Number(a.donor.id === selectedId) - Number(b.donor.id === selectedId))
          .map((r) => {
            const d = r.donor;
            const isSelected = d.id === selectedId;
            const isHovered = d.id === hoveredId;
            const emphasised = isSelected || isHovered;
            const radius = (isSelected ? 2.5 : 2.0) * (isHovered && !isSelected ? 1.12 : 1);
            const fill = TIER_FILL[r.tier] ?? '#0284c7';
            // Small deterministic offset keeps co-located pins from overlapping.
            const ox = ((r.rank % 3) - 1) * 0.9;
            const oy = ((r.rank % 2) - 0.5) * 1.2;
            return (
              <g
                key={d.id}
                onClick={(e) => { e.stopPropagation(); onSelect?.(d.id); }}
                onPointerEnter={() => onHover?.(d.id)}
                onPointerLeave={() => onHover?.(null)}
                className="cursor-pointer"
              >
                {/* Approximate-zone halo — reinforces that this is not an address */}
                <circle
                  cx={d.coords.x + ox} cy={d.coords.y + oy} r={3.4}
                  fill={fill} opacity={emphasised ? 0.16 : 0.09}
                />
                <circle
                  cx={d.coords.x + ox} cy={d.coords.y + oy} r={radius}
                  fill={fill} stroke="#ffffff" strokeWidth={isSelected ? 0.6 : 0.45}
                  filter="url(#pinShadow)"
                />
                <text
                  x={d.coords.x + ox} y={d.coords.y + oy + radius * 0.42}
                  fontSize={radius * 1.05} fill="#ffffff" textAnchor="middle" fontWeight={700}
                  className="pointer-events-none select-none"
                >
                  {r.rank}
                </text>

                {emphasised && (
                  <g className="pointer-events-none">
                    <rect
                      x={d.coords.x + ox - 11} y={d.coords.y + oy - 9.6}
                      width={22} height={6.2} rx={1} fill="#0f172a" opacity={0.92}
                    />
                    <text
                      x={d.coords.x + ox} y={d.coords.y + oy - 7.1}
                      fontSize={1.9 * k} fill="#fff" textAnchor="middle" fontWeight={700}
                    >
                      {d.name}
                    </text>
                    <text
                      x={d.coords.x + ox} y={d.coords.y + oy - 4.9}
                      fontSize={1.6 * k} fill="#cbd5e1" textAnchor="middle"
                    >
                      {d.bloodGroup} · Sector {d.sector} · {d.distanceKm} km
                    </text>
                  </g>
                )}
              </g>
            );
          })}
      </svg>

      {/* Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <MapButton label="Zoom in" onClick={() => zoom(0.8)}><Plus className="w-4 h-4" /></MapButton>
        <MapButton label="Zoom out" onClick={() => zoom(1.25)}><Minus className="w-4 h-4" /></MapButton>
        <MapButton label="Reset view" onClick={reset}><Crosshair className="w-4 h-4" /></MapButton>
      </div>

      {/* Legend */}
      <div className="absolute top-3 left-3 rounded-lg bg-white/95 backdrop-blur border border-slate-200 px-3 py-2 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Match tier</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {(['Excellent', 'Good', 'Moderate'] as const).map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: TIER_FILL[t] }} />
              {t}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-crimson-600" />
            Request
          </span>
        </div>
      </div>

      {/* Privacy caption */}
      <div className="absolute bottom-3 right-3 max-w-[15rem] rounded-lg bg-white/95 backdrop-blur border border-slate-200 px-3 py-2 shadow-sm">
        <p className="flex items-start gap-1.5 text-[10px] text-slate-500 leading-relaxed">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-px" />
          <span>
            Approximate sector-level locations. Exact donor addresses are never stored or displayed.
            Schematic offline map — not a geographic rendering.
          </span>
        </p>
      </div>
    </div>
  );
}

function MapButton({
  children, onClick, label,
}: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick} title={label} aria-label={label}
      className="w-8 h-8 grid place-items-center rounded-lg bg-white/95 backdrop-blur border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white shadow-sm transition-colors"
    >
      {children}
    </button>
  );
}
