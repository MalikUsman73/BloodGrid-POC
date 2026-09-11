# CCP1 method review: why NSGA-II should be replaced

**Status:** proposal for discussion with the supervisor.

**Method decision, now settled.** CCP1 uses **NSGA-III**. Donor availability is a binary
feasibility constraint rather than an objective, so the objective vector holds four criteria:
compatibility, proximity, donation recency, and reliability. The exact epsilon-constraint MILP
discussed in sections 8 and 9 was explored and then set aside; the project is not pursuing a
hybrid. The deliverable is the TypeScript prototype, and there is no Python implementation in
this repository.

---

## 1. Summary

The proposal currently names NSGA-II as the optimisation method for CCP1, donor matching. This
document argues that NSGA-II is not the right choice, and that the reason is not primarily the
algorithm but the way the problem has been formulated.

**Original recommendation, retained for the record.** Reformulate CCP1 as multi-objective
donor-to-request assignment, solve it exactly by epsilon-constraint over a MILP, and keep
NSGA-III as a comparator.

**What was decided instead.** NSGA-III alone, with availability as a binary constraint. The
reformulation argument in sections 3 to 7 stands unchanged and is the important part of this
document; only the choice of solver differs.

The argument in short:

1. As currently formulated, CCP1 is a scoring and ranking task, not a search problem. There is
   nothing for an evolutionary algorithm to search.
2. Five objectives places the problem outside the range NSGA-II was designed for.
3. Once the problem is reformulated so that donor choices interact, the objectives linearise, and
   the resulting model is exactly solvable at realistic scale.
4. That gives the project something most final year projects lack: exact ground truth against
   which any heuristic can be measured.

---

## 2. What NSGA-II requires in order to be the right tool

A multi-objective evolutionary algorithm is justified when three conditions hold together:

1. **The search space cannot be enumerated.** Combinatorial explosion, or continuous decision
   variables.
2. **The objectives are black-box, non-convex, or otherwise unsuited to an exact solver.**
3. **The trade-off surface itself is the desired output**, rather than a single solution.

The sections below test the current CCP1 formulation against each condition.

---

## 3. Objection one: there is no search space

In the current formulation the system evaluates a scoring function per donor:

```
f(donor) -> (compatibility, proximity, availability, recency, reliability)
```

Every component depends only on that donor's own attributes. No donor's score depends on which
other donors are chosen. The objectives are therefore **separable across donors**.

Two consequences follow.

**Exhaustive evaluation is trivial.** With n donors the cost is n function evaluations. The
prototype pool is 14. A production pool filtered by blood group, eligibility and radius is
perhaps a few hundred. Enumeration is not merely feasible, it is instantaneous.

**The Pareto set is exactly computable.** When objectives are separable per candidate, the
Pareto-optimal set is precisely the non-dominated subset of the donor pool. It is obtained by
pairwise comparison in O(m n squared) for m objectives, and faster with divide-and-conquer
methods.

Note carefully what that procedure is. It is **non-dominated sorting**, which is one *component*
of NSGA-II. The evolutionary machinery around it, population, crossover, mutation, generations,
contributes nothing here, because there is no space to explore.

A metaheuristic that approximates a quantity which can be computed exactly is strictly dominated
by computing it exactly. Using NSGA-II on the current formulation would mean running roughly
25,000 function evaluations (population 100, 250 generations) to approximate an answer obtainable
in a few hundred.

---

## 4. Objection two: five objectives is outside NSGA-II's design envelope

This is the most technically specific objection and the one most likely to be raised by an
examiner familiar with the literature.

NSGA-II was designed and validated for two and three objectives (Deb et al., 2002). Problems with
four or more objectives are conventionally called **many-objective**, and NSGA-II is documented to
degrade on them. This degradation is the explicit motivation for NSGA-III (Deb and Jain, 2014).

The mechanism is worth stating precisely, because it explains why the failure is structural
rather than a matter of tuning:

As the number of objectives grows, the proportion of a randomly sampled population that is
mutually non-dominated rises sharply. At five objectives it is common for the large majority of a
100-member population to occupy rank 1. When almost every individual shares the same rank, Pareto
ranking supplies no selection pressure, and survival is decided almost entirely by crowding
distance. Crowding distance is a **diversity** measure, not a **quality** measure. The search
therefore drifts toward spread rather than convergence.

CCP1 as proposed uses exactly five objectives, which is the configuration NSGA-II handles worst.

**A cheaper fix worth testing first.** The five criteria are probably not statistically
independent. Proximity and availability plausibly correlate, as may reliability and completed
donations. An objective-reduction analysis on real data, by correlation or PCA, may show that
three genuinely independent objectives remain. If so, NSGA-II returns to its valid range and the
objection weakens considerably. This analysis should be done before any algorithm is fixed.

---

## 5. Objection three: the output has the wrong shape

NSGA-II returns a set of mutually non-dominated solutions. The seeker interface requires an
**ordered list** of donors to contact.

Converting a Pareto set into a ranking requires a scalarisation, which is precisely the step the
multi-objective treatment was adopted to avoid. The design would therefore return to a weighted
ranking after paying the full cost of an evolutionary search.

---

## 6. Objection four: non-determinism conflicts with auditability

An evolutionary algorithm is stochastic. Two runs on identical input can produce different
rankings.

For a clinical coordination system this is a genuine liability, not a technicality. The question
"why was this donor ranked third rather than first" needs a stable, reproducible answer, both for
user trust and for any future audit or ethics review. A deterministic exact method answers it; a
seeded metaheuristic only appears to.

---

## 7. The reformulation

CCP1 becomes a genuine optimisation problem as soon as donor choices **interact**. The natural
formulation is assignment of a shared donor pool across concurrent requests.

### Decision variables

```
x[i][j] in {0,1}    donor i is assigned to request j
```

### Constraints

```
sum over j of x[i][j] <= 1        each donor serves at most one request
sum over i of x[i][j] >= k[j]     each request receives enough donors
x[i][j] = 0                       where donor i is incompatible with request j,
                                  ineligible, or outside the service radius
```

### Objectives

1. **Fulfilment probability.** Each contacted donor may decline, so several are approached per
   request.
2. **Response time.** Minimise the maximum distance within an assigned set, not the sum. The
   slowest donor determines when the request is met.
3. **Donor burden and fairness.** Spread demand across the pool rather than repeatedly tapping
   the same donors.
4. **Universal-donor preservation.** Assigning O negative donors to an O positive recipient is
   locally acceptable and globally wasteful. This is a real blood-banking concern and creates a
   tension no per-donor scoring function can express.

Objectives 1, 3 and 4 couple decisions across requests. That coupling is the source of the
difficulty, and it is the part the current formulation is missing entirely.

---

## 8. The linearisation, and why it decides the method

The fulfilment objective appears non-linear and non-separable:

```
P(fulfil request j) = 1 - product over assigned i of (1 - p[i])
```

where `p[i]` is the donor's simulated response probability. This looks like a reason to reach for
a metaheuristic. It is not.

Maximising that expression is equivalent to minimising the product. Taking logarithms:

```
minimise  sum over i of  x[i][j] * log(1 - p[i])
```

which is **linear in x**. The objective linearises exactly, with no approximation.

The remaining objectives linearise as well:

- **Minimax response time.** Introduce an auxiliary variable t[j] with constraints
  `t[j] >= d[i][j] * x[i][j]`, then minimise t[j]. Standard minimax linearisation.
- **Donor burden.** A linear load term over a planning horizon, or a further minimax constraint.
- **Universal-donor preservation.** A linear penalty coefficient on assignments that spend a
  scarce group on a recipient who does not require it.

All four objectives are therefore linear in the decision variables.

### Structural consequence

The constraint matrix is a bipartite assignment structure, donors on one side, requests on the
other, with capacity limits. Each single-objective instance is a **min-cost flow** problem,
solvable exactly in polynomial time.

Sweeping the trade-offs with the epsilon-constraint method (Haimes et al., 1971) traces the Pareto
front by repeated exact solves. Each individual solve is exact, and every point returned is
genuinely Pareto-optimal.

**One correction, established during exploration.** The sweep returns the front *at the
resolution of the epsilon grid*, not the complete front. A coarse grid samples it sparsely, and
can make a metaheuristic appear to outperform the exact method on hypervolume. This matters only
if an exact baseline is revisited later; it is not part of the chosen method.

---

## 9. Does the exact method scale to the real problem?

This question decides the recommendation, so it should be answered with numbers rather than
assumption.

Realistic figures for a regional coordination system:

| Quantity | Estimate |
|---|---|
| Concurrent open requests | 20 to 50 |
| Compatible, eligible, in-radius donors per request | 200 to 500 |
| Resulting binary variables | roughly 10,000 to 25,000 |

An assignment model of that size, with a highly structured constraint matrix, is comfortably
within reach of free solvers such as CBC or HiGHS. It is not a difficult instance for modern
mixed-integer programming.

The honest conclusion follows directly: **at realistic scale this problem is exactly solvable,
and asserting that an evolutionary algorithm is required would be an overclaim.**

### This was measured during exploration

A prototype implementation was run across synthetic instances before the method was settled. A
single scalarised MILP solve against a full NSGA-III run of 100 generations:

| donors | requests | binary variables | exact (s) | status | NSGA-III (s) |
|---:|---:|---:|---:|---|---:|
| 40 | 2 | 80 | 0.07 | Optimal | 4.05 |
| 320 | 16 | 5,120 | 0.18 | Optimal | 9.74 |
| 640 | 32 | 20,480 | 1.30 | Optimal | 38.23 |
| 1,200 | 60 | 72,000 | 3.68 | Optimal | 139.42 |

**No crossover point was found in the range tested.** CBC proves optimality on a 72,000-variable
instance in under four seconds, while NSGA-III takes over two minutes to produce an
approximation. Exact solving is roughly 38 times faster at the largest size, and the gap widens
with instance size rather than closing.

The caveat worth stating: these synthetic instances have randomly placed donors and generous
compatibility, which keeps the LP relaxation tight. Real instances with tight geographic
clustering and scarce rare groups may be harder, so the claim should be re-tested once real data
exists.

---

## 10. Where a metaheuristic does earn its place

Naming these cases precisely is what distinguishes an informed method choice from a default one.
A population-based method becomes the right tool when:

1. **Instance size grows beyond exact tractability.** National scale, tens of thousands of active
   donors and hundreds of concurrent requests.
2. **Objectives stop linearising.** Robust or chance-constrained formulations with many scenarios;
   correlated donor responses that break the independence assumption behind the log transform.
3. **The horizon becomes multi-period.** Donor cooldowns modelled across weeks, where today's
   assignment constrains next month's feasible set and the model grows quickly.

These are the conditions under which the project should present a heuristic, and they can be
stated and tested rather than assumed.

---

## 11. Recommended method stack

| Role | Method | Rationale |
|---|---|---|
| Primary | Epsilon-constraint over min-cost flow or MILP | Exact, deterministic, auditable, fast at realistic scale. Provides ground truth. |
| Comparator | NSGA-III | Reference-point selection is the documented remedy for many-objective loss of selection pressure (Deb and Jain, 2014). |
| Optional second comparator | MOEA/D | Decomposition-based, scales well, nearly free to add once the problem class is defined (Zhang and Li, 2007). |
| Baseline | Weighted-sum ranking | Already implemented in the prototype. Serves as the naive reference point. |

**NSGA-II is not recommended in any role**, because NSGA-III supersedes it for this objective
count at essentially equal implementation cost.

---

## 12. Evaluation plan

This is the strongest argument for the change. "We implemented NSGA-II and it produced a Pareto
front" cannot be evaluated: there is no baseline and no ground truth, so no testable claim.

The proposed stack yields a real research question with clean methodology:

> How closely does the metaheuristic approximate the exact Pareto front, and at what instance size
> does exact solving cease to be tractable?

**Measures**

- **Hypervolume** and **inverted generational distance**, computed against the exact front rather
  than against a reference approximation. This is an unusually strong position: most studies must
  approximate the true front, whereas here it can be computed.
- **Runtime as a function of instance size**, for both methods, to locate the crossover point at
  which the heuristic becomes necessary.
- **Three-way comparison**: weighted sum, exact multi-objective, metaheuristic. The first is
  already available from the prototype.

**Expected contribution.** A characterised crossover point between exact and heuristic solving for
multi-objective donor assignment, together with a quantification of what the weighted-sum baseline
systematically misses.

---

## 13. Implementation cost

**This section is historical.** It records the projections made before the method was chosen.
The delivered artefact is the TypeScript prototype; there is no Python module in this
repository.


All components are free and available in Python.

| Component | Tool | Estimated effort |
|---|---|---|
| MILP model | pulp or python-mip with CBC, or highspy | 1 to 2 weeks, mostly modelling |
| Min-cost flow | networkx.min_cost_flow | Days |
| NSGA-III, MOEA/D | pymoo | Days, one interface across algorithms |
| Front quality measures | pymoo.indicators (HV, IGD) | Days |

Because pymoo exposes several algorithms behind a common interface, once the problem class is
defined the algorithm comparison is close to free. That comparison is the evaluation chapter.

---

## 14. Effect on the existing prototype

**None.** No change is required to the proposal-stage proof of concept.

The prototype already labels its output as "Prototype Match Score, simulated matching output" and
presents optimisation as implementation-phase work. It makes no claim that this document
contradicts.

The per-request ranking layer in the prototype remains correct for its purpose. For a single
request, exact non-dominated filtering followed by an urgency-weighted ordering is fast,
deterministic and explainable, which is what a live request path needs. The optimisation problem
sits one level above it, in the allocation of a shared pool across concurrent requests.

This document affects the CCP1 definition in the **proposal**, not the prototype.

---

## 15. Open questions for the supervisor

1. **Does the department expect a metaheuristic specifically?** Some programmes read a MILP
   formulation as operations research rather than as artificial intelligence. If that is the
   expectation, invert the emphasis: present NSGA-III as the method and the exact model as the
   validation baseline. The work and the rigour are identical; only the framing changes.
2. **Is multi-request assignment within the intended project scope**, or should CCP1 stay at
   single-request granularity? If it stays single-request, the honest position is that CCP1 is a
   multi-criteria decision analysis problem rather than an optimisation problem, and should be
   described as such.
3. **Is real demand and donor data likely to be obtainable?** The objective-reduction analysis in
   section 4 needs it, and so does any meaningful evaluation.

---

## 16. Suggested answer if the question is raised at the defense

> The ranking layer in the prototype is deliberately not an optimiser. For single-donor scoring,
> exact non-dominated filtering is both faster and reproducible, so a metaheuristic would be the
> wrong tool. The optimisation problem sits one level up: allocating a shared donor pool across
> concurrent requests under response uncertainty, where the choices interact and the space is
> combinatorial. We are also aware that NSGA-II loses selection pressure beyond three objectives,
> so part of the implementation work is choosing between NSGA-III, MOEA/D, and an exact
> epsilon-constraint formulation, evaluated against the weighted-sum baseline the prototype
> already provides.

---

## References

- Deb, K., Pratap, A., Agarwal, S., and Meyarivan, T. (2002). A fast and elitist multiobjective
  genetic algorithm: NSGA-II. *IEEE Transactions on Evolutionary Computation*, 6(2), 182 to 197.
- Deb, K., and Jain, H. (2014). An evolutionary many-objective optimization algorithm using
  reference-point-based nondominated sorting approach, part I. *IEEE Transactions on Evolutionary
  Computation*, 18(4), 577 to 601.
- Zhang, Q., and Li, H. (2007). MOEA/D: a multiobjective evolutionary algorithm based on
  decomposition. *IEEE Transactions on Evolutionary Computation*, 11(6), 712 to 731.
- Ishibuchi, H., Tsukamoto, N., and Nojima, Y. (2008). Evolutionary many-objective optimization:
  a short review. *IEEE Congress on Evolutionary Computation*.
- Haimes, Y. Y., Lasdon, L. S., and Wismer, D. A. (1971). On a bicriterion formulation of the
  problems of integrated system identification and system optimization. *IEEE Transactions on
  Systems, Man, and Cybernetics*, 1(3), 296 to 297.

Citations should be checked against the originals before they enter the proposal.
