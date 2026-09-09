/**
 * In-memory application store.
 *
 * PROTOTYPE ONLY. There is no backend, no database, and no persistence.
 * State lives for the duration of the browser session, which is all the
 * proposal-stage demonstration requires.
 */

import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type {
  BloodGroup, BloodRequest, InterBankRequest, OutreachCampaign, Role, Urgency,
} from '../types';
import { seededRequests } from '../mock/requests';

interface State {
  role: Role;
  requests: BloodRequest[];
  outreach: OutreachCampaign[];
  interBank: InterBankRequest[];
  /** Donor-side availability toggle (Tier 2 donor experience). */
  donorAvailable: boolean;
  /** Request ids the demo donor has responded to. */
  donorResponses: Record<string, 'accepted' | 'declined'>;
}

type Action =
  | { type: 'setRole'; role: Role }
  | { type: 'createRequest'; request: BloodRequest }
  | { type: 'contactDonor'; requestId: string; donorId: string }
  | { type: 'addOutreach'; campaign: OutreachCampaign }
  | { type: 'addInterBank'; request: InterBankRequest }
  | { type: 'setDonorAvailable'; value: boolean }
  | { type: 'donorRespond'; requestId: string; response: 'accepted' | 'declined' };

const initialState: State = {
  role: 'seeker',
  requests: seededRequests,
  outreach: [],
  interBank: [],
  donorAvailable: true,
  donorResponses: {},
};

/**
 * Session persistence.
 *
 * Still no backend and no database — this only mirrors the in-memory state into
 * sessionStorage so that an accidental page refresh during the live defense
 * does not discard a request the presenter has just created. It is cleared when
 * the browser tab closes. Every access is guarded: private windows and blocked
 * site data must not break the demonstration.
 */
const STORAGE_KEY = 'bloodgrid.poc.session.v1';

function loadState(): State {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const saved = JSON.parse(raw);
    return {
      ...initialState,
      ...saved,
      // Never let stale storage drop the seeded demonstration records.
      requests: Array.isArray(saved.requests) && saved.requests.length
        ? saved.requests
        : seededRequests,
    };
  } catch {
    return initialState;
  }
}

function saveState(state: State) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable — the prototype continues with in-memory state only.
  }
}

/** Counters resume past any ids already present, so refreshing cannot collide. */
function highestId(items: { id: string }[], fallback: number): number {
  const nums = items
    .map((i) => Number(i.id.split('-')[1]))
    .filter((n) => Number.isFinite(n));
  return nums.length ? Math.max(fallback, ...nums) : fallback;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setRole':
      return { ...state, role: action.role };

    case 'createRequest':
      return { ...state, requests: [action.request, ...state.requests] };

    case 'contactDonor':
      return {
        ...state,
        requests: state.requests.map((r) =>
          r.id !== action.requestId || r.contactedDonorIds.includes(action.donorId)
            ? r
            : { ...r, status: 'Donors Contacted', contactedDonorIds: [...r.contactedDonorIds, action.donorId] },
        ),
      };

    case 'addOutreach':
      return { ...state, outreach: [action.campaign, ...state.outreach] };

    case 'addInterBank':
      return { ...state, interBank: [action.request, ...state.interBank] };

    case 'setDonorAvailable':
      return { ...state, donorAvailable: action.value };

    case 'donorRespond':
      return { ...state, donorResponses: { ...state.donorResponses, [action.requestId]: action.response } };

    default:
      return state;
  }
}

interface Ctx extends State {
  setRole: (role: Role) => void;
  createRequest: (input: {
    bloodGroup: BloodGroup; urgency: Urgency; sector: string;
    units: number; hospital: string; note?: string;
  }) => BloodRequest;
  contactDonor: (requestId: string, donorId: string) => void;
  addOutreach: (c: Omit<OutreachCampaign, 'id' | 'createdLabel'>) => OutreachCampaign;
  addInterBank: (r: Omit<InterBankRequest, 'id' | 'createdLabel'>) => InterBankRequest;
  setDonorAvailable: (v: boolean) => void;
  donorRespond: (requestId: string, response: 'accepted' | 'declined') => void;
  getRequest: (id: string) => BloodRequest | undefined;
}

const AppContext = createContext<Ctx | null>(null);

let requestCounter = 2400;
let outreachCounter = 100;
let interBankCounter = 500;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const restored = loadState();
    requestCounter = highestId(restored.requests, requestCounter);
    outreachCounter = highestId(restored.outreach, outreachCounter);
    interBankCounter = highestId(restored.interBank, interBankCounter);
    return restored;
  });

  useEffect(() => { saveState(state); }, [state]);

  const value = useMemo<Ctx>(() => ({
    ...state,

    setRole: (role) => dispatch({ type: 'setRole', role }),

    createRequest: (input) => {
      requestCounter += 1;
      const id = `REQ-${requestCounter}`;
      const request: BloodRequest = {
        id,
        bloodGroup: input.bloodGroup,
        urgency: input.urgency,
        sector: input.sector,
        units: input.units,
        patientRef: `Case #${requestCounter}`,
        hospital: input.hospital,
        note: input.note,
        createdAt: '2026-09-10',
        createdLabel: '10 Sep 2026',
        status: 'Matching',
        contactedDonorIds: [],
      };
      dispatch({ type: 'createRequest', request });
      return request;
    },

    contactDonor: (requestId, donorId) => dispatch({ type: 'contactDonor', requestId, donorId }),

    addOutreach: (c) => {
      outreachCounter += 1;
      const campaign: OutreachCampaign = { ...c, id: `OUT-${outreachCounter}`, createdLabel: '10 Sep 2026' };
      dispatch({ type: 'addOutreach', campaign });
      return campaign;
    },

    addInterBank: (r) => {
      interBankCounter += 1;
      const req: InterBankRequest = { ...r, id: `IBR-${interBankCounter}`, createdLabel: '10 Sep 2026' };
      dispatch({ type: 'addInterBank', request: req });
      return req;
    },

    setDonorAvailable: (v) => dispatch({ type: 'setDonorAvailable', value: v }),
    donorRespond: (requestId, response) => dispatch({ type: 'donorRespond', requestId, response }),

    getRequest: (id) => state.requests.find((r) => r.id === id),
  }), [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
