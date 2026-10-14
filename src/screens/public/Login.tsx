import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { homeFor, ROLE_LABEL } from '../../auth/roles';
import { AuthError, type Role } from '../../auth/types';
import { validateEmail } from '../../auth/validation';
import { useSession } from '../../state/Session';
import { Alert, Button, describe, Field, PasswordInput, TextInput } from '../../ui/kit';
import { AuthLayout } from './AuthLayout';

const ROLES: Role[] = ['donor', 'recipient', 'blood_bank'];

export function Login() {
  const { profile, loading, signIn, signOut } = useSession();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const role: Role = ROLES.includes(params.get('role') as Role) ? (params.get('role') as Role) : 'donor';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && profile && !busy) return <Navigate to={homeFor(profile.role)} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = { email: validateEmail(email) ?? undefined, password: password ? undefined : 'Enter your password.' };
    setErrors(next);
    setFormError(null);
    if (next.email || next.password) return;
    setBusy(true);
    try {
      const p = await signIn(email, password);
      if (p.role !== role) {
        await signOut();
        throw new AuthError(
          'wrong-role',
          `This is a ${ROLE_LABEL[p.role].toLowerCase()} account. Use the ${ROLE_LABEL[p.role]} tab to sign in.`,
        );
      }
      setBusy(false);
      navigate(homeFor(p.role), { replace: true });
    } catch (err) {
      setBusy(false);
      setFormError(err instanceof Error ? err.message : 'Could not sign in.');
    }
  }

  const bank = role === 'blood_bank';
  return (
    <AuthLayout>
      <h1>Sign in</h1>
      <p className="lead">Choose how you use BloodGrid, then enter your details.</p>

      <div className="auth-tabs" role="tablist" aria-label="Account type">
        {ROLES.map((r) => (
          <button
            key={r}
            role="tab"
            type="button"
            aria-selected={role === r}
            onClick={() => {
              setParams({ role: r }, { replace: true });
              setFormError(null);
            }}
          >
            {ROLE_LABEL[r]}
            {r === 'blood_bank' && <span className="soon">Soon</span>}
          </button>
        ))}
      </div>

      {bank ? (
        <Alert tone="info" title="Blood bank accounts are not open yet">
          The blood bank portal, with stock and request management, is the next module. Donors and recipients can sign in now.
        </Alert>
      ) : (
        <form onSubmit={(e) => void submit(e)} noValidate>
          {formError && (
            <div style={{ marginBottom: 18 }}>
              <Alert tone="bad" title="Could not sign in">{formError}</Alert>
            </div>
          )}
          <Field label="Email" htmlFor="email" error={errors.email}>
            <TextInput
              id="email" type="email" autoComplete="email" inputMode="email" value={email} autoFocus
              onChange={(e) => setEmail(e.target.value)} {...describe('email', errors.email)}
            />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password}>
            <PasswordInput
              id="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} {...describe('password', errors.password)}
            />
          </Field>
          <div className="auth-form-actions">
            <Button type="submit" variant="primary" size="lg" block loading={busy}>Sign in as {ROLE_LABEL[role].toLowerCase()}</Button>
          </div>
        </form>
      )}

      <p className="auth-foot">
        New to BloodGrid? <Link to={`/signup?role=${bank ? 'donor' : role}`}>Create an account</Link>
      </p>
    </AuthLayout>
  );
}
