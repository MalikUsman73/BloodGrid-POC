# BloodGrid Proposal Defense POC Specification

## 1. Purpose

This POC demonstrates the feasibility of the BloodGrid application workflow.

It is a high-fidelity functional prototype, not the final MVP.

The POC tests the assumption that BloodGrid can provide a coherent user experience connecting:

- individual blood requests
- intelligent donor matching
- donor geographic visualization
- blood-bank demand intelligence
- proactive planning

---

# 2. POC Scope

## IN SCOPE

### Individual user workflow

- user login/demo selection
- donor profile
- blood seeker dashboard
- create blood request
- blood group
- urgency
- location
- required units
- ranked donor recommendations
- donor availability
- donor distance
- donor compatibility
- donor details
- map visualization
- request/contact action
- request status

### Blood-bank workflow

- blood-bank login/demo selection
- dashboard
- current inventory overview
- historical demand
- forecast chart
- high-demand indicator
- shortage-risk indicator
- recommended planning action
- donor outreach workflow
- inter-bank request workflow

### Shared

- navigation
- user roles
- notifications UI
- status indicators
- responsive UI
- unified design system

---

# 3. OUT OF SCOPE

Do NOT implement:

- production database
- real medical verification
- real donor notifications
- real SMS/email
- full NSGA-II
- production forecasting model
- real blood-bank API
- real inter-bank optimization
- autonomous medical decisions
- real patient records
- exact donor residential locations

---

# 4. CCP 1 POC

## Donor Matching

The prototype must demonstrate:

Input:

Blood request:

- blood group: O+
- urgency: Urgent
- location: Islamabad
- units: 2

Candidate donors:

At least 6–10 realistic mock donors.

Each donor should have:

- donor ID
- name
- blood group
- approximate location
- distance
- availability
- donation recency/status
- eligibility/status
- match indicators

The prototype matching engine may calculate a deterministic demonstration score.

Example conceptual factors:

- compatibility
- distance
- availability
- donor recency
- urgency

The UI must NOT call this score "NSGA-II result" unless actual NSGA-II is implemented.

Instead use:

"Prototype Match Score"

and optionally:

"Future: NSGA-II optimization"

The resulting donors should be ranked.

Example:

1. Donor A, Excellent match
2. Donor B, Excellent match
3. Donor C, Good match
4. Donor D, Good match
5. Donor E, Moderate match

The ranking should be internally consistent with the displayed information.

---

# 5. MAP

The map must show approximate donor locations.

Do NOT show exact residential addresses.

Use:

- generalized coordinates
- fictional/demo locations
- privacy-safe markers

The map should allow:

- zoom
- donor marker selection
- donor information
- distance display

If external map APIs introduce setup risk, use a local/static map-style visualization or a reliable lightweight map implementation that does not require an API key.

---

# 6. CCP 2 POC

## Demand Forecasting

Create a realistic demonstration dataset.

Example blood groups:

- A+
- B+
- O+
- AB+

Show historical demand over time.

The UI should contain:

- demand chart
- historical period
- forecast period
- forecast line
- high-demand indicator
- shortage-risk indicator

Do NOT display fake ML accuracy.

Label forecast output:

"Prototype forecast, simulated for proposal-stage demonstration"

The UI may show:

"Expected high demand"

rather than:

"Model is 94% accurate."

---

# 7. BLOOD BANK PLANNING

When a forecast indicates elevated demand:

Show an actionable planning insight.

Example:

"Expected O+ demand increase in the next forecast period."

Possible UI actions:

- Launch donor outreach
- Contact available donors
- Request coordination with another blood bank

These are workflow demonstrations, not autonomous decisions.

---

# 8. ONE INTEGRATED APPLICATION

The POC must visually communicate:

                   BLOODGRID

          ┌──────────┴──────────┐
          │                     │
    INDIVIDUAL USERS       BLOOD BANK
          │                     │
    Blood Request          Demand Data
          │                     │
          ▼                     ▼
    Matching Engine       Forecasting
          │                     │
          ▼                     ▼
   Ranked Donors          Planning Insight
          │
          ▼
       Map View

Both sides use the same BloodGrid platform.

---

# 9. POC EVIDENCE

The POC should establish:

### Risk tested

Can one application support both request-level donor coordination and blood-bank planning workflows?

### Input

- sample blood request
- sample donor pool
- sample demand data

### Result

- ranked donor candidates
- geographic visualization
- forecast visualization
- planning recommendation

### Learning

Determine whether the workflow is technically feasible and whether the proposed architecture is appropriate.

### Design consequence

The prototype should demonstrate:

- shared platform
- separate computational modules
- common backend/data layer in future implementation
- separate interfaces according to stakeholder role

---

# 10. DEMO SUCCESS CRITERIA

The prototype succeeds if:

- Blood seeker can create a request
- ranked donors appear
- map appears
- donor can be selected
- request action works
- blood bank dashboard loads
- demand chart loads
- forecast is visible
- high-demand/shortage signal is visible
- planning action is available
- no critical runtime errors occur
- demo can run offline or with minimal dependencies

---

# 11. DEMO DATA

All data is demonstration data.

Do not present it as real blood-bank data.

Do not imply actual patients or donors.

Use clearly fictional names.

Example:

Ahmed Khan
Ali Raza
Usman Malik
Hamza Shah
etc.

Use fictional demonstration records.

---

# 12. DEFENSE LANGUAGE

Correct:

"The POC uses simulated data and prototype computational outputs to validate the end-to-end workflow."

Correct:

"The full NSGA-II optimization and forecasting model are committed implementation components."

Incorrect:

"NSGA-II is already implemented."

Incorrect:

"Our forecasting model achieves 95% accuracy."

Incorrect:

"These are real donor records."

Incorrect:

"Our blood bank is already integrated."

---

# 13. DEMO LENGTH

Target:

5–8 minutes.

The entire demonstration must be repeatable.

Prefer deterministic outputs over randomness.
