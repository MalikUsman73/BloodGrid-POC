import { useCallback, useEffect, useState } from 'react';
import type { DonorOffer, DonorProfile } from '../../data';
import { useApp } from '../../state/AppContext';

/** The signed-in donor's own record and offers, refreshed on a timer so new requests appear. */
export function useDonorData(pollMs = 20_000) {
  const { repo, ready } = useApp();
  const [profile, setProfile] = useState<DonorProfile | null | undefined>(undefined);
  const [offers, setOffers] = useState<DonorOffer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, o] = await Promise.all([repo.donorProfile(), repo.donorOffers()]);
      setProfile(p);
      setOffers(o);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your donor record.');
    }
  }, [repo]);

  useEffect(() => {
    if (!ready) return;
    void load();
    const t = setInterval(() => void load(), pollMs);
    return () => clearInterval(t);
  }, [ready, load, pollMs]);

  return { profile, offers, error, reload: load, setProfile, setOffers };
}
