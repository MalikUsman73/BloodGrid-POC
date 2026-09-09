import type { StockStatus } from '../../types';

export function stockTone(s: StockStatus): 'green' | 'blue' | 'amber' | 'red' {
  return s === 'Healthy' ? 'green' : s === 'Watch' ? 'blue' : s === 'Low' ? 'amber' : 'red';
}

export function severityTone(s: 'critical' | 'elevated' | 'stable'): 'red' | 'amber' | 'green' {
  return s === 'critical' ? 'red' : s === 'elevated' ? 'amber' : 'green';
}
