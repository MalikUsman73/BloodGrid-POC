# Simulated and implemented

A precise account of what this proposal-stage prototype actually does, so nothing shown in the
defense can be mistaken for a result the project has not earned.

---

## 1. Genuinely implemented

These are real, working, and defensible as such.

| Capability | Where | Note |
|---|---|---|
| ABO and Rh compatibility screening | `engines/matching.ts`, `COMPATIBLE_DONOR_GROUPS` | A standard clinical lookup table. Correct, not simulated. |
| Donation-interval eligibility, 90 days | `engines/matching.ts`, `mock/donors.ts` | A real rule, applied as a hard filter. |
| Deterministic multi-criteria ranking | `engines/matching.ts`, `rankDonorsForRequest` | The arithmetic is real and stable. What it *is* is a weighted sum, see section 2. |
| Urgency-dependent weighting | `engines/matching.ts`, `CRITERION_WEIGHTS` | Genuinely reorders results across Routine, Urgent, and Critical. |
| Threshold rules for demand signals | `engines/forecast.ts` | Simple, explainable rules over the simulated series. |
| Request, acceptance, conversation states | `store/AppStore.tsx` | A real state machine. The conversation route is guarded on it. |
| Complete interface and navigation | `screens/`, `components/` | Fully working, including workspace switching. |
| Offline map interaction | `components/map/DonorMap.tsx` | Real pan, zoom, and selection. The base layer is schematic, see section 3. |
| Session persistence | `store/AppStore.tsx` | A `sessionStorage` mirror only. Not a database. |

---

## 2. Simulated for the proposal stage

### CCP 1, donor matching optimisation

**What it does.** Filters for compatibility and eligibility, normalises five criteria to the
range 0 to 1, and combines them with urgency-dependent weights into a single Prototype Match
Score.

**What it does not do.** Any multi-objective optimisation. There is no non-dominated sorting, no
crowding distance, no evolutionary search, no population, no generations, and no Pareto front.

**Why the five criteria are shown anyway.** They are the objectives the future NSGA-II
implementation will optimise over. Surfacing them explains the structure of the problem, and
makes visible why a single weighted ordering is inadequate, without claiming the optimiser
exists.

**Required wording, used on every screen showing the score:**

- Prototype Match Score, simulated matching output
- Future implementation: NSGA-II multi-objective optimisation

**Never claimed:** that NSGA-II is implemented, that it has been evaluated, or that any result is
Pareto-optimal or non-dominated.

### CCP 2, blood demand predictive analysis

**What it does.** Composes a deterministic signal from a baseline, a slow trend, a fixed weekly
pattern, the illustrative scenario factors, and seeded jitter, across 90 history days and 14
forward days. Two threshold rules follow:

- elevated demand when the projected peak reaches 118 percent of the 30-day trailing mean
- shortage risk when projected demand exceeds held stock plus expected routine collection

**What it does not do.** Any fitting, training, learning, validation, or evaluation. No model
exists. No accuracy, MAPE, RMSE, confidence level, or error metric is computed anywhere in the
codebase, and none is displayed.

**The band** on the chart is an illustrative range for legibility. It is not a fitted statistical
prediction interval and is captioned as such wherever it appears.

**Required wording:**

- Prototype forecast, simulated for proposal-stage demonstration
- Future implementation: trained forecasting model

### Scenario factors

"Simulated seasonal illness period", "simulated holiday travel period", and "simulated seasonal
illness resurgence" are illustrative simulated inputs used to shape the demonstration data so the
chart is legible. They are not real causal findings. No such relationship has been measured,
studied, or validated in this project, and no real-world data source was used. The screen states
this explicitly.

### All data

Donors, patients, requests, inventory, blood banks, partner facilities and their indicative
stock, and the entire demand series are fictional. No real donor, patient, or blood-bank data is
used. No blood bank is integrated with or partnered with this project, and no stakeholder
validation has taken place.

---

## 3. Deliberately not built

Out of scope per `docs/DEFENSE_SCOPE.md`: NSGA-II, a trained forecasting model, production
authentication, a production backend, a database, real notifications by SMS, email, or push,
real messaging delivery, real medical verification, real blood-bank integration, deployment,
cloud infrastructure, payments, real map integration, and complex optimisation of any kind.

Excluded by the scope lock and absent from the codebase: GNN, disaster or mass-casualty
simulation, inter-bank redistribution optimisation, transportation or routing optimisation, any
third computational component, and any additional AI engine.

**Inter-bank coordination** appears as an ordinary application workflow. It raises a request and
records it in session state. It performs no optimisation and is not a computational component.
The screen carries a note saying so.

**The conversation** is a prototype. Messages are held in the browser session and delivered
nowhere. There is no messaging backend, and the screen says so.

---

## 4. Language to use, and to avoid

**Correct**

- "The POC uses simulated data and prototype computational outputs to validate the end-to-end
  workflow."
- "The full NSGA-II optimisation and the forecasting model are committed implementation
  components."
- "The prototype ranking is a weighted baseline that the NSGA-II implementation will be evaluated
  against."
- "Expected high demand in the next forecast period."
- "Contact happens inside BloodGrid once the donor accepts."

**Incorrect, do not say**

- "NSGA-II is already implemented." or "These are Pareto-optimal donors."
- "Our forecasting model achieves n percent accuracy", or any accuracy, MAPE, RMSE, or confidence
  figure.
- "These are real donor records." or "Our blood bank is already integrated."
- "We validated this with stakeholders."
- "Dengue season causes an O+ spike", stated as a finding rather than as an illustrative
  simulated factor.
- "The seeker can call the donor." Contact details are never shown, and there is no calling
  feature.

---

## 5. How this is enforced in the code

- `src/components/PrototypeLabels.tsx` is the single source of the prototype-status wording.
  Every screen showing a computational output uses `PrototypeNote` or `SimulatedMark`.
- Both engine files open with a header stating plainly what they are not.
- A prototype notice appears on every screen of the application.
- The `Donor` type has no phone field and no address field, so neither can be rendered by
  mistake.
- The conversation route checks the request state before rendering, so contact cannot be reached
  before a donor accepts.
- The automated verification asserts the absence of "NSGA-II result", "Pareto", "non-dominated",
  any accuracy or error-metric text, and any phone or call text on the donor screen.
