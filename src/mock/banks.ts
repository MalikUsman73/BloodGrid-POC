/**
 * Fictional demonstration blood banks and inventory.
 *
 * PROTOTYPE / MOCK DATA — DEMONSTRATION ONLY.
 * These are invented facilities. No real blood bank is represented, integrated,
 * or partnered with. No real inventory data is used.
 */

import type { BloodBank, InventoryItem, BloodGroup, StockStatus } from '../types';

/** The blood bank the demo administrator is signed in to (fictional). */
export const OWN_BANK: BloodBank = {
  id: 'BB-001',
  name: 'Central Regional Blood Centre',
  sector: 'G-8',
  partner: false,
};

/** Fictional neighbouring facilities used by the coordination workflow. */
export const partnerBanks: BloodBank[] = [
  {
    id: 'BB-002', name: 'Northside Community Blood Bank', sector: 'F-10',
    partner: true, distanceKm: 6.4,
    indicativeStock: { 'O+': 74, 'A+': 51, 'B+': 38, 'AB+': 17, 'O-': 12 },
  },
  {
    id: 'BB-003', name: 'Riverside Teaching Hospital Bank', sector: 'I-9',
    partner: true, distanceKm: 8.1,
    indicativeStock: { 'O+': 46, 'A+': 62, 'B+': 44, 'AB+': 21, 'O-': 8 },
  },
  {
    id: 'BB-004', name: 'Meadowvale District Blood Centre', sector: 'G-11',
    partner: true, distanceKm: 11.3,
    indicativeStock: { 'O+': 88, 'A+': 40, 'B+': 29, 'AB+': 14, 'O-': 19 },
  },
];

export const allBanks = [OWN_BANK, ...partnerBanks];

function statusFor(units: number, capacity: number): StockStatus {
  const pct = units / capacity;
  if (pct < 0.18) return 'Critical';
  if (pct < 0.32) return 'Low';
  if (pct < 0.5) return 'Watch';
  return 'Healthy';
}

/**
 * `dailyUse` for the four forecast groups matches the 30-day trailing average of
 * the simulated demand series, so inventory, dashboard and forecast screens all
 * agree. `dailyCollection` is the routine collection rate assumed by the
 * prototype's shortage rule — also simulated.
 */
const stock: {
  bloodGroup: BloodGroup; units: number; capacity: number;
  dailyUse: number; dailyCollection: number;
}[] = [
  { bloodGroup: 'O+',  units: 118, capacity: 260, dailyUse: 16.9, dailyCollection: 8.1 },
  { bloodGroup: 'A+',  units: 96,  capacity: 190, dailyUse: 10.5, dailyCollection: 6.0 },
  { bloodGroup: 'B+',  units: 84,  capacity: 170, dailyUse: 8.8,  dailyCollection: 5.0 },
  { bloodGroup: 'AB+', units: 34,  capacity: 80,  dailyUse: 3.5,  dailyCollection: 2.0 },
  { bloodGroup: 'O-',  units: 11,  capacity: 60,  dailyUse: 2.8,  dailyCollection: 1.4 },
  { bloodGroup: 'A-',  units: 19,  capacity: 55,  dailyUse: 2.1,  dailyCollection: 1.2 },
  { bloodGroup: 'B-',  units: 16,  capacity: 50,  dailyUse: 1.7,  dailyCollection: 1.0 },
  { bloodGroup: 'AB-', units: 7,   capacity: 30,  dailyUse: 0.8,  dailyCollection: 0.5 },
];

export const inventory: InventoryItem[] = stock.map((s) => ({
  bloodGroup: s.bloodGroup,
  units: s.units,
  capacity: s.capacity,
  status: statusFor(s.units, s.capacity),
  daysOfCover: Math.round((s.units / s.dailyUse) * 10) / 10,
}));

/** Simulated routine collection rate, units per day. */
export function dailyCollection(group: BloodGroup): number {
  const row = stock.find((s) => s.bloodGroup === group);
  return row ? row.dailyCollection : 0;
}

export function getInventory(group: BloodGroup): InventoryItem | undefined {
  return inventory.find((i) => i.bloodGroup === group);
}

export const totalUnits = inventory.reduce((a, i) => a + i.units, 0);
export const totalCapacity = inventory.reduce((a, i) => a + i.capacity, 0);
