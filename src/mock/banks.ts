/**
 * Fictional blood banks and inventory.
 *
 * These are invented facilities. No real blood bank is represented, integrated
 * with, or partnered with this project, and no real inventory data is used.
 */

import type { BloodBank, BloodGroup, InventoryItem, StockStatus } from '../types';

/** The facility the demonstration administrator is signed in to. */
export const OWN_BANK: BloodBank = {
  id: 'BB-001',
  name: 'Central Regional Blood Centre',
  sector: 'G-8',
};

export const partnerBanks: BloodBank[] = [
  {
    id: 'BB-002', name: 'Northside Community Blood Bank', sector: 'F-10', distanceKm: 6.4,
    indicativeStock: { 'O+': 74, 'A+': 51, 'B+': 38, 'AB+': 17 },
  },
  {
    id: 'BB-003', name: 'Riverside Teaching Hospital Bank', sector: 'I-9', distanceKm: 8.1,
    indicativeStock: { 'O+': 46, 'A+': 62, 'B+': 44, 'AB+': 21 },
  },
  {
    id: 'BB-004', name: 'Meadowvale District Blood Centre', sector: 'G-11', distanceKm: 11.3,
    indicativeStock: { 'O+': 88, 'A+': 40, 'B+': 29, 'AB+': 14 },
  },
];

const STOCK_THRESHOLDS: { ceiling: number; status: StockStatus }[] = [
  { ceiling: 0.18, status: 'Critical' },
  { ceiling: 0.32, status: 'Low' },
  { ceiling: 0.50, status: 'Watch' },
  { ceiling: Infinity, status: 'Healthy' },
];

function stockStatus(units: number, capacity: number): StockStatus {
  const filled = units / capacity;
  return STOCK_THRESHOLDS.find((threshold) => filled < threshold.ceiling)!.status;
}

/**
 * `dailyUse` for the four forecast groups matches the 30-day trailing average of
 * that group's demand series, so inventory and forecast screens agree.
 * `dailyCollection` is the routine collection rate the shortage rule assumes.
 */
const stockRecords: {
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

export const inventory: InventoryItem[] = stockRecords.map((record) => ({
  bloodGroup: record.bloodGroup,
  units: record.units,
  capacity: record.capacity,
  status: stockStatus(record.units, record.capacity),
  daysOfCover: Math.round((record.units / record.dailyUse) * 10) / 10,
}));

export function findInventory(group: BloodGroup): InventoryItem | undefined {
  return inventory.find((item) => item.bloodGroup === group);
}

/** Simulated routine collection rate, in units per day. */
export function dailyCollectionRate(group: BloodGroup): number {
  return stockRecords.find((record) => record.bloodGroup === group)?.dailyCollection ?? 0;
}

export const totalUnitsHeld = inventory.reduce((total, item) => total + item.units, 0);
export const totalCapacity = inventory.reduce((total, item) => total + item.capacity, 0);
