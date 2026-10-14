import { describe, expect, it } from 'vitest';
import { validateEmail, validateLastDonation, validateName, validatePassword, validateSignUp, type SignUpFields } from '../src/auth/validation';

const donor: SignUpFields = {
  role: 'donor', fullName: 'Ayesha Khan', email: 'ayesha@example.com', password: 'secret123',
  bloodGroup: 'A+', sector: 'G-8', lastDonation: '', consent: true,
};

describe('field validation', () => {
  it('accepts ordinary emails and rejects malformed ones', () => {
    expect(validateEmail('a@b.co')).toBeNull();
    expect(validateEmail('')).toMatch(/Enter your email/);
    expect(validateEmail('no-at-sign')).toMatch(/valid email/);
    expect(validateEmail('a@b')).toMatch(/valid email/);
  });

  it('requires a password of 8+ characters with a letter and a number', () => {
    expect(validatePassword('')).not.toBeNull();
    expect(validatePassword('short1')).toMatch(/at least 8/);
    expect(validatePassword('allletters')).toMatch(/letter and one number/);
    expect(validatePassword('12345678')).toMatch(/letter and one number/);
    expect(validatePassword('secret123')).toBeNull();
  });

  it('checks the name length', () => {
    expect(validateName(' a ')).not.toBeNull();
    expect(validateName('Al')).toBeNull();
    expect(validateName('x'.repeat(81))).toMatch(/80/);
  });

  it('rejects a last-donation date in the future or not a date', () => {
    const now = new Date('2026-10-14T00:00:00Z');
    expect(validateLastDonation('', now)).toBeNull();
    expect(validateLastDonation('2026-09-01', now)).toBeNull();
    expect(validateLastDonation('2027-01-01', now)).toMatch(/future/);
    expect(validateLastDonation('nonsense', now)).toMatch(/valid date/);
  });
});

describe('sign-up form', () => {
  it('passes a complete donor form', () => {
    expect(validateSignUp(donor)).toEqual({});
  });

  it('flags every missing donor field at once', () => {
    const errors = validateSignUp({ ...donor, fullName: '', email: '', password: '', bloodGroup: '', sector: '', consent: false });
    expect(Object.keys(errors).sort()).toEqual(['bloodGroup', 'consent', 'email', 'fullName', 'password', 'sector']);
  });

  it('does not ask a recipient for donor details', () => {
    const errors = validateSignUp({ ...donor, role: 'recipient', bloodGroup: '', sector: '' });
    expect(errors).toEqual({});
  });

  it('rejects an unknown blood group or sector', () => {
    const errors = validateSignUp({ ...donor, bloodGroup: 'Z+', sector: 'Z-99' });
    expect(errors.bloodGroup).toBeDefined();
    expect(errors.sector).toBeDefined();
  });
});
