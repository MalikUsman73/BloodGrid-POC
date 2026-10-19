import { sectorDistanceKm } from '../data/sectors';
import { BLOOD_BANKS, type BloodBank } from './registry';

export interface NearbyBank {
  bank: BloodBank;
  distanceKm: number;
}

/**
 * Registered blood banks nearest to a sector, closest first. BloodGrid does not reserve stock or message
 * them: for a critical request the seeker is shown these so they can contact a bank themselves.
 */
export function banksNear(sector: string, limit = 4): NearbyBank[] {
  return BLOOD_BANKS.map((bank) => ({ bank, distanceKm: sectorDistanceKm(bank.sector, sector) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
