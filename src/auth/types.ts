import type { BloodGroup } from '../engine';

export type Role = 'donor' | 'recipient' | 'blood_bank';
export type SignUpRole = Exclude<Role, 'blood_bank'>;

export interface Profile {
  id: string;
  email: string;
  role: Role;
  fullName: string;
}

export interface SignUpInput {
  role: SignUpRole;
  email: string;
  password: string;
  fullName: string;
  donor?: { bloodGroup: BloodGroup; sector: string; lastDonation?: string };
}

export type SignUpResult =
  | { status: 'signed-in'; profile: Profile }
  | { status: 'confirm-email'; email: string };

export type AuthErrorCode =
  | 'invalid-credentials'
  | 'email-taken'
  | 'weak-password'
  | 'invalid-details'
  | 'email-not-confirmed'
  | 'rate-limited'
  | 'network'
  | 'wrong-role'
  | 'unknown';

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AuthService {
  readonly mode: 'supabase' | 'local';
  /** The signed-in person's profile, or null when signed out. */
  current(): Promise<Profile | null>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  signIn(email: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  /** Called whenever the session changes. Returns an unsubscribe function. */
  onChange(listener: (profile: Profile | null) => void): () => void;
}
