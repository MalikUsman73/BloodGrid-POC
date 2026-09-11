/**
 * Application state.
 *
 * There is no backend and no database. State lives in memory for the session
 * and is mirrored into sessionStorage, so refreshing during a demonstration
 * does not discard a request that was just created.
 *
 * The flow this store implements:
 *
 *   1. A seeker creates a request for N units.
 *   2. The matching engine ranks contactable donors, and the system selects the
 *      top K and notifies all of them. K rises with urgency: 1.3, 1.6 or 2.0
 *      times the units needed. The seeker does not choose; the system does.
 *   3. Until a donor accepts, the seeker sees those donors anonymised.
 *   4. The first N donors to accept are confirmed and revealed by name, and a
 *      conversation opens. Anyone accepting after that is stood down, and
 *      their eligibility is not consumed.
 *   5. A confirmed acceptance updates that donor's record, so they leave the
 *      eligible pool for the donation interval.
 *
 * Nothing in this store holds a phone number or an address.
 */

import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type {
  BloodGroup, BloodRequest, ConversationMessage, Donor, DonorAdjustment, DonorRequest,
  InterBankRequest, OutreachCampaign, Role, Urgency,
} from '../types';
import { seededRequests } from '../mock/requests';
import { donors as baseDonors, MIN_DAYS_BETWEEN_DONATIONS } from '../mock/donors';
import { donorsToNotify, rankDonorsForRequest } from '../engines/matching';
import { DEMO_TODAY } from '../mock/demand';
import { formatDate } from '../lib/format';

const TODAY_LABEL = formatDate(DEMO_TODAY);

interface State {
  role: Role;
  requests: BloodRequest[];
  /** One entry per (request, donor) the system notified. */
  donorRequests: DonorRequest[];
  /** Record changes applied after a confirmed acceptance. */
  donorAdjustments: Record<string, DonorAdjustment>;
  outreach: OutreachCampaign[];
  interBank: InterBankRequest[];
  donorAvailable: boolean;
}

type Action =
  | { type: 'selectRole'; role: Role }
  | { type: 'createRequest'; request: BloodRequest; notified: DonorRequest[] }
  | { type: 'respond'; requestId: string; donorId: string; accepted: boolean; reply: ConversationMessage }
  | { type: 'addMessage'; requestId: string; donorId: string; message: ConversationMessage }
  | { type: 'addOutreach'; campaign: OutreachCampaign }
  | { type: 'addInterBank'; request: InterBankRequest }
  | { type: 'setDonorAvailable'; available: boolean };

const initialState: State = {
  role: 'seeker',
  requests: seededRequests,
  donorRequests: [],
  donorAdjustments: {},
  outreach: [],
  interBank: [],
  donorAvailable: true,
};

/** Apply any recorded changes on top of a donor's base record. */
function withAdjustments(donor: Donor, adjustments: Record<string, DonorAdjustment>): Donor {
  const change = adjustments[donor.id];
  if (!change) return donor;
  return {
    ...donor,
    lastDonationDays: change.lastDonationDays,
    completedDonations: change.completedDonations,
    eligible: change.lastDonationDays >= MIN_DAYS_BETWEEN_DONATIONS,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'selectRole':
      return { ...state, role: action.role };

    case 'createRequest':
      return {
        ...state,
        requests: [action.request, ...state.requests],
        donorRequests: [...state.donorRequests, ...action.notified],
      };

    case 'respond': {
      const request = state.requests.find((entry) => entry.id === action.requestId);
      if (!request) return state;

      const alreadyAccepted = state.donorRequests.filter(
        (entry) => entry.requestId === action.requestId && entry.state === 'Accepted',
      ).length;

      // The first N to accept are confirmed. Later acceptances are stood down,
      // so no more blood is collected than the patient needs.
      const stillNeeded = alreadyAccepted < request.units;
      const nextState = !action.accepted
        ? ('Declined' as const)
        : stillNeeded
          ? ('Accepted' as const)
          : ('Stood Down' as const);

      const donorRequests = state.donorRequests.map((entry) =>
        entry.requestId === action.requestId && entry.donorId === action.donorId
          ? {
              ...entry,
              state: nextState,
              messages: nextState === 'Accepted' ? [action.reply] : entry.messages,
            }
          : entry,
      );

      // A confirmed acceptance consumes the donor's eligibility.
      const donorAdjustments = { ...state.donorAdjustments };
      if (nextState === 'Accepted') {
        const donor = baseDonors.find((entry) => entry.id === action.donorId);
        if (donor) {
          const current = donorAdjustments[donor.id];
          donorAdjustments[donor.id] = {
            lastDonationDays: 0,
            completedDonations: (current?.completedDonations ?? donor.completedDonations) + 1,
          };
        }
      }

      const acceptedNow = donorRequests.filter(
        (entry) => entry.requestId === action.requestId && entry.state === 'Accepted',
      ).length;

      return {
        ...state,
        donorRequests,
        donorAdjustments,
        requests: state.requests.map((entry) =>
          entry.id !== action.requestId
            ? entry
            : {
                ...entry,
                status: acceptedNow >= entry.units
                  ? 'Fulfilled'
                  : acceptedNow > 0
                    ? 'Donor Accepted'
                    : entry.status,
              },
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

const STORAGE_KEY = 'bloodgrid.session.v3';

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

function highestSequence(items: { id: string }[], floor: number): number {
  const numbers = items
    .map((item) => Number(item.id.split('-')[1]))
    .filter((value) => Number.isFinite(value));
  return numbers.length ? Math.max(floor, ...numbers) : floor;
}

/* ----------------------------------------------------------------- Context */

interface AppContextValue extends State {
  /** Donors with any post-acceptance record changes applied. */
  donors: Donor[];
  findDonor: (id: string) => Donor | undefined;

  selectRole: (role: Role) => void;
  createBloodRequest: (input: {
    bloodGroup: BloodGroup; urgency: Urgency; sector: string;
    units: number; facility: string; note?: string;
  }) => BloodRequest;
  respondToRequest: (requestId: string, donorId: string, accepted: boolean, donorName: string) => void;
  sendMessage: (requestId: string, donorId: string, from: 'seeker' | 'donor', text: string) => void;
  startOutreach: (input: Omit<OutreachCampaign, 'id' | 'createdLabel'>) => OutreachCampaign;
  requestFromPartnerBank: (input: Omit<InterBankRequest, 'id' | 'createdLabel'>) => InterBankRequest;
  setDonorAvailable: (available: boolean) => void;

  findRequest: (id: string) => BloodRequest | undefined;
  findDonorRequest: (requestId: string, donorId: string) => DonorRequest | undefined;
  donorRequestsFor: (requestId: string) => DonorRequest[];
  acceptedFor: (requestId: string) => DonorRequest[];
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

  const donors = useMemo(
    () => baseDonors.map((donor) => withAdjustments(donor, state.donorAdjustments)),
    [state.donorAdjustments],
  );

  const value = useMemo<AppContextValue>(() => ({
    ...state,
    donors,
    findDonor: (id) => donors.find((donor) => donor.id === id),

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
        status: 'Awaiting Response',
      };

      // The system selects and notifies. The seeker does not pick.
      const outcome = rankDonorsForRequest(donors, request);
      const notified: DonorRequest[] = outcome.results
        .slice(0, donorsToNotify(request.units, request.urgency))
        .map((result) => ({
          requestId: request.id,
          donorId: result.donor.id,
          state: 'Sent' as const,
          sentLabel: TODAY_LABEL,
          messages: [],
          rank: result.rank,
          score: result.score,
          tier: result.tier,
          objectives: result.objectives,
        }));

      dispatch({ type: 'createRequest', request, notified });
      return request;
    },

    respondToRequest: (requestId, donorId, accepted, donorName) => {
      messageSequence += 1;
      dispatch({
        type: 'respond',
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

    acceptedFor: (requestId) =>
      state.donorRequests.filter(
        (entry) => entry.requestId === requestId && entry.state === 'Accepted',
      ),

    donorInbox: () => state.donorRequests.filter((entry) => entry.donorId === DEMO_DONOR_ID),
  }), [state, donors]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
