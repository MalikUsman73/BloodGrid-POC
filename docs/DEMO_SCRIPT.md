# BloodGrid, defense demonstration script

**Target length: 6 to 8 minutes.** The data is deterministic, so every rehearsal is identical to
the performance.

**Before you start**

- `npm run preview` running, browser open at `http://localhost:4173`
- Browser at 100 percent zoom, window maximised, one tab, dev tools closed
- For a clean slate, close the tab and open a fresh one. Session state resets to the seeded data.

---

## 0. Opening frame, 30 seconds

**Landing page.**

> "BloodGrid is one integrated application serving two user groups: individuals who need or give
> blood, and blood-bank administrators. It contains two core computational problems: donor
> matching optimisation, and blood demand predictive analysis."

Point at the two branches on the landing page.

> "Everything you are about to see is a proposal-stage prototype. The data is simulated and both
> computational outputs are simulated. I will be explicit about that at each point."

Let the panel read the notice at the top. It buys credibility for everything that follows.

**Click: Enter the prototype**

---

## 1. Workspace selection, 20 seconds

> "Three workspaces, one application. Blood seeker and blood bank are the two core
> demonstrations. The donor workspace is a supporting workflow that closes the loop."

**Click: Blood seeker**

---

## 2. Create a blood request, 45 seconds

**Click: Create blood request**

> "An attendant raises a request: blood group, units, urgency, and location."

The form opens pre-filled with O+, 2 units, Urgent, Sector G-8.

Point at the summary on the right.

> "It already shows that this request accepts O+ and O-, and that ten donors in the pool are
> eligible. Note the location is a sector, not an address. That holds all the way through."

Optional, to show the urgency mechanic: tap Critical, then back to Urgent, and note that the hint
text changes. Urgency changes how the criteria are weighted.

**Click: Find matching donors**

---

## 3. Matching, 15 seconds

> "The screening is explicit: compatibility first, then the donation-interval rule, then scoring
> against the remaining criteria."

About one and a half seconds. Do not talk over the end of it; the ranked screen is the moment.

---

## 4. Suitable donors, 90 seconds. The centrepiece.

Let the screen land before speaking.

> "Fourteen donors screened. Three removed for an incompatible blood group, one for being within
> the ninety-day donation interval. Ten ranked."

> "Each donor carries a Prototype Match Score, and underneath it the five criteria the ranking
> balances: compatibility, proximity, availability, donation recency, and reliability."

**Now the honest framing. Say this clearly.**

> "This score is simulated output. It is a deterministic weighted ranking, not an optimiser. What
> it does is show you the shape of the problem: five competing objectives, and no single ordering
> that is best for every request. That is exactly why the committed implementation is
> multi-objective optimisation. The note under the list says precisely that."

**A strong optional beat. The trade-off is real, not decorative.**

> "Ali Raza is the closest donor at 1.4 km, but he ranks second, because Ahmed Khan scores higher
> on recency and reliability. If this were a Critical request, proximity would weigh more and Ali
> Raza would rank first. That reordering is the multi-objective problem in miniature."

**The map.**

> "Donors are plotted at sector level, with five and ten kilometre rings from the request. The
> caption matters: donor addresses are never stored or displayed. The prototype holds no
> addresses at all, so it could not show one. This is an offline schematic map. Real map
> integration is implementation-phase work."

Hover a row to show the list and map highlight together. Zoom once with plus, then Fit.

---

## 5. The loop closes, 60 seconds

Point at the workspace switcher before clicking.

> "Now the same application, from the donor's side. No sign-out, no second app."

**Click: Donor**, then **Requests**

> "The request the seeker just sent has arrived here."

**Click: Accept request**

> "The donor accepts, and now a conversation opens, inside BloodGrid, for both sides. This is the
> point of the model: the two people can coordinate without either one's personal contact details
> being handed over."

**Click: Open conversation**, type a short message, **Send**.

> "This is a prototype conversation. The messages live in the browser session; there is no
> messaging backend at the proposal stage, and the screen says so."

---

## 7. Blood bank, 45 seconds

**Click: Blood bank** in the switcher.

> "Same application, second user group. The administrator sees the current stock position: units
> held, days of cover, and status per group."

Point at the warning at the top.

> "And immediately, the headline from the second computational component: a projected O+
> shortfall."

**Click: Demand and forecast**

---

## 8. Demand and forecast, 90 seconds. CCP 2 centrepiece.

> "Ninety days of recorded demand, then a fourteen-day forward window. The solid line is history.
> Past the marked boundary, the dashed line is the prototype forecast."

Point at the four figures.

> "The thirty-day average is 16.9 units a day. The forward window peaks at 26.4 around the
> eighteenth. Total projected demand is 271 units against 231 units of cover, which is held stock
> plus expected routine collection. That leaves an indicative shortfall of 40 units."

**The honest framing. Say this clearly.**

> "This forecast is simulated. There is no trained model behind it, and you will notice I am
> quoting no accuracy figure, no error metric, and no confidence level, because none exists and
> none is displayed. The shaded band is an illustrative range, not a prediction interval. The
> trained forecasting model is a committed implementation component."

Scroll to the scenario factors.

> "These factors, a seasonal illness period and a holiday travel window, shape the demonstration
> data so the chart is legible. They are illustrative simulated inputs, not causal findings. We
> have not measured or validated any such relationship."

Optional: click A+ to show the signals differ per group. A+ is elevated but not at shortage risk,
which shows the rules discriminate rather than flagging everything.

**Click: Go to planning**

---

## 9. Planning, 45 seconds

> "This is the decision screen, not a second analytics page. One line of context per group, then
> the recommended action, the reason behind it, and the workflows that follow."

> "For O+: begin donor outreach, because projected demand exceeds available cover by about forty
> units. Ten compatible, eligible donors are reachable in the pool."

**Say the scope point before the panel asks.**

> "Inter-bank coordination is an ordinary application workflow. It performs no optimisation: no
> redistribution, no routing, no allocation solver. It is not a third computational component.
> BloodGrid has exactly two: donor matching and demand prediction."

The note is printed on the coordination screen if they want it in writing.

Optional, 30 seconds: **Start outreach**, show the audience it builds, then **Start outreach** to
record the campaign.

---

## 10. Close, 30 seconds

**Click: Seeker** in the switcher.

> "Back to the individual workspace. One application throughout, and you can see the request now
> shows as accepted.
>
> To summarise what this proof of concept establishes: the end-to-end workflow is coherent, one
> platform can serve both stakeholder groups, and both computational components have a clear
> place in the flow, with real inputs and real consumers of their output.
>
> What it deliberately does not do is claim the hard parts are solved. The matching engine is a
> weighted ranking, not an optimiser. The forecast is a composed signal, not a trained model. Those
> two are the implementation phase, and this prototype gives us the baseline to evaluate them
> against."

---

## Anticipated questions

**Is this NSGA-II?**
> No, and we are no longer committing to NSGA-II specifically. It is a deterministic weighted
> ranking. Multi-objective optimisation is the committed implementation work, and the method is
> being selected between exact solving and NSGA-III, because NSGA-II loses selection pressure
> beyond three objectives and we have five. The five objectives on screen are the ones the
> optimiser will work over, which is why they are shown.

**How accurate is the forecast?**
> There is no accuracy figure, because there is no trained model. This is a composed
> deterministic signal for demonstration. Reporting an accuracy number would be fabricating a
> result. Real evaluation comes after we have real data.

**Is this real data?**
> No. Every record is fictional. No real donor, patient, or blood bank is represented, and we
> have no integration or partnership.

**Why does the nearest donor not rank first?**
> Because proximity is one of five criteria. Under Critical urgency, proximity weighs more and
> that donor does rank first. That trade-off is the multi-objective problem.

**How does the seeker actually reach the donor?**
> Through BloodGrid. The seeker sends a request, and if the donor accepts, a conversation opens
> in the application. We never show a donor's phone number, and the prototype does not store one.

**Where does the map data come from?**
> It is a schematic in a fictional coordinate space, not a geographic rendering. That keeps the
> demo free of tile servers and API keys, and it enforces the privacy property: sector level
> only, no addresses stored. Real map integration is scheduled.

**Is inter-bank coordination a third problem?**
> No. It is a normal workflow with no optimisation behind it. There are exactly two computational
> components.

**Does this need internet?**
> No. It runs entirely offline, and we verified that with all external requests blocked.

---

## If something goes wrong

- A screen looks wrong: press F5. Created requests survive a refresh.
- Full reset: close the tab, open `http://localhost:4173` again.
- Server stopped: run `npm run preview` in the project folder.
- Nothing recovers: the narrative works from the screenshots. Keep `docs/SCREENSHOTS.md` open.
