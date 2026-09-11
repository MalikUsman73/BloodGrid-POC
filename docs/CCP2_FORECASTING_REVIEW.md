# CCP2 method review: training a demand forecasting model on real blood-bank data

**Status:** proposal for discussion with the supervisor. Nothing in the prototype changes as a
result of this document. See section 12.

Companion to [CCP1_ALGORITHM_REVIEW.md](CCP1_ALGORITHM_REVIEW.md).

---

## 1. Summary

The proposal names "a trained forecasting model" as the implementation-phase deliverable for
CCP2. This document works out what that actually requires once real data arrives from a blood
bank, and what should be promised in the proposal before that data is in hand.

Two problems determine the method choice, and neither is about algorithms. One is the length of
the series you will receive. The other is a data-quality issue that is easy to miss and that
undermines the entire purpose of the forecast if it is missed.

**Recommendation.** Commit to a comparative evaluation producing **quantile forecasts**, with a
seasonal-naive baseline, Prophet and gradient boosting as primary candidates, count-based models
for the rare blood groups, and deep sequence models explicitly excluded on grounds of series
length. Make model selection formally contingent on the data actually obtained.

---

## 2. What data will realistically arrive

Plan pessimistically, because this decides everything downstream.

A regional blood bank is most likely to provide:

- Spreadsheet exports, possibly one file per year, with inconsistent columns between years
- **Issuance** records rather than demand records (see section 3)
- Daily or monthly totals by blood group
- One to three years of history, probably with gaps
- Possibly transaction-level records (unit identifier, date issued, group, requesting department),
  which would be considerably better

**Do the arithmetic before choosing a method.** Two years of daily records is **730 observations
per blood group**. That single figure eliminates an entire class of methods, as section 4 shows.

---

## 3. Problem one: blood banks do not record demand

This is the most consequential point in this document.

A blood bank records **what it issued**, not **what was asked for**. On days when stock ran out,
true demand exceeded recorded issuance and the difference was never written down. The series is
therefore **censored from above**, and it is censored specifically during shortage periods.

Those are exactly the periods the forecast exists to anticipate.

Training on issuance while calling it demand produces a model that systematically underestimates
demand during shortages. The failure is silent, it does not show up in ordinary error metrics
computed on the same censored data, and it defeats the purpose of CCP2.

### Handling it, in order of preference

1. **Obtain stock-out records.** If the bank logs zero-stock days, mark those observations as
   censored and either fit with a censored likelihood (Tobit-style) or exclude them from training
   while documenting the resulting bias.
2. **Obtain unfulfilled or referred-out requests.** Some banks log requests they could not meet.
   Issuance plus unfulfilled requests reconstructs demand directly.
3. **Request cross-matched units rather than issued units.** Cross-match counts sit closer to
   clinical demand than issuance does.
4. **If none of these exist**, state the limitation explicitly and characterise the direction of
   the bias. A precisely stated known limitation is worth more than an unexamined assumption.

Related distinctions worth asking about, because they also separate issuance from demand:

- **Issued versus transfused.** Units returned unused inflate issuance.
- **Wastage and expiry.** Units discarded were issued but never met patient demand.

All of these belong in the data request in Appendix A, where they cost nothing to ask for.

---

## 4. Problem two: series length rules out deep learning

With roughly 730 observations per series:

- LSTM, Transformer, N-BEATS and similar architectures will overfit. This is not a risk to be
  mitigated by tuning; the data is an order of magnitude short of what they need.
- **Annual seasonality needs two to three complete years at minimum.** With one year of history
  you have observed a seasonal illness period exactly once. That is an anecdote, not an estimate.
- **Weekly seasonality is comfortable.** Three to six months is sufficient, and it is likely to be
  the strongest signal in the data (scheduled surgery on weekdays, trauma at weekends).

This is consistent with the published competition evidence. In the M4 and M5 competitions, pure
deep learning underperformed; statistical methods, gradient boosting, and hybrids of the two won.
Deep sequence models require either very long series or a large collection of related series, and
this project will have neither.

**State this exclusion in the proposal as a deliberate, justified choice.** "Deep sequence models
were excluded because n is approximately 730 per series" is a strong methodological answer.
Silence on the question reads as an oversight.

---

## 5. Problem three: the blood groups are not one forecasting problem

O positive will run at roughly 15 to 20 units per day: smooth, continuous, and well behaved by
any standard method.

AB negative may run at 0 to 2 units per day with many zero days. That is **intermittent demand**,
a different statistical object. Gaussian models fitted to it will produce negative point forecasts
and prediction intervals that include impossible values.

A single model class will therefore not serve all eight groups:

| Demand profile | Typical groups | Appropriate treatment |
|---|---|---|
| High volume, continuous | O+, A+, B+ | Standard time series or gradient boosting |
| Moderate, count-like | AB+, O- | Poisson or negative binomial regression |
| Intermittent, many zeros | A-, B-, AB- | Croston's method or a zero-inflated count model |

Handling the rare groups correctly is a genuine point of technical depth, and it is a
differentiator: most undergraduate forecasting projects fit one model to everything and report an
average error that hides the failure on the rare groups.

---

## 6. Method comparison

| Method | Fit for this problem | Verdict |
|---|---|---|
| **Seasonal naive** (same weekday, previous week) | Trivial to implement and difficult to beat | **Mandatory baseline.** Also the denominator of the headline error metric. |
| **SARIMA / SARIMAX** | Handles trend plus a single seasonality well. Weekly and annual seasonality together is awkward, and annual estimation needs several complete cycles. | Useful comparator, poor primary. |
| **ETS / Holt-Winters** | Same class of limitation as SARIMA | Comparator. |
| **TBATS** | Designed for multiple seasonal periods | Strong comparator if two or more years are obtained. |
| **Prophet** | Multiple seasonalities, native holiday effects, trend changepoints, tolerant of gaps and short series, produces intervals | **Primary candidate.** |
| **Gradient boosting** (LightGBM) with lag and calendar features | Frequently the strongest performer; quantile objective produces intervals directly | **Primary candidate**, subject to the caveat below. |
| **Croston / count models** | Required for the intermittent groups | Necessary for a subset of groups. |
| **LSTM, N-BEATS, TFT** | Require far more data than will be available | **Excluded**, with the justification in section 4. |

### Two details that decide between the primary candidates

**Prophet handles the holiday calendar correctly.** Major Pakistani holidays follow the lunar
calendar and shift by roughly eleven days each Gregorian year. A model keyed to day-of-year will
never learn them. Prophet accepts an explicit list of holiday dates, which is precisely the right
mechanism. Using gradient boosting instead means engineering those flags by hand, including
windows around each holiday rather than the single day.

**Tree-based models cannot extrapolate a trend.** Gradient boosting predicts by averaging values
observed in training leaves, so it structurally cannot output a value above the range it has seen.
If demand is growing, LightGBM will underpredict the future indefinitely. The remedies are to
detrend or difference the series before fitting, or to run a hybrid: Prophet or SARIMAX for trend
and seasonality, gradient boosting on the residual.

---

## 7. Forecast the distribution, not the mean

A point forecast is close to useless for the decision CCP2 actually supports.

Restocking to expected demand leaves the bank out of stock roughly half the time. What determines
safety stock is an upper quantile: **what is the 90th or 95th percentile of demand over the next
fourteen days?**

The deliverable should therefore be a **quantile forecast**:

- LightGBM fitted at several quantiles using the quantile objective
- Prophet's uncertainty intervals
- Quantile regression as a simple and highly explainable baseline

Evaluate these with **pinball loss**, not mean absolute error.

Two useful consequences for the project:

- The prototype's "illustrative range" becomes a genuine prediction interval, and can be
  relabelled honestly at that point.
- The shortage-risk rule stops being a threshold applied to a point estimate and becomes a
  probability statement: "there is an estimated 20 percent chance that demand over the next
  fourteen days exceeds available cover." That is a far stronger basis for a planning decision.

---

## 8. Evaluation protocol

This is where forecasting projects most often go wrong, and it is straightforward to get right.

### Validation

**Never use random k-fold cross-validation on time series.** Random splits train on future
observations to predict past ones and produce optimistic, meaningless scores.

Use **rolling-origin (walk-forward) validation**: fit on the first n days, forecast the next
fourteen, advance the origin, refit, repeat. Report the distribution of errors across origins.

Hold out the final period entirely and do not examine it until the evaluation is complete.

### Metrics

- **MASE (mean absolute scaled error)** as the headline figure. It is scale-free, it is defined
  when the series contains zeros (which the rare groups will), and it is scaled directly against
  the seasonal naive baseline. A MASE below 1 means the model beats the naive method; above 1
  means it does not, and that result should be reported plainly if it occurs.
- **MAE and RMSE** alongside, for interpretability in units.
- **Pinball loss** for the quantile forecasts.
- **Avoid MAPE.** It is undefined at zero, unstable near zero, and asymmetric in a way that
  rewards underforecasting.

### Report per horizon

One-day-ahead and fourteen-day-ahead accuracy are different quantities. The planning workflow
depends on the longer horizon, so report the error curve across the whole horizon rather than a
single averaged number.

### Report per blood group

An average across groups will hide poor performance on the intermittent ones. Report each group
separately, and state which model class was used for each.

---

## 9. Work that can start before the data arrives

Three items, all actionable now.

**Send the data request.** Appendix A is a specification that can go to the blood bank as it
stands. This has the longest lead time of anything in the project.

**Start the ethics and data-sharing process.** A data-sharing agreement or memorandum of
understanding, written confirmation that the records are aggregate and contain no patient
identifiers, and whatever institutional ethics approval is required. This is administrative
rather than technical, and it is usually the critical path.

**Build the evaluation harness against the existing simulated series.** The prototype already
contains a deterministic demand generator (`src/mock/demand.ts`). Point the rolling-origin
validation, the MASE and pinball implementations, and the per-group reporting at that generator
now. When real data arrives, only the data source changes and everything downstream already
works and has been tested.

This last point is worth emphasising: **most of the forecasting pipeline can be built and
validated before a single real record exists.** That substantially de-risks the schedule, because
the project no longer stalls if the data arrives late.

---

## 10. Recommended method stack

| Role | Method | Rationale |
|---|---|---|
| Baseline | Seasonal naive | Mandatory reference point and MASE denominator |
| Primary candidate | Prophet with a custom lunar holiday calendar | Multiple seasonalities, holiday effects, tolerant of short and gapped series |
| Primary candidate | LightGBM on a detrended series, quantile objective | Typically strongest accuracy, native quantile forecasts |
| Comparator | SARIMAX or TBATS | Classical reference, conditional on obtaining two or more years |
| Rare groups | Negative binomial regression or Croston's method | Correct treatment of intermittent count demand |
| Excluded | LSTM, N-BEATS, TFT | Series length, justified in section 4 |

**Output:** quantile forecasts at several levels, not point forecasts.

---

## 11. Implementation cost

All components are free and available in Python.

| Component | Tool | Estimated effort |
|---|---|---|
| Data cleaning and reconciliation | pandas | 1 to 2 weeks, and probably longer than expected |
| Seasonal naive baseline | pandas | Hours |
| Prophet | prophet | Days |
| Gradient boosting with feature engineering | lightgbm | 1 week |
| SARIMAX, ETS, TBATS | statsmodels, sktime | Days |
| Count and intermittent models | statsmodels, sktime | Days |
| Rolling-origin validation and metrics | Own code, or sktime | Days |

The data cleaning estimate is the one most likely to be wrong, and it is usually wrong in the
same direction. Inconsistent columns between yearly files, changes in recording practice
mid-series, and structural breaks from hospital capacity changes all take longer to resolve than
anticipated.

---

## 12. Effect on the existing prototype

**None.** No change is required to the proposal-stage proof of concept.

The prototype already labels its output as "Prototype forecast, simulated for proposal-stage
demonstration" and presents a trained model as implementation-phase work. It displays no accuracy
figure, no error metric, and no confidence level, and it captions its shaded band as an
illustrative range rather than a prediction interval. Nothing in this document contradicts what
the prototype claims.

The one forward-looking note is that the illustrative band becomes a genuine prediction interval
once quantile forecasting is implemented, at which point the caption can be changed honestly.

This document affects the CCP2 definition in the **proposal**, not the prototype.

---

## 13. Suggested proposal wording

Replace an unconditional promise of "a trained forecasting model" with a statement that is both
more accurate and more defensible:

> A comparative evaluation of forecasting methods for blood demand, producing quantile forecasts
> to support stock decisions, evaluated by rolling-origin validation against a seasonal-naive
> baseline using MASE and pinball loss. Model selection is conditioned on the granularity and
> length of the data obtained from the partner blood bank, and on whether stock-out records are
> available to correct for censoring in issuance data.

This is not hedging. Making model selection formally contingent on the data received is correct
methodology, and it protects the project if the bank supplies eighteen months of monthly totals
rather than three years of daily records.

---

## 14. Open questions for the supervisor

1. **Is a partner blood bank confirmed, and what has been agreed in writing?** Everything in this
   document depends on it.
2. **Does the department expect a neural or deep-learning component?** If so, the exclusion in
   section 4 needs to be discussed explicitly rather than assumed, and the argument should be
   presented in the proposal rather than discovered at the viva.
3. **Is quantile forecasting acceptable as the deliverable**, or does the marking scheme expect a
   point forecast with a stated accuracy figure? The former is more useful and more honest; the
   latter is more conventional.
4. **What is the fallback if data does not arrive, or arrives too thin?** One defensible option is
   to evaluate the full pipeline on realistic synthetic data with known ground truth, and report
   it as a methodological validation rather than an empirical result. That should be agreed in
   advance, not improvised.

---

## 15. Suggested answer if the question is raised at the defense

> The forecast in the prototype is a composed deterministic signal, not a trained model, and it
> reports no accuracy figure because none exists yet. For the implementation phase we are not
> committing to a single method in advance, because the appropriate method depends on what the
> data supports. With roughly two years of daily records per group we would have around 730
> observations, which is enough for weekly seasonality but marginal for annual, and well short of
> what deep sequence models require. So the plan is a comparative evaluation against a
> seasonal-naive baseline using rolling-origin validation and MASE, with Prophet and gradient
> boosting as the leading candidates and count-based models for the rare blood groups. We are also
> treating this as a quantile forecasting problem rather than a point forecasting one, because a
> stock decision depends on an upper quantile of demand rather than its mean. The main data risk
> we have identified is that blood banks record issuance rather than demand, so the series is
> censored during precisely the shortage periods the forecast is meant to anticipate, and part of
> the data request is aimed at correcting for that.

---

## Appendix A: Data request specification

Suitable for sending to the partner blood bank as it stands.

### Purpose

Academic research, final year project. Aggregate statistical analysis of blood demand patterns
only. No patient-level or donor-level information is required or wanted.

### Requested fields

**Essential**

| Field | Detail |
|---|---|
| Date | Daily granularity preferred. Monthly acceptable as a fallback. |
| Blood group | ABO and Rh, separately (A+, A-, B+, B-, AB+, AB-, O+, O-) |
| Units issued | Count per group per period |
| Period covered | The longest available history. Three or more years strongly preferred. |

**Important, for correcting known biases**

| Field | Why it is needed |
|---|---|
| Stock-out days, or days at zero stock, per group | Identifies censored observations, where true demand exceeded issuance |
| Unfulfilled or referred-out requests | Together with issuance, reconstructs true demand |
| Units cross-matched (as distinct from issued) | Closer to clinical demand than issuance |
| Units returned unused | Distinguishes issued from transfused |
| Units discarded or expired | Separates wastage from patient demand |

**Useful if available**

| Field | Why it is useful |
|---|---|
| Requesting department or ward | Separates scheduled surgical demand from emergency demand |
| Whether the request was elective or emergency | Two components with different dynamics |
| Any recorded change in recording practice, IT system, or hospital capacity | Explains structural breaks in the series |

### Format

Any of CSV, Excel, or a database export. Consistent column names across years would be helpful
but are not required.

### Privacy

No patient names, identifiers, ages, diagnoses, or record numbers. No donor identifiers. Aggregate
counts by date and blood group only. The data will be stored securely, used solely for this
project, and reported only in aggregate.

### Documents that can be provided on request

Data-sharing agreement, institutional ethics approval, and a supervisor's letter of support.

---

## Appendix B: Data quality checks to run on arrival

Run all of these before fitting anything. Each has caused a published forecasting error at some
point.

1. **Missing dates.** Reindex to a complete daily calendar and count the gaps. Distinguish "no
   demand" from "not recorded"; they are not the same and must not both become zero.
2. **Duplicate rows.** Check for repeated date and group combinations from overlapping exports.
3. **Structural breaks.** Plot each series in full and look for level shifts. A new ward, a new
   IT system, or a change in recording practice produces a step that will otherwise be modelled
   as trend.
4. **The COVID period.** 2020 and 2021 are likely to be severe anomalies in both directions
   (elective surgery suspended, then a backlog). Decide explicitly whether to exclude, flag with
   an indicator variable, or model separately. Do not let it pass unremarked.
5. **Group coding consistency.** Check that "O+", "O Positive", "OPos" and similar have been
   reconciled to one label.
6. **Impossible values.** Negatives, and outliers of an order of magnitude, usually indicate a
   unit or data-entry error.
7. **Zero runs.** Distinguish genuinely intermittent demand (section 5) from stock-out censoring
   (section 3). They look identical in the data and mean opposite things.
8. **Weekday profile.** Plot mean demand by day of week per group. If there is no weekly pattern
   at all, suspect that the data is aggregated or reconstructed rather than recorded daily.

---

## References

- Hyndman, R. J., and Athanasopoulos, G. (2021). *Forecasting: Principles and Practice*, 3rd
  edition. OTexts. Freely available online, and the standard reference for everything in
  sections 6 to 8.
- Hyndman, R. J., and Koehler, A. B. (2006). Another look at measures of forecast accuracy.
  *International Journal of Forecasting*, 22(4), 679 to 688. Introduces MASE.
- Taylor, S. J., and Letham, B. (2018). Forecasting at scale. *The American Statistician*, 72(1),
  37 to 45. Describes Prophet.
- De Livera, A. M., Hyndman, R. J., and Snyder, R. D. (2011). Forecasting time series with complex
  seasonal patterns using exponential smoothing. *Journal of the American Statistical
  Association*, 106(496). Describes TBATS.
- Croston, J. D. (1972). Forecasting and stock control for intermittent demands. *Operational
  Research Quarterly*, 23(3), 289 to 303.
- Makridakis, S., Spiliotis, E., and Assimakopoulos, V. (2020). The M4 competition: 100,000 time
  series and 61 forecasting methods. *International Journal of Forecasting*, 36(1), 54 to 74.
- Makridakis, S., Spiliotis, E., and Assimakopoulos, V. (2022). M5 accuracy competition: results,
  findings, and conclusions. *International Journal of Forecasting*, 38(4), 1346 to 1364.

Citations should be checked against the originals before they enter the proposal.
