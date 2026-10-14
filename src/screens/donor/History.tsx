import { formatDate, requestTone, STATUS_LABEL } from '../../lib/labels';
import { Badge, GroupChip, PageHeader, type Tone } from '../../ui/kit';
import { EmptyState, ErrorState, Loading } from '../../ui/States';
import { useDonorData } from './useDonorData';

const answerTone = (s: string): Tone => (s === 'Accepted' ? 'ok' : s === 'Declined' ? 'bad' : s === 'Stood Down' ? 'neutral' : 'info');
const ANSWER: Record<string, string> = { Sent: 'Waiting for you', Accepted: 'You said yes', Declined: 'You said no', 'Stood Down': 'Not needed in the end' };

export function History() {
  const { offers, error, reload } = useDonorData(60_000);
  return (
    <>
      <PageHeader title="History" subtitle="Every request you were asked about, newest first." />
      <section className="card">
        {error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : offers === null ? (
          <Loading />
        ) : offers.length === 0 ? (
          <EmptyState title="No requests yet">When a request matches your group and sector, it will be listed here.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="cards">
              <thead>
                <tr><th>Request</th><th>Group</th><th>Units</th><th>Urgency</th><th>Sector</th><th>Your answer</th><th>Request status</th><th>Asked</th></tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id}>
                    <td className="first mono" data-label="Request">{o.requestCode}</td>
                    <td data-label="Group"><GroupChip group={o.group} /></td>
                    <td className="num" data-label="Units">{o.units}</td>
                    <td data-label="Urgency">{o.urgency}</td>
                    <td data-label="Sector">{o.sector}</td>
                    <td data-label="Your answer"><Badge tone={answerTone(o.state)}>{ANSWER[o.state] ?? o.state}</Badge></td>
                    <td data-label="Request status"><Badge tone={requestTone(o.requestStatus)}>{STATUS_LABEL[o.requestStatus] ?? o.requestStatus}</Badge></td>
                    <td className="muted num nowrap" data-label="Asked">{formatDate(o.offeredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
