# Simulated vs Implemented

A precise account of what this proposal-stage prototype actually does, so that nothing shown in
the defense can be mistaken for a result the project has not earned.

---

## 1. Genuinely implemented and correct

These are real, working, and defensible as such.

| Capability | Where | Note |
|---|---|---|
| ABO/Rh red-cell compatibility screening | `engines/matching.ts` → `COMPATIBILITY` | A standard clinical lookup table. Correct, not simulated. |
| Donation-interval eligibility (90 days) | `engines/matching.ts`, `mock/donors.ts` | A real rule, applied as a hard filter. |
| Deterministic multi-criteria ranking | `engines/matching.ts` → `runMatching` | The arithmetic is real and stable; what it *is* is a weighted sum (see §2). |
| Urgency-dependent criterion weighting | `engines/matching.ts` → `WEIGHTS` | Genuinely reorders results across Routine / Urgent / Critical. |
| Threshold rules for demand signals | `engines/forecast.ts` | Simple, explainable rules over the simulated series. |
| Complete UI, navigation, role switching | `screens/`, `components/layout/` | Fully working. |
| Offline SVG map: pan, zoom, selection, rings | `components/map/DonorMap.tsx` | Real interaction; the *base layer* is schematic (see §3). |
| Request → contact → donor-response loop | `store/AppStore.tsx` | Works end to end within a browser session. |
| Session persistence across refresh | `store/AppStore.tsx` | `sessionStorage` mirror only — not a database. |

---

## 2. Simulated for the proposal stage

### CCP 1 — Donor Matching Optimization

**What the prototype does:** filters for compatibility and eligibility, normalises five criteria
to [0,1], and combines them with urgency-dependent weights into a single **Prototype Match
Score**.

**What it does *not* do:** any multi-objective optimisation. There is no non-dominated sorting,
no crowding distance, no evolutionary search, no population, no generations, and **no Pareto
front is computed**.

**Why the five criteria are shown anyway:** they are the objectives the future NSGA-II
implementation is intended to optimise over. Surfacing them communicates the structure of the
optimisation problem — and makes visible why a single weighted ordering is inadequate — without
claiming the optimiser exists.

**Required labelling, enforced on every screen that shows the score:**
- `Prototype Match Score — Simulated Matching Output`
- `Future Implementation: NSGA-II Multi-Objective Optimization`

**Never claimed:** that NSGA-II is implemented, that it has been evaluated, that any result is
Pareto-optimal or non-dominated.

### CCP 2 — Blood Demand Predictive Analysis

**What the prototype does:** composes a deterministic signal — baseline + trend + fixed weekly
pattern + illustrative scenario factors + seeded jitter — across 90 history days and 14 forward
days, then applies two threshold rules:
- *high demand* when projected peak ≥ 118% of the 30-day trailing mean
- *shortage risk* when projected demand exceeds held stock + expected routine collection

**What it does *not* do:** any fitting, training, learning, validation, or evaluation. No model
exists. **No accuracy, MAPE, RMSE, confidence level, or error metric is computed anywhere in the
codebase, and none is displayed.**

**The shaded band** is an illustrative range for visual legibility. It is **not** a fitted
statistical prediction interval and is captioned as such wherever it appears.

**Required labelling:**
- `Prototype Forecast — Simulated for Proposal-Stage Demonstration`
- `Future Implementation: Trained Forecasting Model`

### Scenario factors

The labels *seasonal illness period*, *public-holiday travel period*, and *seasonal illness
resurgence* are **illustrative simulated scenario inputs** used to shape the demonstration data
so the chart is legible. They are **not** real causal findings. No such relationship has been
measured, studied, or validated in this project, and no real-world data source was used. The
screen states this explicitly.

### All data

Donors, patients, requests, inventory, blood banks, partner facilities and indicative stock,
and the entire demand series are **fictional demonstration data**. No real donor, patient, or
blood-bank data is used. No blood bank is integrated with or partnered with this project. No
stakeholder validation has taken place.

---

## 3. Deliberately not built

Out of scope for the proposal stage per `docs/DEFENSE_SCOPE.md`:

NSGA-II · trained forecasting model · production authentication · production backend ·
database · real notifications (SMS / email / push) · real medical verification · real
blood-bank integration · deployment · cloud infrastructure · payments · real map integration ·
complex optimisation of any kind.

**Excluded by scope lock and absent from the codebase:** GNN, disaster or mass-casualty
simulation, inter-bank redistribution optimisation, transportation or routing optimisation, any
third computational component, any additional AI engine.

**Inter-bank coordination** appears as an ordinary application workflow. It raises a request and
records it in session state. It performs no optimisation and is **not** a computational
component. The screen carries a scope note saying so.

---

## 4. Language to use — and to avoid

**Correct**

- "The POC uses simulated data and prototype computational outputs to validate the end-to-end
  workflow."
- "The full NSGA-II optimisation and the forecasting model are committed implementation
  components."
- "The prototype ranking is a weighted baseline that the NSGA-II implementation will be
  evaluated against."
- "Expected high demand in the next forecast period."

**Incorrect — do not say**

- "NSGA-II is already implemented." / "These are Pareto-optimal donors."
- "Our forecasting model achieves *n*% accuracy." / any accuracy, MAPE, RMSE or confidence figure
- "These are real donor records." / "Our blood bank is already integrated."
- "We validated this with stakeholders." / "Dengue season causes an O+ spike" *(stated as
  finding rather than as an illustrative simulated factor)*

---

## 5. How this is enforced in the code

- `src/components/SimulatedBadge.tsx` is the single source of the prototype-status wording.
  Every screen rendering a computational output mounts `SimulatedNotice` or `SimulatedTag`.
- Both engine files open with a header block stating in capitals what they are not.
- A persistent amber banner appears on every screen of the application.
- The automated verification run asserts the absence of the phrases "NSGA-II result", "Pareto",
  and any accuracy/MAPE/RMSE/confidence text across the rendered screens.
