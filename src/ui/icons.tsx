import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

const make = (d: string) =>
  function Icon(props: P) {
    return (
      <svg {...base} {...props}>
        <path d={d} />
      </svg>
    );
  };

export const IconDrop = (p: P) => (
  <svg viewBox="0 0 32 32" aria-hidden="true" {...p}><path d="M16 3c4 6 9 10 9 16a9 9 0 0 1-18 0c0-6 5-10 9-16z" /></svg>
);
export const IconHome = make('M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5');
export const IconPlus = make('M12 5v14M5 12h14');
export const IconList = make('M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01');
export const IconBook = make('M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5zM4 5.5v16');
export const IconUser = make('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0');
export const IconLogout = make('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9');
export const IconClock = make('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2');
export const IconCheck = make('m5 12.5 4.5 4.5L19 7.5');
export const IconX = make('M6 6l12 12M18 6 6 18');
export const IconChevron = make('m9 6 6 6-6 6');
export const IconRefresh = make('M20 11a8 8 0 0 0-14.5-3.5M4 4v4h4M4 13a8 8 0 0 0 14.5 3.5M20 20v-4h-4');
export const IconAlert = make('M12 9v4M12 17h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z');
export const IconInfo = make('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01');
export const IconShield = make('M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6z');
export const IconPin = make('M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z');
export const IconBuilding = make('M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2M17 13h.01M17 17h.01M3 21h18');
export const IconHeart = make('M12 20.5s-8-4.8-8-11A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5c0 6.2-8 11-8 11z');
export const IconActivity = make('M3 12h4l3-8 4 16 3-8h4');
export const IconUsers = make('M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20M10 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.3M15.5 5.2a3.5 3.5 0 0 1 0 6.6');
export const IconInbox = make('M3 13h5l1.5 3h5L16 13h5M5.5 5h13l2.5 8v6H3v-6z');
