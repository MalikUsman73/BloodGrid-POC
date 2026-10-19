import { banksNear } from '../workflow';
import { Alert } from './kit';

/**
 * For a critical request: the registered blood banks nearest the hospital. BloodGrid does not reserve
 * blood or message them, so the seeker contacts a bank themselves while donors are being asked.
 */
export function NearbyBanks({ sector }: { sector: string }) {
  const banks = banksNear(sector);
  return (
    <Alert tone="warn" title="Critical: you can also contact a blood bank directly">
      <p style={{ margin: '0 0 6px' }}>These registered banks are closest to the hospital. BloodGrid keeps asking donors in the meantime.</p>
      <ul className="plain-list">
        {banks.map(({ bank, distanceKm }) => (
          <li key={bank.id}>
            <span>{bank.name}<span className="hint" style={{ display: 'block' }}>{bank.kind} · {bank.sector}</span></span>
            <span className="num nowrap">{distanceKm.toFixed(1)} km</span>
          </li>
        ))}
      </ul>
    </Alert>
  );
}
