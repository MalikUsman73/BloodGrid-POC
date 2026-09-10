# CCP-1: Donor Matching Optimisation

**Complex Computing Problem 1 and its proposed solution**

BloodGrid, BS Software Engineering Final Year Project
Abdullah Tariq, Malik Usman, Rizwan Saeed
Supervisor: Dr. Isma ul Hassan, Software Engineering Department, FAST-NUCES

---

## 1. Problem statement

When a blood seeker posts a request, the system must select a **contact set** of *k* donors to
notify, drawn from the pool of donors who are compatible, eligible and available.

This is the task defined by FR5 (view ranked candidate donors) and FR10 (notify ranked donors and
record accept, decline or no response). The system notifies several donors per request because any
individual donor may decline or fail to respond.

The selection must satisfy hard medical and operational rules, and must balance four criteria that
pull against one another. There is no single donor set that is best on all four at once.

**Formal statement.** Given a request *j* and a filtered candidate pool of *n* donors, select a
subset *S* of exactly *k* donors that is Pareto-optimal with respect to travel burden, donor
recovery, expected fulfilment, and preservation of scarce blood types.

---

## 2. Why this is a complex computing problem and not a database query

A CRUD query can return "the nearest compatible donor". It cannot do any of the following.

**It cannot resolve conflicting criteria.** A donor who is close, reliable and a perfect group
match may have donated three weeks ago. A donor who is fully recovered may live twice as far away.
No ordering by a single column expresses that trade-off, and no fixed ordering of columns expresses
it either (see Section 7.2 on lexicographic ranking).

**It cannot evaluate a set.** The quality of a five-donor contact list is not read off any single
row. Expected fulfilment across the set is a joint quantity, and the total scarce-type cost of the
list depends on which donors are in it together.

**The candidate space is not enumerable.** Selecting *k* donors from *n* candidates gives C(*n*, *k*)
possible contact sets. For a pool of 300 donors and a contact set of 5, that is approximately 19.6
billion combinations. The complete Pareto set over those combinations can grow exponentially with
*n*, and computing it exactly is not tractable at operational pool sizes.
[REQUIRES VALIDATION: the formal complexity result for multi-objective cardinality-constrained
subset selection should be cited from the multicriteria optimisation literature before this
statement enters the written proposal.]

**It cannot anticipate scarcity.** A database has no notion that spending an O-negative donor today
may leave an unservable request tomorrow.

---

## 3. Formulation: filters and objectives are different things

The five criteria originally listed for CCP-1 do not all belong in the same layer. Two of them are
not objectives at all. Treating them as objectives produces incorrect and unsafe output.

### 3.1 Hard filters, applied before optimisation

| Filter | Rule | Why it is a filter and not an objective |
|---|---|---|
| Blood-group compatibility | Donor's group must belong to the compatible-donor set for the recipient's group | Never tradeable. A donor whose blood cannot be given to this patient is not a worse option, they are not an option. |
| Availability | Donor is marked available and is not currently committed to another open request | Binary. An unavailable donor cannot be contacted at any distance or reliability score. |
| Medical eligibility | Days since last donation is at or above the configured cooldown threshold | Below the threshold the donor is ineligible. Final clinical judgement remains with the collecting facility; the system applies a configurable rule and does not make clinical decisions. |
| Service radius | Donor is inside the operating area for the request | Operational boundary, not a preference. |

**Why this separation is mandatory.** If availability is modelled as a binary objective, consider
two donors:

| Donor | Proximity | Recency | Availability | Reliability |
|---|---|---|---|---|
| P | 3 km | 90 days | 0 (unavailable) | 0.90 |
| Q | 9 km | 70 days | 1 (available) | 0.60 |

Neither dominates the other: Q is better on availability, P is better on the other three. Donor P
is therefore non-dominated, appears on the Pareto front, and is recommended to the seeker despite
being unavailable. The identical failure occurs with compatibility, where the consequence is a
recommendation the patient cannot receive.

A second effect matters for algorithm selection. Binary objectives inflate the non-dominated set,
because every donor scoring 1 is automatically incomparable to every donor scoring 0 unless beaten
on all remaining criteria. This artificially enlarges rank 1 and degrades selection pressure. The
binary criteria therefore create the exact pathology that later governs the choice between NSGA-II
and NSGA-III, which is a further reason to remove them from the objective set.

### 3.2 Blood-group compatibility reference

Red cell donor to recipient compatibility, used by the compatibility filter and by the versatility
values in Section 4.4:

| Donor group | Can be given to | Number of recipient groups served |
|---|---|---|
| O negative | all eight groups | 8 |
| O positive | O+, A+, B+, AB+ | 4 |
| A negative | A-, A+, AB-, AB+ | 4 |
| B negative | B-, B+, AB-, AB+ | 4 |
| A positive | A+, AB+ | 2 |
| B positive | B+, AB+ | 2 |
| AB negative | AB-, AB+ | 2 |
| AB positive | AB+ | 1 |

[REQUIRES VALIDATION: confirm against a clinical transfusion reference before publication.]

---

## 4. The four objectives

Each objective is computed per donor and aggregated over the selected set *S*. No set-level
interaction terms are used in this version of the model.

### 4.1 O1. Travel burden (minimise)

```
O1(S) = mean over i in S of d(i, j)
```

where `d(i, j)` is the travel distance, or estimated travel time where routing data is available,
from donor *i*'s registered area to the collection point for request *j*.

A variant using the maximum rather than the mean will also be evaluated, since the slowest donor in
a set determines when the request is actually met.

### 4.2 O2. Donor recovery (maximise)

```
O2(S) = mean over i in S of r(i)
```

where `r(i)` is the number of days since donor *i*'s last recorded donation. Only donors with
`r(i)` at or above the cooldown threshold reach this stage, so this objective operates entirely
above the medical floor and expresses a preference for better-recovered donors, not a safety rule.

### 4.3 O3. Expected fulfilment (maximise)

```
O3(S) = 1 - product over i in S of (1 - p(i))
```

where `p(i)` is donor *i*'s estimated response probability, taken from their historical response
rate.

**Estimating p(i) for donors with little history.** A raw ratio of accepted to received requests is
unstable for new donors, where a single acceptance yields a probability of 1.0. A shrinkage
estimate is used instead:

```
p(i) = (a(i) + alpha * p_pool) / (m(i) + alpha)
```

where `a(i)` is accepted requests, `m(i)` is requests received, `p_pool` is the pool mean response
rate, and `alpha` is a smoothing constant. Donors with no history fall back to the pool mean rather
than to an extreme value.

**Independence assumption.** This expression assumes donor responses are independent. Correlated
responses, for example among donors in the same locality reacting to the same local disruption,
would violate it. This assumption is recorded in Section 10 with its consequences.

### 4.4 O4. Type-preservation cost (minimise)

This objective is what stops the system from consuming scarce universal donors on requests that
have ordinary alternatives.

```
c(i, j) = 0                                if group(i) == group(j)
c(i, j) = V(group(i)) * S_adj(group(i))    otherwise

O4(S) = sum over i in S of c(i, j)
```

**V(g)** is the versatility of group *g*, the number of recipient groups it can serve, taken from
the table in Section 3.2. O negative scores 8, AB positive scores 1.

**S_adj(g)** is the adjusted scarcity of group *g*:

```
S_adj(g) = (1 / max(epsilon, share(g))) * (1 + beta * risk(g))
```

where `share(g)` is group *g*'s share of the currently available and eligible donor pool, `risk(g)`
is the shortage risk for group *g* produced by CCP-2, `beta` is a tunable weight, and `epsilon`
guards against division by zero.

**Behaviour of this objective.** An O negative donor considered for an O positive patient carries a
high cost, because the group is highly versatile and typically scarce. The same donor considered
for an O negative patient carries zero cost, because it is an exact match and nothing is wasted. An
AB positive donor carries near-zero cost in all cases, because that group can only ever serve AB
positive recipients.

The cost is a preference and not a prohibition. In an urgent case with no alternative candidates,
the remaining objectives outweigh it and the universal donor is selected, which is the correct
clinical behaviour.

**Why this objective is necessary.** Without it, the design systematically over-consumes the donors
it most needs to conserve. A universal donor passes the compatibility filter for every request, so
they enter every candidate pool, so they are contacted more often than any other donor. The bias is
a structural consequence of the filter, not an occasional accident.

[REQUIRES VALIDATION: Rh-negative prevalence is reported to be lower in South Asian populations
than in European ones. If confirmed for Pakistan with a citable source, this strengthens the local
relevance of O4. Do not state it without a source.]

---

## 5. Evidence that the objectives genuinely conflict

A multi-objective formulation in which all objectives move together is decorative and would not
justify the method. Each pair is therefore checked.

| Pair | Conflict | Basis |
|---|---|---|
| O1 vs O2 | Nearby donors are contacted more often, so they tend to have shorter recovery times | Behavioural, testable on data |
| O1 vs O3 | The nearest donor may have a poor response history; the dependable donor may be further away | Observable, testable |
| **O2 vs O3** | **Structural.** A donor who reliably accepts is asked more and donates more, which shortens their time since last donation. The most dependable donors are systematically the least recovered. | Mechanical consequence of the definitions, not a property of a particular dataset |
| O4 vs O1, O4 vs O3 | The closest and most reliable donor is often a universal donor, who is precisely the donor the system should conserve | Direct consequence of the versatility filter effect described in Section 4.4 |

The O2 against O3 conflict is the strongest evidence available, because it follows from how the two
quantities are defined rather than from an empirical observation that might not replicate.

**Planned verification.** Before the objective set is frozen, a correlation and principal component
analysis will be run on the available data to confirm that the four objectives are not redundant.
The test looks for **positive** correlation, which indicates redundancy. Negative correlation
confirms genuine trade-off and supports the formulation. [RECOMMENDATION, to be executed in FYP-2]

---

## 6. Method selection: NSGA-III

### 6.1 The decision

**Selected method: NSGA-III (Deb and Jain, 2014), searching over candidate contact sets of size k.**

### 6.2 The three properties that determine the choice

**Property 1: the search space cannot be enumerated.** The decision is which subset of *k* donors to
notify, not which single donor is best. C(300, 5) is approximately 19.6 billion candidate sets.
Exhaustive evaluation is not available.

**Property 2: the problem is many-objective.** Four objectives places it above the conventional
three-objective threshold. This is the property that selects NSGA-III over NSGA-II specifically,
and it is addressed in Section 6.3.

**Property 3: the trade-off surface is the required output.** The system does not need one answer.
It needs the set of defensible alternatives, so that the final displayed list can be chosen
according to the urgency of the request, and so that a human operator retains a meaningful choice
as required by the human-oversight commitment.

All three hold, which is the standard condition under which a population-based multi-objective
method is the appropriate tool.

### 6.3 Why NSGA-III and not NSGA-II

NSGA-II and NSGA-III share their ranking step, their elitism, and their variation operators. They
differ in exactly one component: how diversity is preserved during selection.

| Component | NSGA-II (2002) | NSGA-III (2014) |
|---|---|---|
| Non-dominated sorting | Yes | Yes, identical |
| Elitist survival from P union Q | Yes | Yes, identical |
| Crossover and mutation | Standard | Identical |
| **Diversity mechanism** | **Crowding distance**, a measure of local emptiness around each solution | **Reference-point niching**, association to a fixed structured set of reference directions with preference for under-filled niches |
| Validated objective range | 2 to 3 | 3 to 15 |

**The failure mechanism in NSGA-II.** Selection in NSGA-II uses rank first and crowding distance as
the tie-break. Dominance requires a solution to be no worse on every objective, which becomes
progressively rarer as objectives are added. As the population converges, the proportion occupying
rank 1 rises, and once most of the population shares a rank the tie-break becomes the entire
selection mechanism.

Crowding distance measures **diversity**, not **quality**. A solution can have a large crowding
distance simply because it is poor and isolated. When crowding distance governs selection, the
search optimises for spread rather than convergence.

This degradation at four or more objectives is the explicit stated motivation for NSGA-III. Citing
the founding paper of the replacement as the reason for retiring the predecessor is the strongest
available form of this argument.

**Honest calibration.** At exactly four objectives NSGA-II is degraded rather than broken; the
failure becomes severe at five and above. NSGA-III is the better-motivated and safer choice at
four, and the reasoning is defensible, but the claim should be stated as loss of selection pressure
rather than as outright failure.

**Empirical confirmation.** NSGA-II will be implemented and benchmarked alongside NSGA-III on the
same instances. If NSGA-II performs comparably, that will be reported. The claim in this section is
a design justification supported by published results, and it will be tested rather than assumed.

### 6.4 Why not NSGA-II even after objective reduction

Removing compatibility and availability from the objective set leaves three objectives, which would
return NSGA-II to its validated range. The type-preservation objective is nonetheless added,
because without it the system systematically consumes scarce universal donors, as shown in Section
4.4. That defect is a correctness problem and cannot be traded away to keep an algorithm inside its
comfortable range. The objective set is chosen from the requirements of the problem, and the
algorithm is then chosen to fit the objective set.

---

## 7. Comparison against alternative methods

Each alternative is assessed against the same four objectives and the same filtered pool.

### 7.1 Database query, nearest compatible donor

Used by the existing applications surveyed in the proposal.

**Rejected.** Optimises a single criterion. Cannot express any trade-off, cannot avoid repeatedly
contacting the same donors, and cannot distinguish a universal donor from an exact match. It is the
behaviour this project is proposing to improve on, and it is retained as an evaluation baseline.

### 7.2 Sequential greedy heuristic, ordered by proximity then compatibility then rarity

This is the published approach in Belfarsi et al. (2025), the closest prior work, and it is
therefore the most important comparison in this document.

**Rejected as the primary method.** The ordering is lexicographic: an earlier criterion always
overrides a later one regardless of margin. A donor 1.0 km away who donated last week always beats a
donor 1.2 km away who has not donated in a year, because proximity is evaluated first and the
comparison never reaches recency.

This is a structural property of lexicographic ordering, not a tuning defect, and no adjustment of
thresholds repairs it. It is the limitation recorded as Gap 3 in the proposal's research gap
matrix.

The heuristic is retained as the **primary baseline**, because replicating the published method and
measuring against it is what converts "NSGA-III is better" from an assertion into a result.

### 7.3 Weighted-sum scoring

A single linear combination of the criteria, and the most common approach in commercial matching
applications.

**Rejected as the primary method.** Two reasons.

First, the weights are not defensible. There is no principled basis for setting the weight of
proximity against recovery, and the choice silently determines every result the system produces.

Second, and decisively, weighted-sum scoring **provably cannot reach non-supported Pareto points**.
Geometrically, minimising a weighted sum slides a straight line toward the front and stops where it
first touches. Where the front is concave, the line passes over the dent, and the solutions inside
it are unreachable by any weighting.

Worked example, minimising distance and minimising recovery deficit, where deficit equals 100 minus
days since donation:

| Donor | Distance | Days since donation | Deficit |
|---|---|---|---|
| A | 2 km | 40 | 60 |
| B | 6 km | 55 | 45 |
| C | 10 km | 100 | 0 |

All three are Pareto-optimal; none dominates another. Scoring with weight *w* on distance:

| w | A: 60 - 58w | B: 45 - 39w | C: 10w | Selected |
|---|---|---|---|---|
| 0.50 | 31.0 | 25.5 | 5.0 | C |
| 0.70 | 19.4 | 17.7 | 7.0 | C |
| 0.80 | 13.6 | 13.8 | 8.0 | C |
| 0.90 | 7.8 | 9.9 | 9.0 | A |
| 0.95 | 4.9 | 7.95 | 9.5 | A |

Solving algebraically, B beats A only when *w* is below 0.789, and B beats C only when *w* is above
0.918. Both conditions cannot hold. **No weighting whatsoever selects donor B**, despite B being
Pareto-optimal and a plausible practical compromise at 6 km and 55 days recovered.

Every weighted-scoring donor application therefore has a class of good donors it structurally cannot
surface. Weighted-sum scoring is retained as an evaluation baseline for exactly this reason: the
experiment quantifies what it misses.

### 7.4 Hungarian algorithm and classical assignment methods

**Rejected.** Solves single-objective, one-to-one assignment. The problem here is multi-objective
and selects *k* donors per request. These methods are not applicable without collapsing the
objectives into one, which reintroduces the weighted-sum defect in Section 7.3.

### 7.5 Exact enumeration and exact non-dominated filtering

**Not rejected. Retained as a verification oracle.**

Where the candidate pool is small enough that C(*n*, *k*) can be enumerated, the exact Pareto set
over contact sets is computed directly and used as ground truth. NSGA-III output is then measured
against it using hypervolume and inverted generational distance.

This is a methodological advantage worth stating explicitly. Most published evaluations of
multi-objective metaheuristics must compare against an approximated reference front. This project
can compute the true front on small instances, which makes the approximation quality of NSGA-III
directly measurable rather than estimated.

### 7.6 Mixed-integer linear programming with the epsilon-constraint method

**Considered and not selected as the primary method for the deployed path.**

An exact formulation is possible: the objectives linearise, including expected fulfilment via a
logarithmic transformation of the product form. It was rejected for the live request path for three
reasons. It requires a solver in the latency-sensitive request path. Its exactness advantage
disappears once the model is extended with the set-level terms recorded as future work in Section
10. And the epsilon-constraint sweep requires a separate solve per Pareto point, which is poorly
suited to per-request response times.

It is retained in the same role as Section 7.5, as an offline exact reference on tractable
instances. [RECOMMENDATION, subject to timeline]

### 7.7 Reinforcement learning and learned ranking models

**Rejected.** Both require labelled outcome data from a deployed system that does not yet exist.
Neither produces an explanation of why a specific donor was ranked in a specific position, which
conflicts with the auditability commitment in Section 9. These are recorded as future work
contingent on operational data becoming available.

### 7.8 Summary

| Method | Expresses trade-offs | Reaches all Pareto points | Handles four objectives | Role in this project |
|---|---|---|---|---|
| Nearest compatible | No | No | No | Baseline |
| Sequential greedy (Belfarsi et al.) | Lexicographic only | No | No | Primary baseline |
| Weighted sum | Hidden in weights | **No** | Collapsed to one | Baseline |
| Hungarian | No | No | No | Not applicable |
| NSGA-II | Yes | Approximately | Degraded | Comparator |
| Exact enumeration | Yes | Yes | Yes | Verification oracle, small instances only |
| **NSGA-III** | **Yes** | **Approximately, with reference-point spread** | **Yes** | **Selected method** |

---

## 8. How NSGA-III is applied to this problem

### 8.1 Encoding

A candidate solution is a contact set *S* of exactly *k* donors drawn from the filtered pool of *n*.
It is represented as a binary membership vector of length *n* with a cardinality constraint of *k*,
or equivalently as an integer vector of *k* distinct donor indices.

### 8.2 Operators

| Component | Choice |
|---|---|
| Initialisation | Random *k*-subsets of the filtered pool, with a fraction seeded from the greedy baseline to accelerate early convergence |
| Crossover | Uniform crossover on the membership vector, followed by a repair operator that restores cardinality *k* |
| Mutation | Swap mutation, replacing one selected donor with one unselected donor |
| Constraint handling | Repair rather than penalty, since the cardinality constraint is easy to restore and penalties waste evaluations on infeasible solutions |
| Termination | Fixed generation budget, with early stopping when hypervolume improvement falls below a threshold over a fixed window |

### 8.3 Reference directions

NSGA-III requires a structured set of reference directions. Using the Das and Dennis systematic
approach with four objectives and six divisions gives C(9, 6) = 84 reference points. Population size
is set to the nearest suitable multiple above that value. Both the division count and the population
size are tuning parameters to be fixed empirically during FYP-2.

### 8.4 From the Pareto front to a displayed list

NSGA-III returns a set of non-dominated contact sets. One must be displayed.

The final selection uses an **urgency-conditioned reference direction**. For a critical request, the
reference direction emphasises expected fulfilment and travel burden. For a routine request, it
emphasises donor recovery and type preservation. The contact set associated with the selected
reference direction is displayed.

This reuses NSGA-III's own niching machinery rather than introducing a separate weighted-sum
tie-break, which would reintroduce the defect described in Section 7.3.

The remaining non-dominated sets are retained and made available to a blood bank administrator,
which is what makes the human-oversight commitment substantive rather than nominal.

### 8.5 State across requests

Donors in a displayed contact set are marked committed for a configurable holding period. During
that period they are excluded by the availability filter, so a second request arriving moments later
draws from the reduced pool and receives the next best contact set. On decline, timeout or
completion, donors are released back to the pool.

This is what makes consecutive requests interact. Without it the system would offer the same donors
to every concurrent seeker.

---

## 9. Integration with CCP-2, and fairness constraints

### 9.1 Forecast to matching, satisfying FR17

FR17 requires that forecast output be consumable as a direct input to the matching function rather
than delivered as a separate report. The type-preservation objective provides that interface.

The `risk(g)` term inside `S_adj(g)` in Section 4.4 is the shortage risk for blood group *g*
produced by CCP-2. When CCP-2 forecasts a shortage in a group, the scarcity weight for that group
rises, the preservation cost of spending its donors rises, and CCP-1 becomes more protective of that
group in every subsequent request.

The connection is a single coefficient, it is explainable to a non-technical stakeholder, and it
requires no structural change to either component. The forecast-independent version, with `beta` set
to zero, is the control condition for the integration experiment described in Section 11.

### 9.2 Fairness as a hard constraint

Contact burden is enforced as a constraint, not as an objective:

> No donor is contacted more than *N* times in a rolling thirty-day window.

The distinction matters. An objective can be traded away whenever the other criteria are favourable.
A constraint cannot. Expressing fairness as a guarantee rather than as a preference is both the
stronger ethical position and the more defensible one, and it is what allows the project to state a
concrete commitment on donor protection rather than a general intention.

---

## 10. Known limitations and prepared responses

Recording these is part of the method justification, not a caveat appended to it.

**10.1 If k equals 1, the formulation collapses.** With a single donor per request the objectives
become separable across donors, the Pareto set is the non-dominated subset of the pool, and it is
directly computable. NSGA-III would not be justified. The method depends on the contact set being
genuinely a set, which FR10 establishes. If the deployed configuration ever reduces to one donor per
request, the correct method for that configuration is exact non-dominated filtering.

**10.2 The independence assumption in O3.** Expected fulfilment assumes donor responses are
independent. Correlated responses would break it. The greedy and weighted-sum baselines make the
same assumption implicitly; this project states it. Modelling correlation would add a set-level
interaction term, at which point the objectives stop being additive and the case for a
population-based search becomes stronger rather than weaker. Recorded as future work.

**10.3 No set-level diversity objective in this version.** Geographic dispersion of the contact set
is not modelled. A contact set drawn entirely from one locality is exposed to a single local
disruption. Recorded as future work, and noted as the natural extension that would take the model
from four objectives to five.

**10.4 Objective independence is asserted, not yet measured.** Section 5 argues the objectives
conflict. The correlation and PCA verification has not been run, because it needs data. If the
analysis shows redundancy, the objective set will be reduced and the algorithm choice revisited.

**10.5 Real data is not secured.** The team is in contact with a representative of a blood bank
regarding real donation and demand data. [NOT CONFIRMED]. The evaluation is designed around
synthetic and public data as the primary evidence base, with real data treated as an improvement if
it arrives rather than as a dependency.

**10.6 Reliability estimates are weak for new donors.** The shrinkage estimator in Section 4.3
mitigates this but does not eliminate it. Cold-start behaviour is a stated limitation.

---

## 11. Evaluation plan

### 11.1 Comparison set

| Role | Method |
|---|---|
| Floor | Random compatible donor |
| Existing practice | Nearest compatible donor |
| **Primary baseline** | **Sequential greedy heuristic, replicating Belfarsi et al. (2025)** |
| Baseline | Weighted-sum scoring |
| Comparator | NSGA-II, same objectives, same instances |
| Selected method | NSGA-III |
| Oracle | Exact enumeration of C(*n*, *k*) on small instances |

### 11.2 Metrics

**Front quality:** hypervolume, and inverted generational distance measured against the exact front
on instances small enough to enumerate.

**Operational outcomes:** request fulfilment rate, mean and maximum travel distance, distribution of
contacts per donor over the evaluation horizon, and universal-donor consumption rate, defined as the
proportion of requests served by a donor whose group was more versatile than required.

**Cost:** wall-clock time per request, reported against pool size.

**Protocol:** all stochastic methods run over multiple random seeds, with mean and standard
deviation reported and a significance test applied to differences.

### 11.3 The integration experiment

The central test of FR17 compares the full system against itself with the forecast link disabled.

| Condition | Configuration |
|---|---|
| Control | `beta` set to zero, so type-preservation ignores the forecast |
| Treatment | `beta` tuned, so scarcity responds to forecast shortage risk |

Measured on universal-donor consumption rate and on requests left unserved for want of a compatible
donor. This isolates the contribution of the forecast, and the result will be reported whether or
not it favours the treatment condition.

---

## 12. Implementation

| Component | Tool | Note |
|---|---|---|
| NSGA-III, NSGA-II | pymoo | Both algorithms behind one interface, so the comparison costs little beyond the first integration |
| Reference directions | `pymoo.util.ref_dirs` | Das and Dennis systematic layout |
| Front quality indicators | `pymoo.indicators` | Hypervolume and IGD |
| Exact enumeration oracle | Standard library | Small instances only |
| Distance and routing | To be selected | Straight-line distance as the fallback if routing data is unavailable |

All components are free and available in Python.

---

## 13. Status of claims in this document

| Claim | Status |
|---|---|
| CCP-1 is contact-set selection under four objectives | TEAM-CONFIRMED |
| Compatibility and availability are filters, not objectives | RECOMMENDATION, derived from the dominance analysis in Section 3.1 |
| Type-preservation is required as a fourth objective | RECOMMENDATION |
| NSGA-III is the selected method | TEAM-CONFIRMED |
| NSGA-II degrades beyond three objectives | SOURCE-DERIVED, Deb and Jain (2014) |
| Weighted sum cannot reach non-supported Pareto points | SOURCE-DERIVED, standard result in multi-objective optimisation, with the worked example in Section 7.3 verified arithmetically |
| Belfarsi et al. use a sequential greedy heuristic | SOURCE-DERIVED, verified by direct fetch |
| Real donation and demand data will be available | NOT CONFIRMED |
| Objectives are genuinely non-redundant | REQUIRES VALIDATION, analysis pending data |
| Blood-group compatibility table | REQUIRES VALIDATION against a clinical reference |

---

## 14. References

Deb, K., Pratap, A., Agarwal, S., and Meyarivan, T. (2002). A fast and elitist multiobjective
genetic algorithm: NSGA-II. *IEEE Transactions on Evolutionary Computation*, 6(2), 182 to 197.

Deb, K., and Jain, H. (2014). An evolutionary many-objective optimization algorithm using
reference-point-based nondominated sorting approach, part I: solving problems with box constraints.
*IEEE Transactions on Evolutionary Computation*, 18(4), 577 to 601.

Ishibuchi, H., Tsukamoto, N., and Nojima, Y. (2008). Evolutionary many-objective optimization: a
short review. *IEEE Congress on Evolutionary Computation*.

Das, I., and Dennis, J. E. (1998). Normal-boundary intersection: a new method for generating the
Pareto surface in nonlinear multicriteria optimization problems. *SIAM Journal on Optimization*,
8(3), 631 to 657.

Zhang, Q., and Li, H. (2007). MOEA/D: a multiobjective evolutionary algorithm based on
decomposition. *IEEE Transactions on Evolutionary Computation*, 11(6), 712 to 731.

Belfarsi, E. A., et al. (2025). [Full citation to be completed from the verified source record in
`audit/00_evidence_audit_report.md`.]

**All citations must be checked against the originals before this document is incorporated into the
written proposal.**
