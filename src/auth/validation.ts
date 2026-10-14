import { BLOOD_GROUPS } from '../engine';
import { SECTORS } from '../data/sectors';
import type { SignUpRole } from './types';

export const MIN_PASSWORD = 8;
export const MIN_DONOR_AGE_NOTE = 'You must be at least 18 and in good health to donate.';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(v: string): string | null {
  if (!v.trim()) return 'Enter your email address.';
  return EMAIL.test(v.trim()) ? null : 'Enter a valid email address, like name@example.com.';
}

export function validatePassword(v: string): string | null {
  if (!v) return 'Enter a password.';
  if (v.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (!/[a-zA-Z]/.test(v) || !/\d/.test(v)) return 'Include at least one letter and one number.';
  return null;
}

export function validateName(v: string): string | null {
  const t = v.trim();
  if (t.length < 2) return 'Enter your full name.';
  return t.length > 80 ? 'Use 80 characters or fewer.' : null;
}

export function validateLastDonation(v: string, now = new Date()): string | null {
  if (!v) return null;
  const t = Date.parse(`${v}T00:00:00Z`);
  if (Number.isNaN(t)) return 'Enter a valid date.';
  if (t > now.getTime()) return 'The date cannot be in the future.';
  return null;
}

export interface SignUpFields {
  role: SignUpRole;
  fullName: string;
  email: string;
  password: string;
  bloodGroup: string;
  sector: string;
  lastDonation: string;
  consent: boolean;
}

export type FieldErrors = Partial<Record<keyof SignUpFields, string>>;

export function validateSignUp(f: SignUpFields, now = new Date()): FieldErrors {
  const errors: FieldErrors = {};
  const set = <K extends keyof SignUpFields>(k: K, msg: string | null) => {
    if (msg) errors[k] = msg;
  };
  set('fullName', validateName(f.fullName));
  set('email', validateEmail(f.email));
  set('password', validatePassword(f.password));
  if (f.role === 'donor') {
    if (!(BLOOD_GROUPS as readonly string[]).includes(f.bloodGroup)) errors.bloodGroup = 'Choose your blood group.';
    if (!SECTORS.some((s) => s.id === f.sector)) errors.sector = 'Choose your sector.';
    set('lastDonation', validateLastDonation(f.lastDonation, now));
  }
  if (!f.consent) errors.consent = 'Please confirm to continue.';
  return errors;
}
