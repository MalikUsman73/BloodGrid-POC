import { useState } from 'react';
import { REPORT_KINDS, type ReportKind, type Repository } from '../data';
import { Alert, Button, Field, Select, TextInput } from './kit';

/**
 * Lets a donor report a request they were asked about: a request for payment, details that do not
 * match, or something that looks fraudulent. Several donors reporting fraud flags the account that raised it.
 */
export function ReportProblem({ repo, requestId, onDone }: { repo: Repository; requestId: string; onDone: () => void }) {
  const [kind, setKind] = useState<ReportKind>(REPORT_KINDS[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    if (note.trim().length < 5) {
      setError('Describe what happened in a few words.');
      return;
    }
    setBusy(true);
    try {
      await repo.reportRequest({ requestId, kind, note: note.trim() });
      setNote('');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The report could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-sm">
      <Field label="What happened" htmlFor={`kind-${requestId}`}>
        <Select id={`kind-${requestId}`} value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>
          {REPORT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </Select>
      </Field>
      <Field label="Details" htmlFor={`note-${requestId}`} hint="Do not include phone numbers.">
        <TextInput id={`note-${requestId}`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <Alert tone="bad">{error}</Alert>}
      <div>
        <Button size="sm" onClick={() => void send()} loading={busy}>Send report</Button>
      </div>
    </div>
  );
}
