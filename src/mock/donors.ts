/**
 * Fictional donor pool used throughout the prototype.
 *
 * Every name and figure here is invented for the proposal-stage demonstration.
 * Donors are located to sector level only, and carry no phone number and no
 * address: BloodGrid puts the seeker in touch with a donor inside the
 * application after the donor accepts, so personal contact details are never
 * needed by the matching or request flow.
 */

import type { Donor } from '../types';
import { roundTo } from './seed';

/** The seeker's stated sector for the demonstration, and the origin for distances. */
export const REQUEST_ORIGIN = { x: 46, y: 46, sector: 'G-8' };

/** Map-space units to kilometres. The map space is fictional, not geographic. */
const KM_PER_MAP_UNIT = 0.4;

/** Minimum days between whole-blood donations applied by the prototype. */
export const MIN_DAYS_BETWEEN_DONATIONS = 90;

export function distanceFromRequestOrigin(coords: { x: number; y: number }): number {
  const dx = coords.x - REQUEST_ORIGIN.x;
  const dy = coords.y - REQUEST_ORIGIN.y;
  return roundTo(Math.sqrt(dx * dx + dy * dy) * KM_PER_MAP_UNIT, 1);
}

type DonorRecord = Omit<Donor, 'distanceKm' | 'eligible'>;

const donorRecords: DonorRecord[] = [
  { id: 'DNR-001', name: 'Ahmed Khan',     bloodGroup: 'O+',  sector: 'G-9',  coords: { x: 38, y: 47 }, available: true,  lastDonationDays: 168, completedDonations: 7, responseRate: 0.92, verified: true,  age: 29 },
  { id: 'DNR-002', name: 'Ali Raza',       bloodGroup: 'O+',  sector: 'G-8',  coords: { x: 48, y: 49 }, available: true,  lastDonationDays: 121, completedDonations: 4, responseRate: 0.84, verified: true,  age: 33 },
  { id: 'DNR-003', name: 'Usman Malik',    bloodGroup: 'O-',  sector: 'F-8',  coords: { x: 46, y: 30 }, available: true,  lastDonationDays: 245, completedDonations: 9, responseRate: 0.88, verified: true,  age: 36 },
  { id: 'DNR-004', name: 'Hamza Shah',     bloodGroup: 'O+',  sector: 'H-8',  coords: { x: 45, y: 55 }, available: false, lastDonationDays: 194, completedDonations: 5, responseRate: 0.71, verified: true,  age: 27 },
  { id: 'DNR-005', name: 'Bilal Ahmed',    bloodGroup: 'O+',  sector: 'I-8',  coords: { x: 46, y: 62 }, available: true,  lastDonationDays: 98,  completedDonations: 3, responseRate: 0.79, verified: false, age: 24 },
  { id: 'DNR-006', name: 'Sana Tariq',     bloodGroup: 'O+',  sector: 'F-7',  coords: { x: 55, y: 28 }, available: true,  lastDonationDays: 212, completedDonations: 6, responseRate: 0.95, verified: true,  age: 31 },
  { id: 'DNR-007', name: 'Zainab Iqbal',   bloodGroup: 'O-',  sector: 'G-11', coords: { x: 22, y: 45 }, available: true,  lastDonationDays: 310, completedDonations: 8, responseRate: 0.66, verified: true,  age: 38 },
  { id: 'DNR-008', name: 'Faisal Mehmood', bloodGroup: 'O+',  sector: 'G-10', coords: { x: 30, y: 46 }, available: false, lastDonationDays: 143, completedDonations: 2, responseRate: 0.58, verified: false, age: 26 },
  { id: 'DNR-009', name: 'Ayesha Noor',    bloodGroup: 'O+',  sector: 'F-11', coords: { x: 25, y: 29 }, available: true,  lastDonationDays: 276, completedDonations: 5, responseRate: 0.81, verified: true,  age: 30 },
  { id: 'DNR-010', name: 'Kamran Yousaf',  bloodGroup: 'O+',  sector: 'I-10', coords: { x: 30, y: 63 }, available: false, lastDonationDays: 187, completedDonations: 4, responseRate: 0.74, verified: true,  age: 34 },
  // Donated recently, so the eligibility rule removes them from results.
  { id: 'DNR-011', name: 'Nida Aslam',     bloodGroup: 'O+',  sector: 'G-7',  coords: { x: 55, y: 45 }, available: true,  lastDonationDays: 41,  completedDonations: 6, responseRate: 0.90, verified: true,  age: 28 },
  // Incompatible with an O+ request, so the compatibility rule removes them.
  { id: 'DNR-012', name: 'Rizwan Haider',  bloodGroup: 'A+',  sector: 'F-6',  coords: { x: 62, y: 30 }, available: true,  lastDonationDays: 156, completedDonations: 5, responseRate: 0.86, verified: true,  age: 32 },
  { id: 'DNR-013', name: 'Maryam Javed',   bloodGroup: 'B+',  sector: 'G-6',  coords: { x: 62, y: 46 }, available: true,  lastDonationDays: 203, completedDonations: 7, responseRate: 0.89, verified: true,  age: 35 },
  { id: 'DNR-014', name: 'Tariq Nadeem',   bloodGroup: 'AB+', sector: 'I-9',  coords: { x: 38, y: 63 }, available: false, lastDonationDays: 132, completedDonations: 3, responseRate: 0.63, verified: false, age: 41 },
];

export const donors: Donor[] = donorRecords.map((record) => ({
  ...record,
  distanceKm: distanceFromRequestOrigin(record.coords),
  eligible: record.lastDonationDays >= MIN_DAYS_BETWEEN_DONATIONS,
}));

export function findDonor(id: string): Donor | undefined {
  return donors.find((donor) => donor.id === id);
}

/** Sector centroids for the offline map. A fictional layout, not geographic. */
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
