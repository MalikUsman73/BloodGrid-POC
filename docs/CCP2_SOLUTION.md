# CCP-2: Blood Demand Predictive Analysis

**Complex Computing Problem 2, its proposed solution, and the model training methodology**

BloodGrid, BS Software Engineering Final Year Project
Abdullah Tariq, Malik Usman, Rizwan Saeed
Supervisor: Dr. Isma ul Hassan, Software Engineering Department, FAST-NUCES

---

## 1. Problem statement

Blood banks currently respond to shortages after they occur. By the time a shortage is visible in
the inventory, the lead time needed to run a donor drive or to arrange stock from another bank has
already been lost.

CCP-2 is the problem of producing a forward view of demand that is accurate enough, and early
enough, to change what a blood bank does today.

**Formal statement.** Given historical demand records, learn a function that predicts demand per
blood group over a forecast horizon of *H* days, and convert that prediction into a shortage risk
signal that a blood bank can act on and that CCP-1 can consume.

The output has two consumers. A blood bank plans donor outreach and requests stock from other banks.
CCP-1 uses the risk signal to become more protective of blood groups that are forecast to run short,
as required by FR17.

---

## 2. Why this is a complex computing problem

**The quantity does not exist yet.** A database can report what demand was. No query returns what
demand will be. The system must learn a pattern from history and extrapolate it.

**The signal is weak and mixed.** Blood demand carries weekly seasonality driven by elective
surgery scheduling, annual seasonality, a slow trend, and irregular spikes from road traffic
incidents, seasonal disease outbreaks and mass-casualty events. These components overlap in a single
observed series and must be separated by the model rather than assumed.

**The rare cases matter most.** Average accuracy is not the goal. A model with excellent overall
error that misses every spike is worthless, because spikes are the only periods where a forecast
changes a decision. This makes the evaluation design as important as the model choice.

**Per-group granularity is mandatory.** Aggregate demand is not actionable, because blood groups are
not interchangeable. Forecasting must be per blood group, which fragments an already limited dataset
into eight series of unequal size.

---

## 3. Prediction target

### 3.1 Definition

```
y(g, t) = units of blood group g demanded during time bucket t
```

**Time bucket:** daily. Daily granularity retains weekly seasonality, which is the strongest
recoverable pattern in a short history. Weekly aggregation will be evaluated as a fallback if the
daily series proves too noisy.

**Series definition:** one series per blood group, giving eight series. Component-level splitting,
into whole blood, plasma and platelets, and location-level splitting will be added only if the
dataset supports them without leaving individual series too sparse to model.

**Forecast horizon:** *H* equal to 7 to 14 days. This is long enough for a donor drive or an
inter-bank request to be organised, and short enough to remain accurate given a limited training
history.

### 3.2 A distinction that affects correctness

Blood bank records commonly capture **units issued** rather than **units requested**. These are not
the same quantity, and the difference matters most in exactly the situation this project cares
about.

During a shortage, issued units are capped by available stock. Issued demand is therefore
**censored**: it understates true demand precisely during the shortage periods the model is meant to
predict. A model trained on issuance and described as predicting demand will systematically
under-forecast the peaks.

**Required action.** Establish which quantity the source data records before any modelling begins.
If only issuance is available, one of the following applies.

- Model issuance and describe the output accurately as forecast issuance, not forecast demand.
- Use unfulfilled request records, if they exist, to reconstruct an estimate of true demand.
- Document the censoring as a stated limitation on all reported results.

This item is listed first in the data questions in Section 4.2 because it changes what the model
means.

---

## 4. Data

### 4.1 Required schema

The minimum viable record set:

| Field | Type | Required | Purpose |
|---|---|---|---|
| `request_date` | date | Yes | Time index |
| `blood_group` | categorical, 8 values | Yes | Series key |
| `units_requested` | integer | Yes | Prediction target |
| `units_issued` | integer | Preferred | Enables censoring analysis, see Section 3.2 |
| `component` | categorical | Optional | Enables component-level modelling |
| `facility_id` | categorical | Optional | Enables location-level modelling |
| `request_type` | categorical | Optional | Distinguishes elective from emergency, a useful feature |

### 4.2 Questions to resolve with the data provider

1. Does the data record units requested, units issued, or both? (See Section 3.2.)
2. What date range is covered, and are there gaps?
3. Are unfulfilled or partially fulfilled requests recorded?
4. Is the data one facility or several?
5. Are components recorded separately?
6. What anonymisation is applied at source, and what is required of us?

### 4.3 Volume, and the decision rule it drives

Training history length constrains which models are defensible. This rule is fixed in advance so
that model choice is a consequence of the data rather than a preference.

| Available history | Models that are defensible | Models that are not |
|---|---|---|
| Under 6 months | Naive, seasonal naive, moving average, exponential smoothing | SARIMA with annual terms, gradient boosting on lag features, any deep model |
| 6 to 18 months | The above, plus SARIMA with weekly seasonality, plus gradient boosting | Annual seasonality, LSTM without strong justification |
| Over 2 years | All of the above, plus annual seasonality, plus LSTM | None excluded on volume grounds |

For reference, Belfarsi et al. (2025) reported error below two percent using ARIMA on 170 days of
synthetic data. [SOURCE-DERIVED, verified by direct fetch.] That establishes that a statistical
model is workable at modest scale in this domain and sets a realistic expectation for what a short
history can support.

### 4.4 Data acquisition status

**The team is in contact with a representative of a blood bank regarding real donation and demand
data. This data has not been received and its provision is not confirmed. [NOT CONFIRMED]**

No result in this project will be presented as validated on real operational data unless and until
that data is obtained. The plan below is designed so that the absence of real data reduces the
strength of the evidence without invalidating the method.

### 4.5 Synthetic data, the primary evidence base

Synthetic data is the planned primary evidence base, not a contingency. Real data, if it arrives, is
an upgrade.

The generator produces daily demand per blood group as:

```
y(g, t) = base(g) * weekly(t) * trend(t) * spike(t) * noise
```

| Component | Construction |
|---|---|
| `base(g)` | Proportional to published blood group distribution for the relevant population, so that group volumes are realistically unequal |
| `weekly(t)` | Day-of-week multipliers, higher on weekdays to reflect elective surgery scheduling |
| `trend(t)` | Slow multiplicative growth |
| `spike(t)` | Events at randomly timed intervals with a magnitude multiplier, representing traffic incidents, seasonal disease outbreaks and mass-casualty events |
| `noise` | Poisson or negative binomial, giving integer counts with realistic overdispersion |

**Conditions on use.** Generator parameters and the random seed are documented and version
controlled so results are reproducible. Every reported result derived from this data is labelled as
synthetic. Synthetic results are never described as real-world validation.

[REQUIRES VALIDATION: the blood group distribution used for `base(g)` must be taken from a citable
source for the relevant population, not assumed.]

---

## 5. Features

Statistical models such as SARIMA operate on the raw series and require no feature construction. The
machine learning candidates do. The feature set below is built once and shared across all machine
learning models so that the comparison between them is fair.

| Group | Features |
|---|---|
| Lag | `y(t-1)`, `y(t-2)`, `y(t-7)`, `y(t-14)`, `y(t-28)` |
| Rolling statistics | Mean, standard deviation, minimum and maximum over trailing windows of 7, 14 and 28 days, each shifted by one day |
| Calendar | Day of week, day of month, month, week of year, weekend flag |
| Event | Public holiday flag. Ramadan and Eid flags, which shift both donation supply and demand patterns locally and should not be left to the model to infer from a short history |
| Trend | Integer time index |
| Series identity | Blood group, encoded, when a single pooled model is used |
| Exogenous, optional | Scheduled procedure counts, local event flags, seasonal disease indicators, subject to availability |

**Leakage control.** Every rolling statistic is shifted by at least one period so that no feature
for day *t* contains information from day *t* or later. Any scaler or encoder is fitted on the
training partition only and then applied unchanged to validation and test. This is checked as an
explicit step, not assumed.

[REQUIRES VALIDATION: a citable source is needed for Ramadan and Eid effects on blood demand or
supply before this is presented as an established pattern rather than a modelling precaution.]

---

## 6. Pooled model or per-group models

Two structures are possible and both will be built, because the answer depends on the data.

**Per-group models.** Eight independent models, one per blood group. Simple and independently
interpretable. The weakness is that rare groups such as AB negative will have short, sparse series
and will train poorly.

**Pooled model.** One model across all groups, with blood group supplied as a feature. Rare groups
borrow statistical strength from common ones, which is the standard remedy for sparse related
series. The weakness is that group-specific behaviour can be diluted.

**Plan.** The pooled model is the primary candidate, with per-group models built as the comparison.
Whichever performs better on validation is selected, and the comparison is reported either way.
[RECOMMENDATION]

---

## 7. Model candidates

| Tier | Model | Role |
|---|---|---|
| Baseline | Naive, `ŷ(t+h) = y(t)` | Mandatory floor |
| Baseline | Seasonal naive, `ŷ(t+h) = y(t+h-7)` | Captures weekly pattern with no learning at all. This is the baseline that is genuinely hard to beat, and it is the honest reference point. |
| Baseline | Moving average | Simple smoothing reference |
| Statistical | Exponential smoothing, Holt-Winters | Handles trend and seasonality, very low data requirement |
| Statistical | SARIMA | Precedented in this domain at modest data scale |
| Machine learning | Gradient boosting, LightGBM or XGBoost | Handles calendar and exogenous features that statistical models cannot use easily. Precedented in a related donor-behaviour problem by Yeh et al. [SOURCE-DERIVED, verified] |
| Deep learning | LSTM | Included only if the volume rule in Section 4.3 permits it |

The seasonal naive baseline is emphasised deliberately. A common failure in student forecasting work
is to beat only the plain naive model, which is a trivially weak reference. Weekly seasonality is
the dominant pattern in this series, and any model that cannot beat seasonal naive has learned
nothing useful.

---

## 8. Training methodology

This section is the direct answer to the question of how the model will be trained.

### 8.1 Rule one: the split is chronological, never random

Random shuffling of a time series leaks future information into the training set and produces
accuracy figures that cannot be reproduced in deployment. All partitions are contiguous blocks in
time order.

**Holdout structure**, illustrated on two years of daily data:

| Partition | Proportion | Days, example | Use |
|---|---|---|---|
| Training | 70 percent | 1 to 511 | Fit model parameters |
| Validation | 15 percent | 512 to 620 | Model selection and hyperparameter tuning |
| Test | 15 percent | 621 to 730 | Final reporting, evaluated once |

The test partition is not examined during development. It is evaluated once, at the end, and the
number obtained is the number reported.

### 8.2 Rule two: validation uses rolling origin evaluation

A single train and validation split gives one estimate of accuracy from one point in time, which is
fragile on a short series. Rolling origin evaluation, also called walk-forward validation, simulates
repeated deployment.

**Procedure.**

1. Set an initial training window, for example the first 365 days.
2. Fit the model on that window.
3. Forecast the next *H* days.
4. Record the error against the actual values for those days.
5. Advance the origin by a step *s*, for example 14 days.
6. Expand the training window to include the newly revealed actuals.
7. Refit and repeat until the validation period is exhausted.
8. Aggregate the errors across all origins and report the mean and the spread.

**Expanding window against sliding window.** An expanding window grows the training set at each
step and is the appropriate choice when history is limited, which is expected here. A sliding window
of fixed length is preferable when the series has undergone a regime change and older data is
misleading. The expanding window is the default; the sliding variant will be tested if evidence of a
regime change appears.

The spread of errors across origins is reported alongside the mean. A model with a low average error
and high variance across origins is unreliable, and reporting only the average would conceal that.

### 8.3 Step by step training procedure

**Step 1. Data preparation.** Load records, aggregate to daily counts per blood group, and construct
a complete date index. Days with no recorded demand are genuine zeros and are filled as zero, not
dropped, because dropping them destroys the time index. Days missing due to a recording failure are
distinguished from genuine zeros where possible and are handled as missing rather than as zero.

**Step 2. Partitioning.** Apply the chronological split in Section 8.1 before any feature
construction, so that no transformation ever sees future data.

**Step 3. Feature construction.** Build the features in Section 5 on each partition, with rolling
windows computed within the training partition and carried forward. Fit encoders and scalers on the
training partition only.

**Step 4. Baseline evaluation.** Run naive, seasonal naive and moving average through the same
rolling origin protocol first. These numbers are the bar. Establishing them before any model is
trained prevents the outcome from being framed after the fact.

**Step 5. Candidate training.** Train each candidate in Section 7 under the rolling origin protocol
on the training and validation partitions.

**Step 6. Hyperparameter tuning.** Tune on validation performance only, using the rolling origin
protocol, with the test partition untouched. The search space is fixed in advance and recorded.

| Model | Parameters tuned |
|---|---|
| SARIMA | Orders (p, d, q) and seasonal orders (P, D, Q, s), selected by information criterion and confirmed on validation error |
| Gradient boosting | Number of estimators, learning rate, maximum depth, minimum samples per leaf, subsample ratio |
| LSTM | Sequence length, hidden units, layer count, dropout, learning rate, batch size, with early stopping on validation loss |

**Step 7. Model selection.** Select the candidate with the best validation performance under the
protocol in Section 9, applying the volume rule in Section 4.3 as a hard constraint on eligibility.

**Step 8. Final evaluation.** Refit the selected model on training plus validation, evaluate once on
the test partition, and report.

**Step 9. Reproducibility.** Fix and record random seeds, library versions, feature definitions and
hyperparameters so that the reported numbers can be regenerated.

---

## 9. Evaluation

### 9.1 Metrics

| Metric | Definition | Why it is included |
|---|---|---|
| MAE | Mean absolute error, in units of blood | Primary metric. Directly interpretable as units of blood off per day. |
| RMSE | Root mean squared error | Penalises large misses more heavily, which matters because large misses are shortages |
| WAPE | Sum of absolute errors divided by sum of actuals | Scale-free and comparable across blood groups of very different volume |
| Bias | Mean signed error | Detects systematic under-forecasting, which is the dangerous direction |

**Why MAPE is not used as a primary metric.** Mean absolute percentage error divides by the actual
value and is undefined when the actual is zero. Rare blood groups will have many zero-demand days,
so MAPE would be either undefined or dominated by near-zero denominators. WAPE is reported in its
place. MAPE may be reported as a secondary figure on high-volume groups only, with the limitation
stated.

### 9.2 Spike period performance, reported separately

Overall accuracy can be excellent while every spike is missed, because spikes are rare and
contribute little to an average. Spike performance is therefore reported as its own result and is
never averaged into the headline metric.

**Spike definition.** A day is a spike day for group *g* if demand exceeds the trailing rolling mean
by more than *k* standard deviations, with *k* fixed in advance. A percentile threshold will be
evaluated as an alternative definition.

**Spike metrics.**

| Metric | Meaning |
|---|---|
| Recall on spike days | Proportion of actual spikes the model flagged. Missing a spike is the costly error. |
| Precision on spike days | Proportion of flagged spikes that were real. Low precision causes alert fatigue and the signal gets ignored. |
| F1 | Balance of the two |
| Lead time | How many days ahead the spike was flagged. A correct flag with no lead time is useless. |
| MAE restricted to spike days | Error magnitude where it matters |

Lead time is the metric that determines whether the system delivers its stated benefit. A forecast
that identifies a spike on the day it happens has not helped anyone plan.

### 9.3 Comparison protocol

Every model, including the baselines, is evaluated on the same partitions, the same rolling origin
schedule and the same metrics. Stochastic models are run over multiple seeds with mean and standard
deviation reported.

The seasonal naive baseline is the pass or fail line. A model that does not beat it is not deployed,
and that outcome will be reported rather than concealed.

---

## 10. From forecast to actionable risk signal

A point forecast is not a decision. It is converted into a shortage risk signal.

### 10.1 Projected shortfall

```
projected_shortfall(g) = sum over t in [t0, t0+H] of forecast_demand(g, t)
                         - current_stock(g)
                         - expected_incoming(g)
```

where `expected_incoming(g)` covers scheduled donations and confirmed inbound transfers.

### 10.2 Risk level

The shortfall is normalised to a risk value in the range 0 to 1 and mapped to three operational
bands.

| Band | Condition | Blood bank action |
|---|---|---|
| Low | Projected supply comfortably covers forecast demand | Routine operation |
| Medium | Projected shortfall is positive but within a safety buffer | Plan donor outreach for the affected group |
| High | Projected shortfall exceeds the safety buffer | Initiate outreach and raise a stock request to other banks |

Band thresholds are tuned on validation to balance recall against alert fatigue, using the spike
metrics in Section 9.2. They are configurable per facility rather than fixed in code, since safety
buffers are an operational policy decision and not a modelling one.

### 10.3 Degraded mode

If the model is unavailable, or if drift monitoring in Section 11 shows it has degraded past the
seasonal naive baseline, the system falls back to a naive-driven risk signal and displays the
degraded status to the user. The matching path in CCP-1 continues to operate with the forecast term
disabled. This satisfies the non-functional requirement that forecasting failure must never block
the core request and matching flow.

---

## 11. Integration with CCP-1, satisfying FR17

FR17 requires that forecast output be consumable as a direct input to the donor matching function
rather than delivered as a separate report.

The risk value `risk(g)` produced in Section 10.2 enters the CCP-1 type-preservation objective
through the adjusted scarcity term:

```
S_adj(g) = (1 / max(epsilon, share(g))) * (1 + beta * risk(g))
```

When CCP-2 forecasts a shortage in a blood group, the scarcity weight for that group rises, the cost
of spending a donor from that group on a request with alternatives rises, and CCP-1 becomes more
protective of the group across every subsequent request.

The interface is a single coefficient. It is explainable without reference to either model's
internals, it requires no structural change to CCP-1, and setting `beta` to zero disables it
cleanly, which provides the control condition for the integration experiment.

**The integration experiment.**

| Condition | Configuration | Measured |
|---|---|---|
| Control | `beta` equal to zero, forecast ignored by matching | Universal-donor consumption rate, requests unserved for want of a compatible donor |
| Treatment | `beta` tuned, scarcity responds to forecast risk | The same measures |

This isolates the contribution of the forecast to matching outcomes. The result will be reported
whether or not it favours the treatment condition.

---

## 12. Retraining and drift

A forecasting model degrades as the process it models changes.

| Mechanism | Approach |
|---|---|
| Scheduled retraining | Refit on a fixed cadence, weekly or monthly, using all data available at that point |
| Drift monitoring | Track rolling MAE over a trailing window against a control limit set from validation performance |
| Automatic trigger | Breaching the control limit triggers an out-of-cycle retrain and raises a status flag |
| Safety floor | If the retrained model still fails to beat seasonal naive on recent data, the system reverts to the naive risk signal and reports degraded status |

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Real data is never provided | Synthetic data is already the planned primary evidence base. The method, the training protocol and the evaluation are unaffected; only the strength of the evidence changes, and that will be stated plainly. |
| Data records issuance rather than demand | Establish which quantity is recorded before modelling. Describe the output accurately. Document the censoring on all results. See Section 3.2. |
| History too short for the intended model | The volume rule in Section 4.3 is fixed in advance, so model choice follows the data rather than preference |
| Rare blood groups have sparse series | Pooled model in Section 6 allows rare groups to borrow strength from common ones |
| No model beats seasonal naive | Report the result honestly. Fall back to the naive-driven risk signal, which still delivers the CCP-1 integration and the blood bank planning view, at reduced accuracy. |
| Good average accuracy but spikes missed | Spike metrics in Section 9.2 are reported separately and are never averaged into the headline figure |
| Alert fatigue from over-flagging | Precision and lead time are first-class metrics; band thresholds are tuned on the precision and recall trade-off |
| Leakage inflates reported accuracy | Chronological splitting, shifted rolling features, and transformers fitted on the training partition only, checked as an explicit step |

---

## 14. Implementation

| Component | Tool |
|---|---|
| Data handling | pandas |
| Statistical models | statsmodels for SARIMA and exponential smoothing |
| Gradient boosting | LightGBM or XGBoost |
| Deep learning, if justified by data volume | PyTorch or TensorFlow |
| Rolling origin evaluation | scikit-learn `TimeSeriesSplit` as the basis, extended for a fixed forecast horizon |
| Experiment tracking | Version-controlled configuration files recording seeds, features and hyperparameters |

All components are free and available in Python.

---

## 15. Status of claims in this document

| Claim | Status |
|---|---|
| CCP-2 is per-blood-group demand forecasting over a 7 to 14 day horizon | TEAM-CONFIRMED |
| Real donation and demand data will be provided by a blood bank | NOT CONFIRMED, contact in progress |
| Synthetic data is the primary evidence base | TEAM-CONFIRMED |
| Belfarsi et al. achieved under two percent error with ARIMA on 170 days of synthetic data | SOURCE-DERIVED, verified by direct fetch |
| Yeh et al. applied gradient boosting successfully to a related donor-behaviour problem | SOURCE-DERIVED, verified |
| Pooled model will outperform per-group models | RECOMMENDATION, to be tested, not assumed |
| Chronological splitting and rolling origin evaluation | RECOMMENDATION, standard time series practice |
| Blood group distribution used in the synthetic generator | REQUIRES VALIDATION against a citable source |
| Ramadan and Eid affect blood demand or supply | REQUIRES VALIDATION against a citable source |
| Source data records demand rather than issuance | UNKNOWN, first question for the data provider |

---

## 16. References

Belfarsi, E. A., et al. (2025). [Full citation to be completed from the verified source record in
`audit/00_evidence_audit_report.md`.]

Yeh, et al. (2026), and Wu, et al. (2022). [Full citations to be completed from the verified source
record.]

Hyndman, R. J., and Athanasopoulos, G. *Forecasting: Principles and Practice.* Standard reference
for rolling origin evaluation and time series cross-validation.

**All citations must be checked against the originals before this document is incorporated into the
written proposal.**
