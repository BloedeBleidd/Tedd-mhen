# Statistical methodology

Tedd’mhen analyzes observations from one account. It distinguishes descriptive association, a conditional model estimate, and a prediction evaluated on later data. None establishes causation, diagnosis, treatment benefit, longevity, or injury risk.

## Data alignment and missingness

A journal date identifies a local day; sleep belongs to its waking date. A predictor at date `d` and outcome at `d + L` are paired by actual calendar dates, never by row position. Training Monday and sleep Tuesday describe the night after Monday’s training. Same-date sleep normally precedes that day’s training; intra-day ordering and separate sleep episodes are not measured.

Date, illness, source, HRV-method, training-status and context filters restrict both predictor and outcome days. Missing and excluded dates remain missing. Numeric trailing means require all 7 or 28 calendar days ending at the predictor date; no interpolation or zero filling occurs. Binary labels use the predictor date, not a rolling average. A selected period supplies its own history, so early windows without enough preceding selected dates are unavailable.

Context labels use `1` for listed, `0` for explicitly recorded context without that label, and missing for unrecorded context. Activity indicators likewise require known training/rest status. A symptom not listed is not proof of clinical absence. See [field definitions](DATA_DICTIONARY.md).

## Correlations

Model identifier: `calendar-paired-correlations-v1`.

For paired vectors, Pearson correlation is:

```text
r = Σ(xᵢ − x̄)(yᵢ − ȳ) / √[Σ(xᵢ − x̄)² Σ(yᵢ − ȳ)²]
```

Spearman correlation is Pearson correlation of average ranks; ties receive their average rank. Both lie in `[-1,1]` and are undefined for a constant variable. Pearson with one binary variable is the point-biserial correlation. A minimum of 14 valid pairs is a display threshold, not an adequacy guarantee.

Available perspectives:

- **Levels:** pair recorded values.
- **Changes:** pair `x(d) − x(d−1)` with the corresponding outcome change; both consecutive dates must exist.
- **Detrended:** regress each aligned vector on an intercept and elapsed calendar days, then correlate residuals. This removes linear co-trending only.
- **7/28-day means:** pair complete trailing numeric means; overlapping windows share observations.

Rankings sort absolute coefficients for one outcome, lag and selection. Counts can differ between candidates; ranks are not directly comparable evidence of causal importance. Lag scans and repeated filtering create a multiple-comparison problem. The interface supplies no unadjusted significance stars or “causal winner.”

### Approximate block-bootstrap intervals

Selected-pair intervals use 200 circular calendar-block replicates. Construct a calendar grid from the first to last valid pair, retaining empty slots. Sample block start positions uniformly, concatenate blocks to the original grid length, retain present pairs, then recompute the selected coefficient. The seed is `20261014`; blocks are 7, 14 or 28 days and at least as long as the selected rolling window. The 2.5th and 97.5th percentiles form the displayed interval. Detrending is performed before resampling; these intervals condition on that transformation.

Intervals require 28 pairs, a calendar span of four blocks, and at least 90% valid replicates. This is a reproducible exploratory approximation under local stationarity, sensitive to block length, missingness, trends and the small number of blocks. It is not an exact confidence statement, a Bayesian credible interval, or an adjustment for searching many relationships. See [Pearson](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.pearsonr.html), [Spearman](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.spearmanr.html), and the [time-series bootstrap reference](https://stat.ethz.ch/R-manual/R-devel/library/boot/html/tsboot.html).

## Shared Bayesian regression mathematics

Both regression models use a Normal–Inverse-Gamma prior. For normalized outcome `z = (y − c)/s`:

```text
z | β, σ² ~ Normal(Xβ, σ² I)
σ² ~ InverseGamma(a₀ = 2, b₀ = 1)
β | σ² ~ Normal(0, σ² V₀)
V₀ = diag(10, v, …, v)
v = 10 (weak), 1 (regular), or 0.1 (strong shrinkage)
```

The inverse-gamma density is proportional to `(σ²)^(-a−1) exp(−b/σ²)`. Prior residual variance has mean 1 and nonfinite variance. Fixed outcome centers/scales in `shared/metrics.ts` are computational prior units, not population norms or healthy targets.

```text
Vₙ = (V₀⁻¹ + XᵀX)⁻¹
mₙ = Vₙ Xᵀz
aₙ = 2 + n/2
bₙ = 1 + ½[(z − Xmₙ)ᵀ(z − Xmₙ) + mₙᵀV₀⁻¹mₙ]
```

The residual-plus-prior form reduces cancellation. The single trend uses an analytic 2×2 inverse; the multivariable model uses a Cholesky factorization of positive-definite regularized precision. There is no MCMC or sampling convergence claim.

For a new design row `x*`, the normalized mean response has a Student-t distribution with `2aₙ` degrees of freedom, location `x*mₙ`, and squared scale `(bₙ/aₙ)x*Vₙx*ᵀ`. For an individual observation, squared scale is `(bₙ/aₙ)(1 + x*Vₙx*ᵀ)`. Equal-tailed 95% intervals use the Student-t 0.975 quantile and return to outcome units. Coefficient marginals yield `P(βⱼ > 0)`, conditional on the selected data, features and prior.

These distributions assume linearity, constant residual variance and independent Gaussian residuals. Uncertainty does not account for input measurement error, omitted variables, model selection or autocorrelated errors. Bounds are not clipped: ratings and physiological quantities can receive intervals outside their input scale, with an explicit warning. [Murphy’s conjugate-Gaussian derivation](https://www.cs.ubc.ca/~murphyk/Papers/bayesGauss.pdf) explains the distribution family; the implementation parameters are specified here.

## Single-metric trend

Model identifier: `normal-inverse-gamma-linear-v1`.

The design is `[1, (day − midpoint)/7]`, with the midpoint between the first and last observed selected dates. Fourteen observations are required. The slope and its credible interval describe outcome units per week. Extrapolation extends 0–28 calendar days after the last observation, including when that observation is old. The chart separates observations, posterior mean, mean uncertainty, and individual-observation uncertainty. The 14/28-day choices are exploratory extrapolations under the same linear model, not validated longer-range health forecasts. Extending the horizon changes the prediction coordinates, not the fitted posterior. Uncertainty grows with distance from the observed midpoint, but does not include future regime changes.

## Multiple-input direct prediction

Model identifier: `normal-inverse-gamma-multivariable-direct-v1`.

One selected numerical outcome is predicted from multiple numerical series, category indicators and context labels. It is a multivariable regression, not a joint multi-output causal system. For horizon `h ∈ {0,1,3,7,14,28}`, each row uses inputs available through origin day `d` to predict outcome on `d+h`. Numeric inputs can be that day’s value or a complete trailing 7/28-day mean. Clock-time sine/cosine pairs represent periodicity; weekday indicators use Monday as reference. Other category reference levels and missing semantics are in the dictionary.

The target metric is excluded from ordinary predictors. Optional outcome history uses `y(d)` for a future horizon and `y(d−1)` for same-day estimation. Optional linear calendar time adjusts for co-trending. A same-day fit requires that day’s other observations; it is not an advance forecast. No unknown future predictor is filled in or silently forecast. Each horizon is fitted directly from calendar-aligned origin/target pairs, rather than recursively feeding predictions back as observations. Longer horizons leave fewer observed pairs and require a longer separation for holdout evaluation. Interval widths across separately fitted horizons need not increase monotonically.

### Screening and scaling

Candidate screening uses the pre-holdout training period when it has at least 20 observed rows; otherwise it uses all observed rows and does not produce a valid holdout score. A feature is excluded and reported when it has fewer than 14 known values, less than 80% coverage, no variation, or (for binary inputs) fewer than five present/five absent observations. These are explicit product heuristics, not statistical guarantees. They can exclude rare but meaningful contexts; narrow the selection to comparable recorded periods when appropriate.

Remaining incomplete rows are excluded. At most 80 active inputs and at least `max(30, 2p)` complete observations are required, where `p` includes intercept and optional calendar trend. A feature becoming constant after complete-case selection blocks fitting rather than dividing by zero. Numeric and binary predictors are centered and scaled by observed standard deviation. Screening, scale estimation and time centering for validation use training information only. The final descriptive/forecast model is refitted on all complete selected observations with its own scales.

### Coefficients and prediction

The coefficient table displays outcome change per original input unit (or label `0→1`), its 95% marginal credible interval, and posterior sign probability. Ranking uses absolute change per one observed predictor standard deviation. It describes a conditional model association while other selected inputs are fixed. Correlated inputs can share or reverse coefficients; combinations implied by “holding others fixed” may not occur in the data. Proper shrinkage makes a fit numerically defined, not causally identified.

Only the latest recorded predictor date is used for the displayed conditional prediction. If required inputs are missing there, no prediction is substituted from an older date. The interface shows the input values, origin, target date, already-observed status and input-range violations. Historical fit and future prediction are distinguished.

### Chronological evaluation

The last 20% of observed outcome dates define a holdout. Training outcomes must be strictly earlier than the first holdout **origin**, preventing an overlapping horizon from leaking future outcomes. Training and holdout use the same screened input specification; no random split is used. Evaluation requires the fitting minimum in training and at least seven complete holdout rows.

Reported diagnostics:

```text
MAE = mean(|observed − predicted|)
RMSE = sqrt(mean((observed − predicted)²))
95% coverage = fraction of observations inside their predictive interval
```

Baselines predict either the training mean or the outcome known at the forecast origin (preceding day for same-day estimation). Persistence can have fewer eligible rows; both its count and model MAE on those same rows are shown. A small holdout’s coverage is descriptive, not validated calibration. Changing settings after seeing holdout results tunes to that holdout; confirm the chosen model on newly collected observations. See [regression forecasting](https://otexts.com/fpp3/regression.html) and [temporal evaluation](https://otexts.com/fpp3/toolbox.html).

### Predictive interval score and signed error

Evaluation identifier: `held-out-interval-score-v1`. The chronological holdout also reports mean signed error `mean(observed − predicted)`, mean predictive interval width and mean interval score. Positive signed error indicates underprediction; opposing errors can cancel, so it is shown alongside MAE.

For an equal-tailed `(1 − α)` interval `[l,u]` and observed value `y`:

```text
ISα(l,u;y) = (u − l) + (2/α)(l − y)1[y < l] + (2/α)(y − u)1[y > u]
α = 0.05; 2/α = 40
```

Lower is better. A wide interval incurs a width cost; an observation outside it incurs an additional distance penalty. Scores are averaged over the same held-out observations and remain in outcome units. Compare only matching outcomes, dates, horizons and interval levels. The finite holdout does not establish calibration or distinguish models reliably by itself. Missing dates are not filled and empty evaluations return no score. See Gneiting & Raftery (2007), equation 43, and the Winkler-score section of Hyndman & Athanasopoulos. Model reports include the evaluation version and `alpha`.

The held-out chart shows observations, training-model predictions and their predictive intervals. Its points were not used to fit that training model. The adjacent descriptive chart uses the refit on all selected complete rows and is labeled separately.

## Named methodological sources

- Kevin P. Murphy (2007), [Conjugate Bayesian analysis of the Gaussian distribution](https://www.cs.ubc.ca/~murphyk/Papers/bayesGauss.pdf). Conjugate Gaussian distribution family; the exact regression design and priors implemented here are specified above.
- Dimitris N. Politis and Joseph P. Romano (1992), _A Circular Block-Resampling Procedure for Stationary Data_, in _Exploring the Limits of Bootstrap_, pp. 263–270; [author publication list](https://mathweb.ucsd.edu/~politis/DPpublication.html). Basis for circular blocks; this application's handling of missing calendar slots and fixed block choices is an exploratory adaptation.
- Tilmann Gneiting and Adrian E. Raftery (2007), [Strictly Proper Scoring Rules, Prediction, and Estimation](https://doi.org/10.1198/016214506000001437), _Journal of the American Statistical Association_ 102(477), 359–378. Interval score, equation 43.
- Rob J. Hyndman and George Athanasopoulos, [Forecasting: Principles and Practice, third edition, chapter 5](https://otexts.com/fpp3/toolbox.html). Forecast errors, intervals, baselines and temporal evaluation. This application implements a fixed chronological holdout, not rolling-origin cross-validation.

These publications support mathematical methods, not the medical validity of this application, its self-report scales or its individual forecasts. Original publication titles remain in their source language; explanatory interface text is translated.

## Diagnostics, evidence and reproduction

Both models report consecutive-calendar-day residual correlation when at least seven residual pairs exist. Multivariable models flag predictor pairs with `|r| > 0.95`. These diagnostics do not correct intervals. HRV methods and vendor scores must remain comparable; category indicators are not device calibration.

Analysis downloads include versions, selections, exact paired/design observations, priors, scaling, posterior parameters, intervals, screening exclusions, bootstrap seed and held-out results as applicable. They contain personal data and are not journal-import files. All algorithms have reference and edge-case tests described in [Testing](TESTING.md). Computational correctness and synthetic forecast skill do not establish medical validity or accuracy for an individual’s real observations.

The [demo journal](DEMO.md) deliberately constructs noisy relationships among training, sleep, stress, illness and context. It uses the same analysis functions, missingness rules and uncertainty calculations as personal data. Its apparent associations and forecast errors illustrate the interface only; they provide no empirical evidence about health effects or model accuracy in real users.

## Historical check-in review

`shared/checkin-review.ts` implements `checkin-history-review-v1`, a review aid independent of Bayesian forecasting. Only the preceding 90 calendar days are eligible. The day being edited and all later days are excluded, including when editing old entries. The browser requests summary observations without notes. At least 30 comparable nonmissing measurements/pairs are needed for each check. Missing history or a failed request does not prevent saving a structurally valid entry.

For numeric values (including observed habit counts/durations, excluding cyclic clock coordinates), calculate the historical median `m` and median absolute deviation `MAD`. Flag a value only if:

```text
spread = max(MAD / 0.67448975, floor)
abs(value − m) > 3.5 × spread
```

For standard metrics the floor is one quarter of the fixed modeling scale in `shared/metrics.ts`; for custom/preset counts it is 1 event and for habit duration it is 5 minutes. Floors avoid unstable prompts from rounded or constant observations. They are product choices, not inferred measurement precision. The displayed `m ± 3.5 × spread` is a review band, not a healthy range or confidence interval, and is not clipped to physical bounds. HRV, resting heart rate, respiratory rate, temperature, weight and device sleep score require the same recorded measurement source; HRV additionally requires a known matching method. A shared source label still does not prove identical measurement conditions.

Eight fixed relationships are checked: stress→sleep hours (same date and one day later), training load→sleep hours (one day later), sleep hours→wellbeing and energy (same date), stress→fatigue and HRV (same date), and training load→soreness (one day later). Pairing uses actual calendar dates. A relationship needs all of:

- Absolute Pearson correlation ≥ 0.7 across eligible pairs.
- Correlation of the same sign and magnitude ≥ 0.5 in both chronological halves.
- Correlation of the same sign and magnitude ≥ 0.6 after removing separate linear time trends.
- The new predictor value inside the historical predictor range; no extrapolated notices.

For an eligible relation, ordinary least squares estimates `y = intercept + slope × x`. The nominal two-sided 99.5% individual prediction interval is:

```text
ŷ(x) ± t(0.9975, n−2) × sqrt(s² × [1 + 1/n + (x−mean(x))² / Sxx])
s² = max(SSE/(n−2), [outcome_scale/4]²)
Sxx = Σ(x_i−mean(x))²
```

A notice appears when the entered outcome lies outside that interval. This is not a Bayesian credible interval. Its nominal coverage assumes an appropriate linear model with independent, homoskedastic normal errors; diaries often violate those assumptions. Detrending and split-history gates do not establish stationarity, eliminate autocorrelation or validate coverage. Repeated screening and multiple metrics increase false notices; no family-wise error claim is made. Custom habits participate in the univariate review and manual relationship/model exploration, not an automatic scan of every possible pair.

The user reviews notices and confirms keeping the entered values, or edits them. Changing any entry value invalidates confirmation. Nothing is corrected, excluded, downweighted, diagnosed or prevented from being recorded after confirmation. Review acknowledgements are not stored as judgments about data quality. Imports perform structural validation but do not apply this interactive historical review. An absence of notices is not proof of correctness; real illness, schedule changes and new routines can legitimately depart from history.

The modified-Z labeling concept and 3.5 threshold follow the discussion of Iglewicz and Hoaglin in [NIST/SEMATECH, _Detection of Outliers_](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm). Our scale floors, history limits and relation gates are explicit application heuristics. Regression assumptions and serially correlated errors are discussed by Hyndman and Athanasopoulos in [_Forecasting: Principles and Practice_, Dynamic regression models](https://otexts.com/fpp3/dynamic-regression.html). Neither reference validates this application as a clinical or behavioral error detector.

Habit input identities, event-time encodings and missingness are specified in [Habits and custom activities](HABITS.md).
