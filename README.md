# BloodGrid

BloodGrid connects blood seekers, donors and blood banks. This branch holds the donor matching module
(CCP-1): given a blood request, it screens the donor pool and chooses which donors to notify.

The approved proof of concept is archived on the `Approved-POC` branch.

## What the module does

1. **Screens** the donor pool with hard rules: blood-group compatibility, availability and holds, the
   90-day donation interval, a 15 km service radius, and a cap of three contacts in 30 days.
2. **Sizes the contact set**: k = ceil(factor × units), with a factor of 1.3, 1.6 or 2.0 for routine,
   urgent and critical requests.
3. **Scores whole sets** on four objectives: travel burden, donor recovery, expected fulfilment and
   type-preservation cost.
4. **Chooses a set** by evaluating every k-subset, keeping the non-dominated ones, and picking one with a
   weighting that depends on urgency.
5. **Compares** the result with nearest-compatible, sequential greedy and weighted-sum selection.

All donor data is synthetic. NSGA-III (the planned optimiser for realistic pool sizes) is not part of this
module yet; the exact search is its verification baseline.

## Running it

```bash
npm install
cp .env.example .env.local   # optional: without it the app uses built-in synthetic data
npm run dev                  # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm test` | Unit and property tests (Vitest) |
| `npm run test:coverage` | Same, with a coverage threshold on the engine |
| `npm run e2e` | Browser test (Playwright), run against a production build |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript |
| `npm run build` | Typecheck and production build into `dist/` |
| `npm run seed:generate` | Rewrite `supabase/seed.sql` from the seeded generator |

## Layout

| Path | Contents |
| --- | --- |
| `src/engine/` | The matching engine: pure functions with no network or UI dependencies |
| `src/data/` | Repository layer (Supabase and an in-memory fallback), sectors, synthetic donor generator |
| `src/screens/`, `src/ui/` | Screens and shared components |
| `supabase/migrations/` | Schema, Row Level Security and the functions that write data |
| `supabase/seed.sql` | Synthetic donors and sectors |
| `tests/`, `e2e/` | Unit and property tests, browser test |

## Database

Supabase Postgres. The public key can only read. Every write goes through one of three functions:
`record_match` (saves a request and holds its donors atomically), `respond_to_request` and `reset_demo`.
Donors carry no name, phone or address. Authentication and per-role policies are planned for a later phase.

## Branches and CI

`main` is the real project, `Approved-POC` the archived prototype, `Donor-matching` the integration branch
for this module. Work goes on short feature branches and reaches `Donor-matching` by pull request. The CI
workflow runs lint, typecheck, tests with coverage and a production build, then a browser test. A push to
`main` publishes the build to GitHub Pages using the repository variables `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`.

## Authors

Abdullah Tariq, Malik Usman and Rizwan Saeed. Supervisor: Dr. Isma ul Hassan, FAST-NUCES.
