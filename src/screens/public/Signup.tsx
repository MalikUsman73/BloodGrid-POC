import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { homeFor } from '../../auth/roles';
import type { SignUpRole } from '../../auth/types';
import { validateSignUp, type FieldErrors, type SignUpFields } from '../../auth/validation';
import { SECTORS } from '../../data';
import { BLOOD_GROUPS, type BloodGroup } from '../../engine';
import { useSession } from '../../state/Session';
import { Alert, Button, describe, Field, PasswordInput, Segmented, Select, TextInput } from '../../ui/kit';
import { AuthLayout } from './AuthLayout';

const ROLES: SignUpRole[] = ['donor', 'recipient'];

export function Signup() {
  const { profile, loading, signUp } = useSession();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const role: SignUpRole = params.get('role') === 'recipient' ? 'recipient' : 'donor';

  const [f, setF] = useState<SignUpFields>({
    role, fullName: '', email: '', password: '', bloodGroup: '', sector: '', lastDonation: '', consent: false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  if (!loading && profile && !busy) return <Navigate to={homeFor(profile.role)} replace />;

  const set = <K extends keyof SignUpFields>(k: K, v: SignUpFields[K]) => setF((cur) => ({ ...cur, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = validateSignUp({ ...f, role });
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) {
      document.getElementById(Object.keys(found)[0])?.focus();
      return;
    }
    setBusy(true);
    try {
      const r = await signUp({
        role,
        email: f.email,
        password: f.password,
        fullName: f.fullName,
        donor: role === 'donor' ? { bloodGroup: f.bloodGroup as BloodGroup, sector: f.sector, lastDonation: f.lastDonation || undefined } : undefined,
      });
      setBusy(false);
      if (r.status === 'confirm-email') setConfirm(r.email);
      else navigate(homeFor(r.profile.role), { replace: true });
    } catch (err) {
      setBusy(false);
      setFormError(err instanceof Error ? err.message : 'Could not create the account.');
    }
  }

  if (confirm) {
    return (
      <AuthLayout>
        <h1>Check your email</h1>
        <p className="lead">We sent a confirmation link to <strong>{confirm}</strong>. Open it to finish creating your account, then sign in.</p>
        <Alert tone="ok" title="Account created">
          Your details are saved. You just need to confirm the address.
        </Alert>
        <p className="auth-foot"><Link to={`/login?role=${role}`}>Go to sign in</Link></p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1>Create your account</h1>
      <p className="lead">
        {role === 'donor' ? 'Get matched with people who need your blood group, nearby.' : 'Raise a request and let BloodGrid find the right donors.'}
      </p>

      <div className="auth-tabs two" role="tablist" aria-label="Account type">
        {ROLES.map((r) => (
          <button
            key={r} role="tab" type="button" aria-selected={role === r}
            onClick={() => { setParams({ role: r }, { replace: true }); setErrors({}); setFormError(null); }}
          >
            {r === 'donor' ? 'I want to donate' : 'I need blood'}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => void submit(e)} noValidate>
        {formError && (
          <div style={{ marginBottom: 18 }}>
            <Alert tone="bad" title="Could not create the account">{formError}</Alert>
          </div>
        )}

        <Field label="Full name" htmlFor="fullName" error={errors.fullName}>
          <TextInput id="fullName" autoComplete="name" value={f.fullName} onChange={(e) => set('fullName', e.target.value)} {...describe('fullName', errors.fullName)} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <TextInput id="email" type="email" autoComplete="email" inputMode="email" value={f.email} onChange={(e) => set('email', e.target.value)} {...describe('email', errors.email)} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters, with a letter and a number.">
          <PasswordInput id="password" autoComplete="new-password" value={f.password} onChange={(e) => set('password', e.target.value)} {...describe('password', errors.password, 'x')} />
        </Field>

        {role === 'donor' && (
          <div className="form-section">
            <h2>Donor details</h2>
            <div className="field">
              <span className="label" id="bg-l">Blood group</span>
              <Segmented
                label="Blood group" idPrefix="bloodGroup" value={f.bloodGroup as BloodGroup} options={BLOOD_GROUPS}
                onChange={(v) => set('bloodGroup', v)} invalid={!!errors.bloodGroup}
              />
              {errors.bloodGroup && <p className="error-text" role="alert">{errors.bloodGroup}</p>}
            </div>
            <div className="field-row">
              <Field label="Your sector" htmlFor="sector" error={errors.sector}>
                <Select id="sector" value={f.sector} onChange={(e) => set('sector', e.target.value)} {...describe('sector', errors.sector)}>
                  <option value="" disabled>Select</option>
                  {SECTORS.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
                </Select>
              </Field>
              <Field label="Last donation" htmlFor="lastDonation" optional error={errors.lastDonation}>
                <TextInput
                  id="lastDonation" type="date" value={f.lastDonation} max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => set('lastDonation', e.target.value)} {...describe('lastDonation', errors.lastDonation)}
                />
              </Field>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              Only your sector is stored for matching, never your address. Leave the date empty if you have never donated.
            </p>
          </div>
        )}

        <div className="field" style={{ marginTop: 22 }}>
          <label className="check" htmlFor="consent">
            <input id="consent" type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} {...describe('consent', errors.consent)} />
            <span>
              {role === 'donor'
                ? 'I am at least 18, I am in good health to donate, and I agree to be contacted about matching requests.'
                : 'I understand this is a pilot with synthetic data and not for real emergencies.'}
            </span>
          </label>
          {errors.consent && <p className="error-text" role="alert">{errors.consent}</p>}
        </div>

        <div className="auth-form-actions">
          <Button type="submit" variant="primary" size="lg" block loading={busy}>Create account</Button>
        </div>
      </form>

      <p className="auth-foot">Already have an account? <Link to={`/login?role=${role}`}>Sign in</Link></p>
    </AuthLayout>
  );
}
