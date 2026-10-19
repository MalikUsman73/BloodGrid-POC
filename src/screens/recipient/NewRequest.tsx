import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { RequestRefusedError, RequestRejectedError, type Patient, type Pool } from '../../data';
import { BLOOD_GROUPS, URGENCIES, contactSetSize, screenDonors, type BloodGroup, type Urgency } from '../../engine';
import { fileSize } from '../../lib/labels';
import { useApp } from '../../state/AppContext';
import { rememberOutcome } from '../../state/outcomes';
import { runRound } from '../../state/rounds';
import { Funnel } from '../../ui/Funnel';
import { Alert, Button, describe, Field, PageHeader, Segmented, Select, TextInput } from '../../ui/kit';
import { NearbyBanks } from '../../ui/NearbyBanks';
import { ErrorState, Loading } from '../../ui/States';
import { useToast } from '../../ui/Toast';
import {
  ALLOWED_FILE_TYPES, HOSPITALS, MAX_FILE_BYTES, MAX_UNITS, NO_HISTORY, findHospital, hashFile, matchConfigFor, validateRequest,
  type DocumentInfo, type Flag, type PatientInput, type RequestErrors,
} from '../../workflow';

const LEAN: Record<Urgency, string> = {
  Routine: 'Leans toward donor recovery and conserving scarce blood groups. Donors have 12 hours to answer.',
  Urgent: 'Balances speed, response likelihood, recovery and conservation. Donors have 2 hours to answer.',
  Critical: 'Leans toward response likelihood and short travel. Donors have 30 minutes to answer, and it can take a donor another request is still waiting on.',
};

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_PATIENT: PatientInput = { fullName: '', mrNumber: '', hospitalId: '', bloodGroup: '', birthYear: null };

export function NewRequest() {
  const { repo, ready } = useApp();
  const navigate = useNavigate();
  const toast = useToast();

  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [patientId, setPatientId] = useState<string>('new');
  const [pf, setPf] = useState<PatientInput>(EMPTY_PATIENT);
  const [doctorName, setDoctorName] = useState('');
  const [pmdc, setPmdc] = useState('');
  const [rxHospital, setRxHospital] = useState('');
  const [issuedOn, setIssuedOn] = useState(today());
  const [rxGroup, setRxGroup] = useState<BloodGroup | ''>('');
  const [prescribed, setPrescribed] = useState(1);
  const [diagnosis, setDiagnosis] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<DocumentInfo | null>(null);
  const [units, setUnits] = useState(1);
  const [urgency, setUrgency] = useState<Urgency>('Urgent');

  const [errors, setErrors] = useState<RequestErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pool, setPool] = useState<Pool | null>(null);
  const [refused, setRefused] = useState<{ flags: Flag[]; sector: string } | null>(null);

  const chosen = patients?.find((p) => p.id === patientId) ?? null;
  const patient: PatientInput = chosen
    ? { fullName: chosen.fullName, mrNumber: chosen.mrNumber, hospitalId: chosen.hospitalId, bloodGroup: chosen.bloodGroup, birthYear: chosen.birthYear }
    : pf;
  const hospital = findHospital(patient.hospitalId);
  const group = patient.bloodGroup || null;

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const list = await repo.listPatients();
      setPatients(list);
      if (list.length > 0) setPatientId((cur) => (cur === 'new' ? list[0].id : cur));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load your patients.');
    }
  }, [repo]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  // The availability preview follows the patient's hospital.
  useEffect(() => {
    if (!ready || !hospital) return;
    let live = true;
    void repo.getPool(hospital.sector)
      .then((p) => {
        if (live) setPool(p);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [repo, ready, hospital]);

  // Prescription fields default to the patient's.
  useEffect(() => {
    setRxHospital(patient.hospitalId);
    setRxGroup(patient.bloodGroup);
  }, [patient.hospitalId, patient.bloodGroup]);

  const config = useMemo(() => matchConfigFor({ urgency, round: 1 }), [urgency]);
  const preview = useMemo(() => {
    if (!hospital || !group || !pool) return null;
    const screening = screenDonors(pool.donors, { recipientGroup: group, units, urgency, sector: hospital.sector }, config);
    return { screening, k: contactSetSize(units, urgency) };
  }, [hospital, group, pool, units, urgency, config]);

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setDoc(f ? { name: f.name, type: f.type, size: f.size, hash: await hashFile(f) } : null);
    setErrors((cur) => ({ ...cur, document: undefined }));
  }

  function input() {
    return {
      patient,
      units,
      urgency,
      prescription: {
        doctorName, pmdcNumber: pmdc, hospitalId: rxHospital, issuedOn, bloodGroup: rxGroup, unitsPrescribed: prescribed, diagnosis,
        document: doc,
      },
    };
  }

  async function submit() {
    setSubmitError(null);
    setRefused(null);
    const found = validateRequest(input(), NO_HISTORY);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.getElementById(Object.keys(found)[0])?.focus();
      return;
    }
    setBusy(true);
    try {
      const p = chosen ?? (await repo.savePatient(pf));
      const result = await repo.submitRequest({ ...input(), patientId: p.id, file });
      if (result.verification === 'Unverified') {
        toast.success('Request sent as unverified: some details could not be checked, and donors will see that.');
      }
      const detail = await repo.getRequest(result.id);
      try {
        const round = await runRound(repo, detail!);
        rememberOutcome(result.id, round.outcome);
      } catch (e) {
        // The request is saved; the round can be retried from its page.
        toast.error(e instanceof Error ? e.message : 'No donor could be contacted yet.');
      }
      navigate(`/recipient/requests/${result.id}`);
    } catch (e) {
      if (e instanceof RequestRefusedError) {
        setRefused({ flags: e.flags, sector: findHospital(rxHospital)?.sector ?? hospital?.sector ?? '' });
      } else if (e instanceof RequestRejectedError) {
        setErrors(e.fields as RequestErrors);
        setSubmitError(e.message);
      } else {
        setSubmitError(e instanceof Error ? e.message : 'The request could not be saved.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <ErrorState message={loadError} onRetry={() => void load()} />;
  if (!patients) return <section className="card"><Loading rows={6} /></section>;

  const setP = <K extends keyof PatientInput>(k: K, v: PatientInput[K]) => setPf((cur) => ({ ...cur, [k]: v }));
  const err = (k: keyof RequestErrors) => errors[k];

  return (
    <>
      <PageHeader
        title="New blood request"
        subtitle="Every request needs the patient’s record and the doctor’s prescription. BloodGrid checks them against its rules, then asks matching donors near the hospital."
      />

      <div className="builder">
        <section className="card" aria-labelledby="req-h">
          <div className="card-head"><h2 id="req-h">Request details</h2></div>
          <div className="card-body">
            <div className="form-step" aria-labelledby="s1">
              <h3 id="s1"><span>1</span>Patient</h3>
              <Field label="Patient" htmlFor="patientPick">
                <Select id="patientPick" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.fullName} · {p.mrNumber} · {p.bloodGroup}</option>
                  ))}
                  <option value="new">Add a new patient</option>
                </Select>
              </Field>
              {chosen ? (
                <p className="hint" style={{ marginTop: 8 }}>
                  {findHospital(chosen.hospitalId)?.name} · born {chosen.birthYear}. Records are kept under Patients.
                </p>
              ) : (
                <>
                  <div className="field-row" style={{ marginTop: 18 }}>
                    <Field label="Full name" htmlFor="patientName" error={err('patientName')}>
                      <TextInput id="patientName" value={pf.fullName} onChange={(e) => setP('fullName', e.target.value)} {...describe('patientName', err('patientName'))} />
                    </Field>
                    <Field label="Hospital record number" htmlFor="mrNumber" error={err('mrNumber')} hint="The MR number on the hospital file.">
                      <TextInput id="mrNumber" value={pf.mrNumber} onChange={(e) => setP('mrNumber', e.target.value)} {...describe('mrNumber', err('mrNumber'), 'x')} />
                    </Field>
                  </div>
                  <div className="field-row">
                    <Field label="Hospital" htmlFor="hospitalId" error={err('hospitalId')}>
                      <Select id="hospitalId" value={pf.hospitalId} onChange={(e) => setP('hospitalId', e.target.value)} {...describe('hospitalId', err('hospitalId'))}>
                        <option value="" disabled>Select</option>
                        {HOSPITALS.map((h) => <option key={h.id} value={h.id}>{h.name} ({h.sector})</option>)}
                      </Select>
                    </Field>
                    <Field label="Year of birth" htmlFor="birthYear" error={err('birthYear')}>
                      <TextInput
                        id="birthYear" inputMode="numeric" value={pf.birthYear ?? ''}
                        onChange={(e) => setP('birthYear', e.target.value === '' ? null : Number(e.target.value))} {...describe('birthYear', err('birthYear'))}
                      />
                    </Field>
                  </div>
                  <div className="field" style={{ marginTop: 18 }}>
                    <span className="label">Patient’s blood group</span>
                    <Segmented label="Patient’s blood group" idPrefix="patientGroup" value={pf.bloodGroup as BloodGroup} options={BLOOD_GROUPS} onChange={(v) => setP('bloodGroup', v)} invalid={!!err('patientGroup')} />
                    {err('patientGroup') && <p className="error-text" role="alert">{err('patientGroup')}</p>}
                  </div>
                </>
              )}
            </div>

            <div className="form-step" aria-labelledby="s2">
              <h3 id="s2"><span>2</span>Doctor’s prescription</h3>
              <div className="field-row">
                <Field label="Prescribing doctor" htmlFor="doctorName" error={err('doctorName')}>
                  <TextInput id="doctorName" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} {...describe('doctorName', err('doctorName'))} />
                </Field>
                <Field label="PMDC number" htmlFor="pmdcNumber" error={err('pmdcNumber')} hint="For example 12345-P.">
                  <TextInput id="pmdcNumber" value={pmdc} onChange={(e) => setPmdc(e.target.value)} {...describe('pmdcNumber', err('pmdcNumber'), 'x')} />
                </Field>
              </div>
              <div className="field-row">
                <Field label="Hospital on the prescription" htmlFor="rxHospital">
                  <Select id="rxHospital" value={rxHospital} onChange={(e) => setRxHospital(e.target.value)}>
                    <option value="" disabled>Select</option>
                    {HOSPITALS.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </Select>
                </Field>
                <Field label="Date on the prescription" htmlFor="issuedOn" error={err('issuedOn')}>
                  <TextInput id="issuedOn" type="date" value={issuedOn} max={today()} onChange={(e) => setIssuedOn(e.target.value)} {...describe('issuedOn', err('issuedOn'))} />
                </Field>
              </div>
              <div className="field-row">
                <Field label="Blood group prescribed" htmlFor="prescriptionGroup" error={err('prescriptionGroup')}>
                  <Select id="prescriptionGroup" value={rxGroup} onChange={(e) => setRxGroup(e.target.value as BloodGroup)} {...describe('prescriptionGroup', err('prescriptionGroup'))}>
                    <option value="" disabled>Select</option>
                    {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </Select>
                </Field>
                <Field label="Units prescribed" htmlFor="unitsPrescribed" error={err('unitsPrescribed')}>
                  <TextInput
                    id="unitsPrescribed" type="number" min={1} max={10} value={prescribed}
                    onChange={(e) => setPrescribed(Number(e.target.value))} {...describe('unitsPrescribed', err('unitsPrescribed'))}
                  />
                </Field>
              </div>
              <Field label="Diagnosis or reason" htmlFor="diagnosis" optional>
                <TextInput id="diagnosis" value={diagnosis} maxLength={200} onChange={(e) => setDiagnosis(e.target.value)} />
              </Field>
              <Field label="Prescription or requisition form" htmlFor="document" error={err('document')} hint={`PDF, JPG or PNG, up to ${MAX_FILE_BYTES / 1024 / 1024} MB. Only you can open it again.`}>
                <input
                  id="document" className="input file" type="file" accept={ALLOWED_FILE_TYPES.join(',')}
                  onChange={(e) => void pickFile(e)} {...describe('document', err('document'), 'x')}
                />
              </Field>
              {doc && <p className="hint" style={{ marginTop: 6 }}>{doc.name} · {fileSize(doc.size)}</p>}
            </div>

            <div className="form-step" aria-labelledby="s3">
              <h3 id="s3"><span>3</span>What is needed</h3>
              <div className="field">
                <span className="label" id="u-l">Units</span>
                <div className="stepper" role="group" aria-labelledby="u-l">
                  <button type="button" aria-label="Fewer units" disabled={units <= 1} onClick={() => setUnits(units - 1)}>−</button>
                  <output aria-live="polite">{units}</output>
                  <button type="button" aria-label="More units" disabled={units >= MAX_UNITS} onClick={() => setUnits(units + 1)}>+</button>
                </div>
                {err('units') && <p className="error-text" role="alert" id="units">{err('units')}</p>}
              </div>
              <div className="field">
                <span className="label">Urgency</span>
                <Segmented label="Urgency" value={urgency} options={URGENCIES} onChange={setUrgency} columns={3} />
                <p className="hint">{LEAN[urgency]}</p>
              </div>
            </div>

            {refused && (
              <div style={{ marginTop: 18 }}>
                <Alert tone="bad" title="BloodGrid could not verify this request">
                  <ul className="plain-list">
                    {refused.flags.map((f) => <li key={f.code}><span>{f.message}</span></li>)}
                  </ul>
                  <p style={{ margin: '8px 0 0' }}>Nothing was saved. Correct the details above and submit again.</p>
                </Alert>
                {urgency === 'Critical' && refused.sector && <div style={{ marginTop: 12 }}><NearbyBanks sector={refused.sector} /></div>}
              </div>
            )}
            {err('duplicate') && <div style={{ marginTop: 18 }}><Alert tone="warn" title="This patient already has an open request">{err('duplicate')}</Alert></div>}
            {submitError && !err('duplicate') && (
              <div style={{ marginTop: 18 }}><Alert tone="bad" title="Could not send the request">{submitError}</Alert></div>
            )}
            <div className="form-actions">
              <Button variant="primary" size="lg" onClick={() => void submit()} loading={busy}>
                {busy ? 'Checking and matching' : 'Submit request'}
              </Button>
              <span className="hint">BloodGrid checks the details first. Minor gaps go ahead marked unverified; serious problems stop the request.</span>
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="prev-h">
          <div className="card-head">
            <h2 id="prev-h">Availability preview</h2>
            <span className="sub end">{hospital ? `Around ${hospital.sector}` : 'Choose a hospital'}</span>
          </div>
          {!hospital || !group ? (
            <div className="card-body"><p className="hint">Choose the patient’s hospital and blood group to see the eligible donors nearby.</p></div>
          ) : !preview || !pool ? (
            <Loading rows={5} />
          ) : (
            <>
              <div className="facts">
                <div className="fact"><div className="v num">{preview.k}</div><div className="l">Donors to notify</div></div>
                <div className="fact"><div className="v num">{preview.screening.eligible.length}</div><div className="l">Donors pass every rule</div></div>
              </div>
              <div className="card-body">
                {preview.screening.eligible.length === 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Alert tone="bad" title="No donor can be notified in the first round">A wider second round can run from the request page.</Alert>
                  </div>
                )}
                <Funnel stages={preview.screening.stages} poolSize={pool.donors.length} />
                {urgency === 'Critical' && hospital && <div style={{ marginTop: 16 }}><NearbyBanks sector={hospital.sector} /></div>}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
