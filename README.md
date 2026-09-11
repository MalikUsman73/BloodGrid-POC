# BloodGrid, proposal defense proof of concept

A functional prototype of BloodGrid, built for the FYP proposal defense. It demonstrates the
complete user-facing workflow of one integrated application serving two user groups, and
establishes that the overall application flow is feasible.

> **Prototype status.** All data in this build is simulated demonstration data, and both
> computational outputs are simulated. Multi-objective optimisation and the demand forecasting
> model are committed implementation components, not part of this prototype. No real donor, patient, or
> blood-bank data is used anywhere.

---

## 1. Setup and run

Requires Node.js 18 or newer (developed on Node 22.20). Dependencies are already installed in
`node_modules/`, so step 1 is only needed on a fresh machine.

```bash
npm install      # only if node_modules is missing. Needs internet, so do it in advance.
npm run build    # produce the static bundle
npm run preview  # serve it at http://localhost:4173   <-- use this for the defense
```

While editing:

```bash
npm run dev        # http://localhost:5173, with hot reload
npm run typecheck  # tsc --noEmit
```

**Run the defense from `npm run preview`, not `npm run dev`.** The preview server serves the
prebuilt bundle: no compiler in the loop, no hot-reload machinery, nothing to wedge mid-demo.

**The application runs fully offline.** Verified with all non-localhost requests blocked: every
route renders, zero external requests are attempted, and no errors occur. No API key, no external
database, no cloud service, and no internet connection is needed at any point.

Open the app through `http://localhost:4173` rather than by opening `dist/index.html` directly.
Client-side routing needs a server to serve `index.html` for deep links.

---

## 2. Demo accounts

There is no authentication, by design: production authentication is out of scope at the proposal
stage. From the landing page, choose **Enter the prototype**, then pick a workspace.

| Workspace | Persona | What it demonstrates |
|---|---|---|
| Blood seeker | Attendant, Sector G-8 | CCP 1, donor matching optimisation |
| Blood bank administrator | Central Regional Blood Centre | CCP 2, blood demand predictive analysis |
| Donor | Registered donor, Sector G-9 | Supporting workflow that closes the request loop |

All three are views of one application. The workspace switcher in the header moves between them
with no reload and no sign-out, which is the visible proof of one platform serving two user
groups.

---

## 3. Prototype workflows

**Blood seeker (CCP 1)**

1. Blood requests overview, then **Create blood request** (group, units, urgency, sector)
2. Selection step, with the screening rules shown as they run
3. **Request status**: the donors BloodGrid selected and notified, shown anonymously with their
   criteria bars and map positions. The seeker does not choose; the system does.
4. When a donor accepts, that donor is revealed by name and a conversation opens
5. My requests, with live status per request

**Donor**

1. Overview: donor record and an availability switch
2. Requests: accept or decline a request BloodGrid selected you for
3. Accepting opens the conversation for both sides and updates your donation record

**Blood bank (CCP 2)**

1. Inventory: stock by group, days of cover, and a headline warning if a shortfall is projected
2. **Demand and forecast**: recorded history, prototype forecast, and the signals derived from them
3. **Planning**: the recommended action, the reason, and the workflows that follow from it
4. Donor outreach: build a campaign audience from the eligible, compatible pool
5. Inter-bank coordination: request units from a partner facility

---

## 4. Selection and communication model

The system selects and notifies. The seeker never browses or picks donors, and never sees who a
donor is until that donor has agreed to help.

```
Seeker submits a request for N units
  -> matching engine ranks contactable donors
  -> system selects the top K and notifies all of them
  -> seeker sees them anonymised: group, sector, distance, criteria. No names.
  -> a donor accepts
  -> that donor is revealed by name, a conversation opens, the seeker is told
  -> the donor's record is updated, so they leave the pool for 90 days
```

**How many donors are notified.** K = ceil(factor x N), where the factor rises with urgency,
because more donors decline than accept and a critical request cannot wait for a second round:

| Urgency | Factor | 1 unit | 2 units | 3 units |
|---|---|---|---|---|
| Routine | 1.3 | 2 | 3 | 4 |
| Urgent | 1.6 | 2 | 4 | 5 |
| Critical | 2.0 | 2 | 4 | 6 |

**If more donors accept than are needed**, the first N are confirmed and the rest are stood
down with a note of thanks. A stood-down donor's eligibility is not consumed, so they remain
available for future requests.

**Privacy.** Donor identity is withheld until acceptance, and personal contact details are never
shown at all: the prototype holds no phone numbers and no addresses, so it cannot leak either.
The conversation route is guarded on the request state, so it cannot be reached before a donor
accepts, even by typing the URL. Messages live in the browser session and are not delivered
anywhere; there is no messaging backend at the proposal stage, and the screen says so.

---

## 5. Demonstration data

All data is deterministic. A fixed-seed generator (`src/mock/seed.ts`) means every chart, score,
and ranking is identical on every run, on every machine, in every rehearsal, so the live
demonstration is exactly repeatable.

| File | Contents |
|---|---|
| `src/mock/donors.ts` | 14 fictional donors. Sector-level locations only. `distanceKm` is derived from map coordinates, so the list and the map can never disagree. Availability is a binary flag. |
| `src/mock/banks.ts` | One own facility and three fictional partners; inventory for eight groups with use and collection rates. |
| `src/mock/demand.ts` | Baselines, trends, weekly patterns, and the illustrative scenario factors. |
| `src/mock/requests.ts` | Two seeded requests, so the seeker screens are never empty on a first visit. |
| `src/mock/seed.ts` | The fixed-seed generator. |

**Data hygiene.** Names are clearly fictional. Patients appear as case references only. Donors
have no phone number and no address field in the type system, so neither can be displayed.
Locations are sector centroids in a fictional coordinate space, never real coordinates.

Inventory `dailyUse` for the four forecast groups equals the 30-day trailing mean of that group's
demand series, so the inventory table and the forecast screen agree.

---

## 6. Architecture

```
Vite 5 + React 18 + TypeScript + Tailwind + React Router
                      |
       In-memory store (Context and useReducer),
       mirrored to sessionStorage so a stray refresh
       during the defense does not lose a request
                      |
   engines/matching.ts        engines/forecast.ts
   (simulated, CCP 1)         (simulated, CCP 2)
                      |
             mock/*.ts (deterministic, typed)
```

```
src/
  lib/        status tones and formatting, shared by every screen
  types/      domain types. No phone or address field exists, by design.
  mock/       deterministic demonstration data
  engines/    the two simulated computational components
  components/ ui.tsx primitives, PrototypeLabels, CriteriaBars, map, chart
  screens/    seeker, donor, bank, plus the shared Conversation screen
```

No backend, no database, no network calls at runtime. Both engines are pure synchronous
functions; the matching screen's stepped progression is presentation only.

Every screen that renders a computational output uses `PrototypeNote` or `SimulatedMark` from
`src/components/PrototypeLabels.tsx`, which is the single source of the prototype-status wording.

---

## 7. What is simulated and what is not

See [docs/SIMULATED_VS_IMPLEMENTED.md](docs/SIMULATED_VS_IMPLEMENTED.md) for the full account,
and two method reviews written for the implementation phase, neither of which changes the
prototype: [docs/CCP1_ALGORITHM_REVIEW.md](docs/CCP1_ALGORITHM_REVIEW.md) on whether NSGA-II is
the right method for CCP1, and
[docs/CCP2_FORECASTING_REVIEW.md](docs/CCP2_FORECASTING_REVIEW.md) on training a demand
forecasting model once real blood-bank data is obtained.

In short:

**Genuinely implemented**

- ABO and Rh compatibility screening, using a standard clinical lookup table
- The 90-day donation-interval eligibility rule
- Availability as a binary feasibility constraint, applied before any scoring
- Deterministic multi-criteria ranking with urgency-dependent weights
- The complete interface, navigation, workspace switching, and every workflow above
- The request, notification, acceptance, stand-down and conversation state machine
- Donor records updating on a confirmed acceptance, removing them from the pool
- The offline map: pan, zoom, marker selection, distance rings

**Simulated for the proposal stage**

- The Prototype Match Score, a weighted ranking, not an optimiser result
- The prototype forecast, a composed deterministic signal, not a trained model
- All donor, patient, inventory, blood-bank, and demand data

**Deliberately not built**, per `docs/DEFENSE_SCOPE.md`: any optimiser, any trained forecasting model,
production authentication, a backend, a database, real notifications, real messaging delivery,
real blood-bank integration, and deployment.

---

## 8. Known limitations

1. **State lasts for the browser tab.** It is mirrored to `sessionStorage`, so a refresh is safe,
   but closing the tab resets to the seeded data. That is intended for a repeatable demo.
2. **The map is a schematic.** A stylised sector grid in a fictional coordinate space, chosen so
   the demo never depends on tile servers or API keys. Real map integration is future work.
3. **The match score is not an optimiser.** It is a weighted sum producing one ranking, where the
   multi-objective formulation produces a set of trade-off solutions. See
   `docs/CCP1_ALGORITHM_REVIEW.md` for why the method choice is still open.
4. **The forecast is not fitted.** It carries no accuracy, error, or confidence measure, and none
   is displayed. The band on the chart is illustrative, not a prediction interval.
5. **Scenario factors are illustrative.** Seasonal illness and holiday travel shape the
   demonstration data. They are not measured or validated causal findings.
6. **The conversation has no backend.** Messages are session-local and are not delivered.
7. **The donor pool is 14 records.** Enough to demonstrate screening and ranking, not enough to
   say anything about behaviour at scale.
8. **One bundle, around 740 kB (210 kB gzipped),** mostly the charting library. Fine locally;
   code splitting is a post-proposal concern.

---

## 9. Verification performed

An automated walkthrough drives both defense flows in a real browser (Chromium via Puppeteer),
asserting **46 checks, all passing, with zero console errors**:

- Every screen in both flows reachable and rendering
- Workspace switching in both directions, and the return to the seeker workspace
- Every button used during the demonstration
- Ranked donors render with criteria bars; the map renders its markers
- The chart renders at full height at 1440 px and 1024 px
- No horizontal overflow at 1024 px or 390 px
- A created request survives a page refresh
- **Communication model:** no phone or call text on the donor screen; the conversation route is
  blocked before acceptance; it opens after acceptance; messages sync across both sides
- **Duplication:** the planning screen carries no chart and no repeated figure row
- **Claim checks:** no "Pareto", no "non-dominated", no accuracy, MAPE, RMSE, or confidence text
- **Offline:** all routes render with every non-localhost request blocked, zero attempted

`npm run build` and `npm run typecheck` both pass clean, including with `--noUnusedLocals` and
`--noUnusedParameters`.

---

## 10. Recommended next steps after the defense

1. **Data acquisition.** A real demand dataset and a donor-registry schema. This gates both
   computational components.
2. **Data model and backend.** A persistent schema, an API layer, and real authentication.
3. **Multi-objective optimisation.** Formalise the five objectives already surfaced in the
   interface, then select and implement a method (exact solving or NSGA-III) and evaluate it
   against the weighted-sum baseline this prototype provides. See
   `docs/CCP1_ALGORITHM_REVIEW.md`.
4. **Forecasting model.** Select and train an approach on real data, then evaluate honestly on a
   held-out set and report real error metrics, which this prototype deliberately does not claim.
5. **Messaging.** Real in-application messaging and notification delivery.
6. **Real map integration,** preserving the sector-level privacy property established here.
7. **Security and privacy review.** Donor consent, contact policy, and data retention.
8. **User testing** with blood seekers, donors, and a blood-bank administrator.
9. **Deployment.**

The weighted-sum ranking is worth keeping: it becomes the baseline the chosen optimiser must be
shown to beat.
