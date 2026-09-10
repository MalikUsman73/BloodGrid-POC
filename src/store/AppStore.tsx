/**
 * Application state.
 *
 * There is no backend and no database. State lives in memory for the session
 * and is mirrored into sessionStorage, so refreshing the page during a
 * demonstration does not discard a request that was just created.
 *
 * The communication model is enforced here: a seeker sends a request to a
 * donor, and a conversation only exists once that donor accepts. Nothing in
 * this store holds a phone number or an address.
 */

import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type {
  BloodGroup, BloodRequest, ConversationMessage, DonorRequest, InterBankRequest,
  OutreachCampaign, Role, Urgency,
} from '../types';
import { seededRequests } from '../mock/requests';
import { DEMO_TODAY } from '../mock/demand';
import { formatDate } from '../lib/format';

const TODAY_LABEL = formatDate(DEMO_TODAY);

interface State {
  role: Role;
  requests: BloodRequest[];
  /** One entry per (request, donor) pair the seeker has contacted. */
  donorRequests: DonorRequest[];
  outreach: OutreachCampaign[];
  interBank: InterBankRequest[];
  donorAvailable: boolean;
}

type Action =
  | { type: 'selectRole'; role: Role }
  | { type: 'addRequest'; request: BloodRequest }
  | { type: 'addDonorRequest'; donorRequest: DonorRequest }
  | { type: 'setDonorResponse'; requestId: string; donorId: string; accepted: boolean; reply: ConversationMessage }
  | { type: 'addMessage'; requestId: string; donorId: string; message: ConversationMessage }
  | { type: 'addOutreach'; campaign: OutreachCampaign }
  | { type: 'addInterBank'; request: InterBankRequest }
  | { type: 'setDonorAvailable'; available: boolean };

const initialState: State = {
  role: 'seeker',
  requests: seededRequests,
  donorRequests: [],
  outreach: [],
  interBank: [],
  donorAvailable: true,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'selectRole':
      return { ...state, role: action.role };

    case 'addRequest':
      return { ...state, requests: [action.request, ...state.requests] };

    case 'addDonorRequest':
      return {
        ...state,
        donorRequests: [...state.donorRequests, action.donorRequest],
        requests: state.requests.map((request) =>
          request.id === action.donorRequest.requestId && request.status === 'Matching'
            ? { ...request, status: 'Awaiting Response' }
            : request,
        ),
      };

    case 'setDonorResponse': {
      const donorRequests = state.donorRequests.map((entry) =>
        entry.requestId === action.requestId && entry.donorId === action.donorId
          ? {
              ...entry,
              state: action.accepted ? ('Accepted' as const) : ('Declined' as const),
              messages: action.accepted ? [action.reply] : entry.messages,
            }
          : entry,
      );

      const anyAccepted = donorRequests.some(
        (entry) => entry.requestId === action.requestId && entry.state === 'Accepted',
      );

      return {
        ...state,
        donorRequests,
        requests: state.requests.map((request) =>
          request.id === action.requestId && anyAccepted
            ? { ...request, status: 'Donor Accepted' }
            : request,
        ),
      };
    }

    case 'addMessage':
      return {
        ...state,
        donorRequests: state.donorRequests.map((entry) =>
          entry.requestId === action.requestId && entry.donorId === action.donorId
            ? { ...entry, messages: [...entry.messages, action.message] }
            : entry,
        ),
      };

    case 'addOutreach':
      return { ...state, outreach: [action.campaign, ...state.outreach] };

    case 'addInterBank':
      return { ...state, interBank: [action.request, ...state.interBank] };

    case 'setDonorAvailable':
      return { ...state, donorAvailable: action.available };

    default:
      return state;
  }
}

/* ------------------------------------------------------------- Persistence */

const STORAGE_KEY = 'bloodgrid.session.v2';

function readStoredState(): State {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const stored = JSON.parse(raw) as Partial<State>;
    return {
      ...initialState,
      ...stored,
      requests: stored.requests?.length ? stored.requests : seededRequests,
    };
  } catch {
    return initialState;
  }
}

function writeStoredState(state: State) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable. The prototype continues with in-memory state only.
  }
}

/** Resume id counters past anything already stored, so a refresh cannot collide. */
function highestSequence(items: { id: string }[], floor: number): number {
  const numbers = items
    .map((item) => Number(item.id.split('-')[1]))
    .filter((value) => Number.isFinite(value));
  return numbers.length ? Math.max(floor, ...numbers) : floor;
}

/* ----------------------------------------------------------------- Context */

interface AppContextValue extends State {
  selectRole: (role: Role) => void;
  createBloodRequest: (input: {
    bloodGroup: BloodGroup; urgency: Urgency; sector: string;
    units: number; facility: string; note?: string;
  }) => BloodRequest;
  sendRequestToDonor: (requestId: string, donorId: string) => void;
  respondToRequest: (requestId: string, donorId: string, accepted: boolean, donorName: string) => void;
  sendMessage: (requestId: string, donorId: string, from: 'seeker' | 'donor', text: string) => void;
  startOutreach: (input: Omit<OutreachCampaign, 'id' | 'createdLabel'>) => OutreachCampaign;
  requestFromPartnerBank: (input: Omit<InterBankRequest, 'id' | 'createdLabel'>) => InterBankRequest;
  setDonorAvailable: (available: boolean) => void;
  findRequest: (id: string) => BloodRequest | undefined;
  findDonorRequest: (requestId: string, donorId: string) => DonorRequest | undefined;
  donorRequestsFor: (requestId: string) => DonorRequest[];
  /** Requests sent to the donor persona, for the donor workspace. */
  donorInbox: () => DonorRequest[];
}

const AppContext = createContext<AppContextValue | null>(null);

let requestSequence = 2400;
let outreachSequence = 100;
let interBankSequence = 500;
let messageSequence = 0;

/** The donor persona used by the donor workspace. */
export const DEMO_DONOR_ID = 'DNR-001';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const restored = readStoredState();
    requestSequence = highestSequence(restored.requests, requestSequence);
    outreachSequence = highestSequence(restored.outreach, outreachSequence);
    interBankSequence = highestSequence(restored.interBank, interBankSequence);
    return restored;
  });

  useEffect(() => { writeStoredState(state); }, [state]);

  const value = useMemo<AppContextValue>(() => ({
    ...state,

    selectRole: (role) => dispatch({ type: 'selectRole', role }),

    createBloodRequest: (input) => {
      requestSequence += 1;
      const request: BloodRequest = {
        id: `REQ-${requestSequence}`,
        bloodGroup: input.bloodGroup,
        urgency: input.urgency,
        sector: input.sector,
        units: input.units,
        patientRef: `Case ${requestSequence}`,
        facility: input.facility,
        note: input.note,
        createdLabel: TODAY_LABEL,
        status: 'Matching',
      };
      dispatch({ type: 'addRequest', request });
      return request;
    },

    sendRequestToDonor: (requestId, donorId) => {
      const existing = state.donorRequests.find(
        (entry) => entry.requestId === requestId && entry.donorId === donorId,
      );
      if (existing) return;
      dispatch({
        type: 'addDonorRequest',
        donorRequest: {
          requestId, donorId, state: 'Sent',
          sentLabel: TODAY_LABEL, messages: [],
        },
      });
    },

    respondToRequest: (requestId, donorId, accepted, donorName) => {
      messageSequence += 1;
      dispatch({
        type: 'setDonorResponse',
        requestId, donorId, accepted,
        reply: {
          id: `MSG-${messageSequence}`,
          from: 'donor',
          text: `This is ${donorName}. I have accepted your request and can donate. Please let me know when to come in.`,
          timeLabel: TODAY_LABEL,
        },
      });
    },

    sendMessage: (requestId, donorId, from, text) => {
      messageSequence += 1;
      dispatch({
        type: 'addMessage',
        requestId, donorId,
        message: { id: `MSG-${messageSequence}`, from, text, timeLabel: TODAY_LABEL },
      });
    },

    startOutreach: (input) => {
      outreachSequence += 1;
      const campaign: OutreachCampaign = {
        ...input, id: `OUT-${outreachSequence}`, createdLabel: TODAY_LABEL,
      };
      dispatch({ type: 'addOutreach', campaign });
      return campaign;
    },

    requestFromPartnerBank: (input) => {
      interBankSequence += 1;
      const request: InterBankRequest = {
        ...input, id: `IBR-${interBankSequence}`, createdLabel: TODAY_LABEL,
      };
      dispatch({ type: 'addInterBank', request });
      return request;
    },

    setDonorAvailable: (available) => dispatch({ type: 'setDonorAvailable', available }),

    findRequest: (id) => state.requests.find((request) => request.id === id),

    findDonorRequest: (requestId, donorId) =>
      state.donorRequests.find(
        (entry) => entry.requestId === requestId && entry.donorId === donorId,
      ),

    donorRequestsFor: (requestId) =>
      state.donorRequests.filter((entry) => entry.requestId === requestId),

    donorInbox: () => state.donorRequests.filter((entry) => entry.donorId === DEMO_DONOR_ID),
  }), [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
