import type { AuthError as SbAuthError, SupabaseClient, User } from '@supabase/supabase-js';
import { AuthError, type AuthService, type Profile, type Role, type SignUpInput, type SignUpResult } from './types';

function translate(error: SbAuthError | { message: string; status?: number }): AuthError {
  const m = error.message.toLowerCase();
  if (m.includes('invalid login')) return new AuthError('invalid-credentials', 'That email and password do not match an account.');
  if (m.includes('not confirmed')) return new AuthError('email-not-confirmed', 'Confirm your email first. We sent you a link when you signed up.');
  if (m.includes('already registered') || m.includes('already been registered')) {
    return new AuthError('email-taken', 'An account with this email already exists. Sign in instead.');
  }
  if (m.includes('password')) return new AuthError('weak-password', 'Choose a stronger password.');
  if (m.includes('rate limit') || ('status' in error && error.status === 429)) {
    return new AuthError('rate-limited', 'Too many attempts. Wait a few minutes and try again.');
  }
  if (m.includes('database error')) return new AuthError('invalid-details', 'Some of your details were not accepted. Check them and try again.');
  if (m.includes('fetch') || m.includes('network')) return new AuthError('network', 'Could not reach the server. Check your connection.');
  return new AuthError('unknown', 'Something went wrong. Try again.');
}

export class SupabaseAuth implements AuthService {
  readonly mode = 'supabase' as const;

  constructor(private readonly client: SupabaseClient) {}

  private async profileOf(user: User): Promise<Profile | null> {
    const { data, error } = await this.client.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle();
    if (error || !data) return null;
    return { id: user.id, email: user.email ?? '', role: data.role as Role, fullName: String(data.full_name) };
  }

  async current(): Promise<Profile | null> {
    const { data } = await this.client.auth.getSession();
    return data.session ? this.profileOf(data.session.user) : null;
  }

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          role: input.role,
          full_name: input.fullName.trim(),
          ...(input.role === 'donor' && input.donor
            ? { blood_group: input.donor.bloodGroup, sector: input.donor.sector, last_donation: input.donor.lastDonation ?? '' }
            : {}),
        },
      },
    });
    if (error) throw translate(error);
    // With email confirmation on, an address that is already registered comes back with no identities.
    if (data.user && data.user.identities?.length === 0) throw translate({ message: 'User already registered' });
    if (!data.session || !data.user) return { status: 'confirm-email', email: input.email.trim() };
    const profile = await this.profileOf(data.user);
    if (!profile) throw new AuthError('unknown', 'Your account was created but its profile could not be read. Try signing in.');
    return { status: 'signed-in', profile };
  }

  async signIn(email: string, password: string): Promise<Profile> {
    const { data, error } = await this.client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw translate(error);
    const profile = await this.profileOf(data.user);
    if (!profile) {
      await this.client.auth.signOut();
      throw new AuthError('unknown', 'This account has no profile. Contact support.');
    }
    return profile;
  }

  async signOut() {
    await this.client.auth.signOut();
  }

  onChange(listener: (profile: Profile | null) => void) {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      // Defer: calling the client inside this callback can deadlock the auth lock.
      setTimeout(() => {
        if (!session) listener(null);
        else void this.profileOf(session.user).then(listener);
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }
}
