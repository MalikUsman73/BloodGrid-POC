# BloodGrid — Proposal Defense Proof of Concept

A high-fidelity functional prototype of BloodGrid, built for the FYP **proposal defense**.
It demonstrates the complete user-facing workflow of one integrated application serving two
user groups, and establishes feasibility of the overall application flow.

> **Prototype status.** All data in this build is simulated demonstration data, and both
> computational outputs are simulated. NSGA-II optimisation and the demand forecasting model
> are *committed implementation components*, not part of this prototype. No real donor,
> patient, or blood-bank data is used anywhere.

---

## 1. Setup and run

Requires Node.js 18+ (developed on Node 22.20.0). Dependencies are already installed in
`node_modules/`; step 1 is only needed on a fresh machine.

```bash
npm install          # only if node_modules/ is missing — needs internet, do this in advance
npm run build        # produce the static bundle
npm run preview      # serve it at http://localhost:4173   <-- USE THIS FOR THE DEFENSE
```

For editing during development:

```bash
npm run dev          # http://localhost:5173, with hot reload
npm run typecheck    # tsc --noEmit
```

**Run the defense from `npm run preview`, not `npm run dev`.** The preview server serves the
prebuilt static bundle: no compiler in the loop, no hot-reload machinery, nothing to wedge
mid-demo.

**The application runs fully offline.** Verified with all non-localhost requests blocked: every
route renders, zero external requests are attempted, zero errors occur. No API key, no external
database, no cloud service, no internet connection is required at any point.

> Open the app through `http://localhost:4173`, not by double-clicking `dist/index.html` —
> client-side routing needs a server to serve `index.html` for deep links.

---

## 2. Demo accounts

There is **no authentication**, by design — production authentication is on the out-of-scope
list for the proposal stage. From the landing page, click **Enter Demo**, then pick a role:

| Role | Persona | What it demonstrates |
|---|---|---|
| **Blood Seeker** | Attendant, Islamabad G-8 | CCP 1 — donor matching optimisation |
| **Blood Bank Administrator** | Central Regional Blood Centre | CCP 2 — demand predictive analysis |
| **Donor** | Registered donor, Islamabad G-9 | Supporting workflow (Tier 2), closes the loop |

All three are views of **one application**. The role switcher in the top bar moves between them
with no reload and no sign-out — this is the visual proof of "one platform, two user groups".

---

## 3. Prototype workflows

**Individual — blood seeker (CCP 1)**
1. Seeker dashboard → **Create Blood Request** (blood group, urgency, location, units)
2. Matching processing state — screening stages shown explicitly
3. **Ranked donor recommendations** with per-criterion breakdown and offline map
4. Donor detail — distance, availability, recency, eligibility, criteria breakdown
5. **Send blood request** → confirmation with request timeline
6. My Requests — all requests with status

**Blood bank (CCP 2)**
1. Dashboard — inventory by group, stock levels, days of cover, headline shortage signal
2. **Demand & Forecast** — 90 days recorded + 14-day prototype forecast, per blood group
3. High-demand signal and shortage-risk signal, with the numbers behind each
4. **Planning recommendations** derived from those signals
5. Donor outreach campaign composer *(Tier 2)*
6. Inter-bank coordination request *(Tier 2)*

**Donor *(Tier 2)*** — availability toggle; incoming requests; accept/decline. A request sent
from the seeker workspace appears here, closing the loop inside one application.

---

## 4. Mock data

All demonstration data is deterministic. A fixed-seed PRNG (`src/mock/seed.ts`) means every
chart, score, and ranking is identical on every run, on every machine, in every rehearsal — so
the live demonstration is exactly repeatable.

| File | Contents |
|---|---|
| `src/mock/donors.ts` | 14 fictional donors. Sector-level locations only; `distanceKm` is derived from map coordinates so the list and map always agree. |
| `src/mock/banks.ts` | 1 own + 3 fictional partner facilities; inventory for 8 blood groups with use and collection rates. |
| `src/mock/demand.ts` | Baselines, trends, weekly patterns, and illustrative scenario factors for the demand series. |
| `src/mock/requests.ts` | 2 seeded requests so dashboards are never empty on first paint. |
| `src/mock/seed.ts` | The fixed-seed PRNG. |

**Data hygiene:** names are clearly fictional; patients appear only as case numbers; donor phone
numbers are masked (`+92 3•• ••• 4417`); donor locations are sector centroids in a fictional map
space, never addresses or real coordinates.

Inventory `dailyUse` for the four forecast groups equals the 30-day trailing mean of that
group's demand series, so the inventory table, dashboard, and forecast screen all agree.

---

## 5. What is simulated vs implemented

See **[docs/SIMULATED_VS_IMPLEMENTED.md](docs/SIMULATED_VS_IMPLEMENTED.md)** for the full
breakdown. In short:

**Genuinely implemented and correct**
- ABO/Rh compatibility screening (a real clinical lookup table)
- 90-day donation-interval eligibility rule
- Deterministic multi-criteria ranking with urgency-dependent weights
- The complete UI, navigation, role switching, and every workflow above
- The offline SVG map: pan, zoom, marker selection, distance rings

**Simulated for the proposal stage**
- The **Prototype Match Score** — a weighted score, *not* NSGA-II
- The **Prototype Forecast** — a composed deterministic signal, *not* a trained model
- All donor, patient, inventory, blood-bank, and demand data

**Deliberately not built** (out of scope per `docs/DEFENSE_SCOPE.md`)
- NSGA-II, any trained forecasting model, production authentication, backend, database,
  real notifications, real blood-bank integration, deployment

---

## 6. Architecture

```
Vite 5 + React 18 + TypeScript + Tailwind + React Router
                      │
          In-memory store (React Context + useReducer)
          mirrored to sessionStorage so a stray refresh
          during the defense does not lose a request
                      │
   engines/matching.ts          engines/forecast.ts
   [SIMULATED — CCP 1]          [SIMULATED — CCP 2]
                      │
                 mock/*.ts  (deterministic, typed)
```

No backend, no database, no network calls at runtime. Both engines are pure synchronous
functions; the matching screen's staged progression is a presentation device, not a real wait.

Every screen rendering a computational output mounts `SimulatedNotice` or `SimulatedTag` from
`src/components/SimulatedBadge.tsx`, which is the single source of the prototype-status wording.

---

## 7. Known limitations

1. **No persistence beyond the browser tab.** State lives in memory, mirrored to
   `sessionStorage`. Closing the tab resets to seeded demonstration data — intended for a
   repeatable demo.
2. **The map is a schematic, not a geographic rendering.** It is a stylised sector grid in a
   fictional coordinate space, chosen so the demo never depends on tile servers or API keys.
   Real map integration is item 6 on the future-implementation list.
3. **The match score is not an optimiser.** It is a weighted sum. It produces a single ranking,
   whereas the multi-objective formulation NSGA-II will address produces a set of trade-off
   solutions.
4. **The forecast is not fitted.** It carries no accuracy, error, or confidence measure, and
   none is displayed. The shaded band is illustrative, not a prediction interval.
5. **Scenario factors are illustrative.** Seasonal illness, holiday travel, and similar labels
   shape the demonstration data. They are not measured or validated causal findings.
6. **The donor pool is 14 records.** Enough to demonstrate screening and ranking; not enough to
   say anything about behaviour at scale.
7. **No authentication, no notifications, no messaging.** Sending a request records it in
   session state; nothing is transmitted.
8. **Single bundle, ~743 kB (210 kB gzipped),** mostly Recharts. Fine locally; code-splitting is
   a post-proposal concern.

---

## 8. Verification performed

Automated walkthrough of the full 17-step defense narrative in a real browser (Chromium via
Puppeteer), asserting **47 checks — all passing, zero console errors**:

- Every screen in both Tier-1 flows reachable and rendering
- Role switching in both directions; return to the unified application
- Every button used during the demo actually works
- Ranked donors render with criteria bars; map renders 56 SVG markers
- Chart renders at full height at 1440px and 1024px (no `ResponsiveContainer` collapse)
- No horizontal overflow at 1024px or 390px
- A created request survives a page refresh
- The seeker→donor loop closes end to end
- **Claim checks:** no "NSGA-II result", no "Pareto", no accuracy/MAPE/RMSE/confidence text
- **Offline check:** all 12 routes render with every non-localhost request blocked;
  0 external requests attempted, 0 errors

`npm run build` and `npm run typecheck` both pass clean.

---

## 9. Recommended next steps after proposal defense

1. **Data acquisition** — secure a real demand dataset and a donor-registry schema; this gates
   both computational components.
2. **Data model and backend** — a persistent schema, an API layer, and real authentication.
3. **NSGA-II implementation** — formalise the five objectives already surfaced in the UI, then
   implement genuine multi-objective optimisation and evaluate it (hypervolume, spread,
   comparison against the weighted-sum baseline this prototype provides).
4. **Forecasting model** — select and train an approach on real data; evaluate honestly with a
   held-out set and report real error metrics, which this prototype deliberately does not claim.
5. **Real map integration** — replace the schematic map, preserving the sector-level privacy
   property this prototype establishes.
6. **Notifications** — real SMS/push delivery for donor contact and outreach.
7. **Security and privacy review** — donor consent, contact masking, data-retention policy.
8. **User testing** with blood seekers and a blood-bank administrator.
9. **Deployment.**

The prototype's weighted-sum ranking is a useful artefact to keep: it becomes the baseline that
the NSGA-II implementation must be shown to beat.
