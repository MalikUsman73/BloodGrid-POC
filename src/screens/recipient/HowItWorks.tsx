import { DEFAULT_CONFIG, NOTIFY_FACTOR } from '../../engine';
import { PageHeader } from '../../ui/kit';

export function HowItWorks() {
  return (
    <>
      <PageHeader title="How donors are chosen" subtitle="The rules behind a match, and what this pilot does and does not claim." />
      <section className="card">
        <div className="card-body prose">
          <h2>1. Screening</h2>
          <p>
            A donor is removed, not scored down, if they are not blood-group compatible, are unavailable or already committed to
            another request, gave blood fewer than {DEFAULT_CONFIG.cooldownDays} days ago, live more than {DEFAULT_CONFIG.radiusKm} km
            away, or were contacted {DEFAULT_CONFIG.contactCap} or more times in the last 30 days.
          </p>
          <h2>2. How many donors are notified</h2>
          <p>
            For N units the system notifies k = ceil(factor × N) donors, because some will decline:{' '}
            routine {NOTIFY_FACTOR.Routine}, urgent {NOTIFY_FACTOR.Urgent}, critical {NOTIFY_FACTOR.Critical}.
          </p>
          <h2>3. Four objectives, scored on the whole set</h2>
          <p>
            <b>Travel burden</b> (mean distance, lower is better). <b>Donor recovery</b> (mean days since the last donation, higher is
            better). <b>Expected fulfilment</b> (chance that at least one donor responds, higher is better). <b>Type-preservation
            cost</b> (the price of spending a universal donor on a request that had ordinary alternatives, lower is better).
          </p>
          <h2>4. Choosing a set</h2>
          <p>
            Every possible contact set is evaluated and the ones that no other set beats on all four objectives are kept. One is
            then chosen with a weighting that depends on urgency. If the pool is too large to enumerate, the search covers the
            best-scoring donors and the result says so.
          </p>
          <h2>What this is not</h2>
          <p>
            All donors are synthetic. The search is exact enumeration, which is the verification method for the planned NSGA-III
            optimiser and not a replacement for it at full scale. Notifications are shown in the donor's app only; no SMS or email is sent.
          </p>
          <p className="hint" style={{ marginTop: 28 }}>
            Engine <code>exact-pareto-1</code>. Source and tests are in the repository.
          </p>
        </div>
      </section>
    </>
  );
}
