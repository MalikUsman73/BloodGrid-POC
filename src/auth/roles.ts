import type { Role } from './types';

export const homeFor = (role: Role): string => (role === 'donor' ? '/donor' : role === 'recipient' ? '/recipient' : '/bank');

export const ROLE_LABEL: Record<Role, string> = { donor: 'Donor', recipient: 'Recipient', blood_bank: 'Blood bank' };
