/**
 * Fictional demonstration donor pool.
 *
 * PROTOTYPE / MOCK DATA — DEMONSTRATION ONLY.
 * Every name, record, and figure below is invented for the proposal-stage POC.
 * No real donor data is used. Locations are generalised to city sectors only;
 * exact residential addresses are never stored or displayed.
 */

import type { Donor } from '../types';
import { round } from './seed';

/** Origin used for the demonstration: the seeker's stated sector (G-8, Islamabad). */
export const REQUEST_ORIGIN = { x: 46, y: 46, sector: 'G-8' };

/** Map-space units to kilometres. Map space is fictional, not geographic. */
const KM_PER_UNIT = 0.4;

export function distanceFromOrigin(coords: { x: number; y: number }): number {
  const dx = coords.x - REQUEST_ORIGIN.x;
  const dy = coords.y - REQUEST_ORIGIN.y;
  return round(Math.sqrt(dx * dx + dy * dy) * KM_PER_UNIT, 1);
}

type DonorSeed = Omit<Donor, 'distanceKm' | 'eligible'>;

const seeds: DonorSeed[] = [
  { id: 'DNR-001', name: 'Ahmed Khan',    bloodGroup: 'O+',  sector: 'G-9',  coords: { x: 38, y: 47 }, availability: 'Available',   lastDonationDays: 168, completedDonations: 7, responseRate: 0.92, verified: true,  age: 29, contactMasked: '+92 3•• ••• 4417' },
  { id: 'DNR-002', name: 'Ali Raza',      bloodGroup: 'O+',  sector: 'G-8',  coords: { x: 48, y: 49 }, availability: 'Available',   lastDonationDays: 121, completedDonations: 4, responseRate: 0.84, verified: true,  age: 33, contactMasked: '+92 3•• ••• 9052' },
  { id: 'DNR-003', name: 'Usman Malik',   bloodGroup: 'O-',  sector: 'F-8',  coords: { x: 46, y: 30 }, availability: 'Available',   lastDonationDays: 245, completedDonations: 9, responseRate: 0.88, verified: true,  age: 36, contactMasked: '+92 3•• ••• 2310' },
  { id: 'DNR-004', name: 'Hamza Shah',    bloodGroup: 'O+',  sector: 'H-8',  coords: { x: 45, y: 55 }, availability: 'Limited',     lastDonationDays: 194, completedDonations: 5, responseRate: 0.71, verified: true,  age: 27, contactMasked: '+92 3•• ••• 7788' },
  { id: 'DNR-005', name: 'Bilal Ahmed',   bloodGroup: 'O+',  sector: 'I-8',  coords: { x: 46, y: 62 }, availability: 'Available',   lastDonationDays: 98,  completedDonations: 3, responseRate: 0.79, verified: false, age: 24, contactMasked: '+92 3•• ••• 5163' },
  { id: 'DNR-006', name: 'Sana Tariq',    bloodGroup: 'O+',  sector: 'F-7',  coords: { x: 55, y: 28 }, availability: 'Available',   lastDonationDays: 212, completedDonations: 6, responseRate: 0.95, verified: true,  age: 31, contactMasked: '+92 3•• ••• 6624' },
  { id: 'DNR-007', name: 'Zainab Iqbal',  bloodGroup: 'O-',  sector: 'G-11', coords: { x: 22, y: 45 }, availability: 'Available',   lastDonationDays: 310, completedDonations: 8, responseRate: 0.66, verified: true,  age: 38, contactMasked: '+92 3•• ••• 1195' },
  { id: 'DNR-008', name: 'Faisal Mehmood',bloodGroup: 'O+',  sector: 'G-10', coords: { x: 30, y: 46 }, availability: 'Limited',     lastDonationDays: 143, completedDonations: 2, responseRate: 0.58, verified: false, age: 26, contactMasked: '+92 3•• ••• 8402' },
  { id: 'DNR-009', name: 'Ayesha Noor',   bloodGroup: 'O+',  sector: 'F-11', coords: { x: 25, y: 29 }, availability: 'Available',   lastDonationDays: 276, completedDonations: 5, responseRate: 0.81, verified: true,  age: 30, contactMasked: '+92 3•• ••• 3947' },
  { id: 'DNR-010', name: 'Kamran Yousaf', bloodGroup: 'O+',  sector: 'I-10', coords: { x: 30, y: 63 }, availability: 'Unavailable', lastDonationDays: 187, completedDonations: 4, responseRate: 0.74, verified: true,  age: 34, contactMasked: '+92 3•• ••• 7031' },
  // Recently donated — filtered out by the 90-day eligibility rule.
  { id: 'DNR-011', name: 'Nida Aslam',    bloodGroup: 'O+',  sector: 'G-7',  coords: { x: 55, y: 45 }, availability: 'Available',   lastDonationDays: 41,  completedDonations: 6, responseRate: 0.90, verified: true,  age: 28, contactMasked: '+92 3•• ••• 2286' },
  // Incompatible with an O+ request — filtered out by the compatibility rule.
  { id: 'DNR-012', name: 'Rizwan Haider', bloodGroup: 'A+',  sector: 'F-6',  coords: { x: 62, y: 30 }, availability: 'Available',   lastDonationDays: 156, completedDonations: 5, responseRate: 0.86, verified: true,  age: 32, contactMasked: '+92 3•• ••• 4470' },
  { id: 'DNR-013', name: 'Maryam Javed',  bloodGroup: 'B+',  sector: 'G-6',  coords: { x: 62, y: 46 }, availability: 'Available',   lastDonationDays: 203, completedDonations: 7, responseRate: 0.89, verified: true,  age: 35, contactMasked: '+92 3•• ••• 6618' },
  { id: 'DNR-014', name: 'Tariq Nadeem',  bloodGroup: 'AB+', sector: 'I-9',  coords: { x: 38, y: 63 }, availability: 'Limited',     lastDonationDays: 132, completedDonations: 3, responseRate: 0.63, verified: false, age: 41, contactMasked: '+92 3•• ••• 5529' },
];

/** Minimum days between whole-blood donations applied by the prototype. */
export const MIN_DAYS_BETWEEN_DONATIONS = 90;

export const donors: Donor[] = seeds.map((d) => ({
  ...d,
  distanceKm: distanceFromOrigin(d.coords),
  eligible: d.lastDonationDays >= MIN_DAYS_BETWEEN_DONATIONS,
}));

export function getDonor(id: string): Donor | undefined {
  return donors.find((d) => d.id === id);
}

/** Sector centroids used by the offline map. Fictional layout, not geographic. */
export const SECTORS: { name: string; x: number; y: number }[] = [
  { name: 'F-11', x: 25, y: 29 }, { name: 'F-10', x: 33, y: 30 },
  { name: 'F-8',  x: 46, y: 30 }, { name: 'F-7',  x: 55, y: 28 },
  { name: 'F-6',  x: 62, y: 30 },
  { name: 'G-11', x: 22, y: 45 }, { name: 'G-10', x: 30, y: 46 },
  { name: 'G-9',  x: 38, y: 47 }, { name: 'G-8',  x: 46, y: 46 },
  { name: 'G-7',  x: 55, y: 45 }, { name: 'G-6',  x: 62, y: 46 },
  { name: 'H-8',  x: 45, y: 55 },
  { name: 'I-10', x: 30, y: 63 }, { name: 'I-9',  x: 38, y: 63 },
  { name: 'I-8',  x: 46, y: 62 },
];
