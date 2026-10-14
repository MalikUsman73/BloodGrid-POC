import type { LocalRepository } from '../data/localRepository';
import { AuthError, type AuthService, type Profile, type Role, type SignUpInput, type SignUpResult } from './types';

const KEY = 'bloodgrid.demo-accounts.v1';
const SESSION = 'bloodgrid.demo-session.v1';

interface Account {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  passwordHash: string;
  donor?: SignUpInput['donor'];
}

async function hash(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(`bloodgrid-demo:${text}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Demo accounts that live in this browser only. Used when no database is configured, so the whole
 * product can still be shown offline. It enforces the same roles as the database, but it is not a
 * security boundary: anyone with this browser can read the stored accounts.
 */
export class LocalAuth implements AuthService {
  readonly mode = 'local' as const;
  private listeners = new Set<(p: Profile | null) => void>();
  private accounts: Account[] = [];

  constructor(private readonly repo: LocalRepository, private readonly storage: Storage | null = safeStorage()) {
    try {
      this.accounts = JSON.parse(this.storage?.getItem(KEY) ?? '[]') as Account[];
    } catch {
      this.accounts = [];
    }
    // Donors who signed up earlier rejoin the pool, which is rebuilt on every page load.
    for (const a of this.accounts) {
      if (a.role === 'donor' && a.donor) {
        repo.registerDonor(a.id, { group: a.donor.bloodGroup, sector: a.donor.sector, lastDonation: a.donor.lastDonation });
      }
    }
    const sessionId = this.storage?.getItem(SESSION);
    repo.setUser(this.accounts.find((a) => a.id === sessionId)?.id ?? null);
  }

  private save() {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.accounts));
    } catch {
      /* storage unavailable: accounts last for this page only */
    }
  }

  private profile(a: Account): Profile {
    return { id: a.id, email: a.email, role: a.role, fullName: a.fullName };
  }

  private emit(p: Profile | null) {
    this.listeners.forEach((l) => l(p));
  }

  private start(a: Account) {
    this.repo.setUser(a.id);
    try {
      this.storage?.setItem(SESSION, a.id);
    } catch {
      /* ignore */
    }
    const p = this.profile(a);
    this.emit(p);
    return p;
  }

  async current() {
    const id = this.storage?.getItem(SESSION);
    const a = this.accounts.find((x) => x.id === id);
    return a ? this.profile(a) : null;
  }

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    const email = input.email.trim().toLowerCase();
    if (this.accounts.some((a) => a.email === email)) {
      throw new AuthError('email-taken', 'An account with this email already exists. Sign in instead.');
    }
    if (input.role === 'donor' && !input.donor) throw new AuthError('invalid-details', 'Donor details are required.');
    const account: Account = {
      id: crypto.randomUUID(),
      email,
      role: input.role,
      fullName: input.fullName.trim(),
      passwordHash: await hash(input.password),
      donor: input.role === 'donor' ? input.donor : undefined,
    };
    if (account.role === 'donor' && account.donor) {
      this.repo.registerDonor(account.id, {
        group: account.donor.bloodGroup, sector: account.donor.sector, lastDonation: account.donor.lastDonation || undefined,
      });
    }
    this.accounts.push(account);
    this.save();
    return { status: 'signed-in', profile: this.start(account) };
  }

  async signIn(email: string, password: string): Promise<Profile> {
    const a = this.accounts.find((x) => x.email === email.trim().toLowerCase());
    if (!a || a.passwordHash !== (await hash(password))) {
      throw new AuthError('invalid-credentials', 'That email and password do not match an account.');
    }
    return this.start(a);
  }

  async signOut() {
    this.repo.setUser(null);
    try {
      this.storage?.removeItem(SESSION);
    } catch {
      /* ignore */
    }
    this.emit(null);
  }

  onChange(listener: (p: Profile | null) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
