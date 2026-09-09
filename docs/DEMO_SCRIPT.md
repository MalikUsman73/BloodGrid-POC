# BloodGrid — Defense Demonstration Script

**Target length: 6–8 minutes.** Deterministic data — every rehearsal is identical to the
performance.

**Before you start**
- `npm run preview` running, browser open at `http://localhost:4173`
- Browser at 100% zoom, window maximised
- One tab only. Close dev tools.
- If you have rehearsed and want a clean slate: close the tab and open a fresh one
  (session state resets to the seeded demonstration data).

---

## 0 · Opening frame (30 s) — Landing page

> "BloodGrid is one integrated application serving two user groups: individuals who need or
> donate blood, and blood-bank administrators. It contains two core computational problems —
> donor matching optimisation, and blood demand predictive analysis."

Point at the framing diagram on the landing page — it shows both branches under one application.

> "Everything you are about to see is a proposal-stage prototype. The data is simulated and both
> computational outputs are simulated. I'll be explicit about that at each point."

*(The amber banner says exactly this. Let the panel read it — it earns credibility for
everything that follows.)*

**Click → Start the demonstration**

---

## 1 · Role selection (20 s)

> "Three roles, one application. Blood seeker and blood bank are the two core demonstrations;
> the donor role is a supporting workflow."

**Click → Enter as Blood Seeker**

---

## 2 · Create a blood request (45 s) — CCP 1 input

> "A patient attendant raises a request: blood group, units, urgency, and location."

The form is pre-filled with **O+, 2 units, Urgent, Sector G-8**.

Point at the summary panel on the right:

> "It's already telling us this request accepts O+ and O−, and that 10 donors in the pool are
> eligible. Note the location is a *sector*, not an address — that's deliberate and it holds all
> the way through."

**Optional, if you want to show the urgency mechanic:** tap **Critical** then back to **Urgent**,
and mention the hint text changes — urgency changes how the criteria are weighted.

**Click → Find Matching Donors**

---

## 3 · Matching (15 s) — let it run

> "The screening is explicit: compatibility, then the donation-interval eligibility rule, then
> evaluation against the remaining criteria."

*(~1.5 s. Don't talk over the end of it — the ranked screen is the moment.)*

---

## 4 · Ranked donor recommendations (90 s) — **the centrepiece**

Let the screen land before speaking.

> "Fourteen donors screened. Three removed for incompatible blood group, one because they
> donated recently. Ten ranked."

Point at the four screening tiles, then at the ranked list.

> "Each donor carries a **Prototype Match Score** and, underneath, the five criteria the ranking
> balances: compatibility, proximity, availability, donation recency, and reliability."

**Now the honest framing — say this clearly:**

> "This score is *simulated output*. It is a deterministic weighted ranking, not an optimiser.
> What it is doing is showing you the shape of the problem: five competing objectives, no single
> ordering that is best for every request. That is precisely why the committed implementation
> uses **NSGA-II multi-objective optimisation**. The banner on this screen says exactly that."

*(Point at the amber notice: "Prototype Match Score — Simulated Matching Output / Future
Implementation: NSGA-II Multi-Objective Optimization".)*

**A strong optional beat — the trade-off is real, not decorative:**

> "Notice Ali Raza is the closest donor at 1.4 km but ranks second, because Ahmed Khan scores
> higher on recency and reliability. If this were a *Critical* request, proximity would weigh
> more and Ali Raza would rank first. That reordering is the multi-objective problem in
> miniature."

**The map:**

> "Donors are plotted at sector level with 5 and 10 km reference rings from the request. The
> caption is important: exact donor addresses are never stored or displayed — the prototype
> holds no addresses at all, so it couldn't show one. This is an offline schematic map; real map
> integration is scheduled for the implementation phase."

Hover one or two pins to show the list and map highlight together. Zoom in once with **+**,
then **⌖** to reset.

**Click → View donor details**

---

## 5 · Donor detail and contact (45 s)

> "Full criteria breakdown for this donor, distance, availability, eligibility. Contact number
> is masked."

**Click → Send Blood Request**

> "Request sent, with a status timeline. Nothing was actually transmitted — this prototype sends
> no SMS, email, or notification. That's on the implementation list."

---

## 6 · Role switch (20 s) — **the "one application" beat**

Point at the top-bar switcher before clicking.

> "Now the same application, second user group. No sign-out, no second app — same platform,
> same identity, different workspace."

**Click → Blood Bank** (in the top bar)

---

## 7 · Blood bank dashboard (45 s)

> "The administrator sees the current inventory position — units held, days of cover, and stock
> status per group."

Point at the red banner at the top:

> "And immediately, the headline signal from the second computational component: a projected O+
> shortfall."

**Click → Demand & Forecast**

---

## 8 · Demand and forecast (90 s) — CCP 2 centrepiece

> "Ninety days of recorded demand, then a fourteen-day forward window. The solid line is
> history; the dashed line past the 'Today' divider is the prototype forecast."

Point at the four stat tiles:

> "Thirty-day average is 16.9 units a day. The forward window peaks at 26.4 around the 18th.
> Total projected demand is 271 units against 231 units of cover — held stock plus expected
> routine collection. That's an indicative shortfall of 40 units."

**The honest framing — say this clearly:**

> "This forecast is *simulated*. There is no trained model behind it, and you'll notice I'm
> quoting no accuracy figure, no error metric, and no confidence level — because none exists and
> none is displayed. The shaded band is an illustrative range, not a prediction interval. The
> trained forecasting model is a committed implementation component."

Scroll to the scenario factors:

> "These scenario factors — a seasonal illness period, a holiday travel window — shape the
> demonstration data so the chart is legible. They are illustrative simulated inputs, not causal
> findings. We have not measured or validated any such relationship."

**Optional:** click **A+** to show the signals differ per group — A+ is elevated but not at
shortage risk. It shows the rules discriminate rather than flagging everything.

**Click → Review planning recommendations**

---

## 9 · Planning recommendation (45 s)

> "The signals turn into planning actions: launch donor outreach, contact available donors, or
> raise a coordination request with a partner facility."

**Important scope point — say it before the panel asks:**

> "Inter-bank coordination is an ordinary application workflow. It performs no optimisation —
> no redistribution, no routing, no allocation solver. It is *not* a third computational
> component. BloodGrid has exactly two: donor matching and demand prediction."

*(The scope note is printed on the coordination screen if they want to see it in writing.)*

**Optional if time allows (30 s):** click **Launch donor outreach** → it identifies the
compatible, eligible donor audience → **Launch outreach campaign** → success state.

---

## 10 · Close (30 s)

**Click → Blood Seeker** in the top bar.

> "Back to the individual workspace — one application throughout.
>
> To summarise what this proof of concept establishes: the end-to-end workflow is coherent, one
> platform can serve both stakeholder groups, and both computational components have a clear
> place in the flow with real inputs and real consumers of their output.
>
> What it deliberately does not do is claim the hard parts are solved. The matching engine is a
> weighted ranking, not NSGA-II. The forecast is a composed signal, not a trained model. Those
> two are the implementation phase — and this prototype gives us the baseline to evaluate them
> against."

---

## Anticipated questions — short answers

**"Is this NSGA-II?"**
> No. It is a deterministic weighted ranking. NSGA-II is committed implementation work. The five
> objectives you see on screen are the objectives it will optimise over, which is why they're
> surfaced.

**"How accurate is the forecast?"**
> There is no accuracy figure, because there is no trained model — this is a composed
> deterministic signal for demonstration. Reporting an accuracy number here would be fabricating
> a result. Real evaluation comes after we have real data.

**"Is this real data?"**
> No. Every record is fictional demonstration data. No real donor, patient, or blood bank is
> represented, and we have no blood-bank integration or partnership.

**"Why does the nearest donor not rank first?"**
> Because proximity is one of five criteria. Under *Critical* urgency proximity weighs more and
> that donor does rank first. That trade-off is exactly the multi-objective problem.

**"Where does the map data come from?"**
> It is a schematic in a fictional coordinate space, not a geographic rendering. That keeps the
> demo free of tile servers and API keys, and it enforces the privacy property: sector-level
> only, no addresses stored. Real map integration is scheduled.

**"Is inter-bank coordination a third problem?"**
> No — it is a normal application workflow with no optimisation behind it. There are exactly two
> computational components.

**"Does this need internet?"**
> No. It runs entirely offline; we verified it with all external requests blocked.

---

## If something goes wrong

- **A screen looks wrong:** press **F5**. Created requests survive a refresh.
- **Total reset:** close the tab, open `http://localhost:4173` again.
- **Server died:** `npm run preview` in the project folder.
- **Nothing recovers:** the narrative works from static screenshots — have
  `docs/SCREENSHOTS.md` open as a fallback.
