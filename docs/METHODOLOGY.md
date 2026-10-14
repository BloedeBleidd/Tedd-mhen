# Statistical methodology

Model identifier: `normal-inverse-gamma-linear-v1`.

## Purpose

The analysis estimates a within-person linear trajectory for one numerical metric over a selected calendar window. It reports the posterior slope, its uncertainty, the probability of a positive slope, and a short extrapolation. It does not estimate the causal effect of training, diagnose disease, or assign a validated readiness score. The current model uses time as its only predictor.

## Observations and preprocessing

One measurement per local journal date is used. Missing values are omitted without interpolation or imputation. Duplicate dates are rejected. Date gaps remain gaps on the chart; elapsed calendar time determines the design matrix. All filters are applied before fitting. Fourteen non-missing measurements are required to display a fit; this is a product threshold, not a statistical guarantee.

For a metric with fixed center `c` and scale `s`, define `z_i = (y_i − c) / s`. These values are declared in `shared/metrics.ts`, not estimated from the same data. They are computational prior scales, not population norms, target values, or healthy ranges. Time is `x_i = (day_i − midpoint) / 7`, where midpoint is halfway between the earliest and latest selected observation. The regression row is `[1, x_i]`.

## Likelihood and prior

```text
z | β, σ² ~ Normal(Xβ, σ² I)
σ² ~ InverseGamma(a₀ = 2, b₀ = 1)
β | σ² ~ Normal(m₀ = [0, 0], σ² V₀)
V₀ = diag(10, v)
```

InverseGamma uses density proportional to `(σ²)^(-a-1) exp(-b/σ²)`. The prior mean of `σ²` is `b₀/(a₀−1)=1`; its variance is not finite at `a₀=2`. Weekly slope variance multiplier `v` is 10 (weak shrinkage), 1 (regular, default), or 0.1 (strong). Conditional on noise, the prior favors a zero slope. The intercept favors the metric’s fixed center, with larger variance.

These are transparent starting priors, not clinically elicited priors. Compare settings before relying on a direction. The conjugate construction couples coefficient and residual uncertainty through `σ²`.

## Exact posterior

```text
Vₙ = (V₀⁻¹ + XᵀX)⁻¹
mₙ = Vₙ(V₀⁻¹m₀ + Xᵀz)
aₙ = a₀ + n/2
bₙ = b₀ + ½(zᵀz + m₀ᵀV₀⁻¹m₀ − mₙᵀVₙ⁻¹mₙ)
```

The implementation evaluates `bₙ` as a residual sum of squares plus prior penalty to reduce numerical cancellation. The 2×2 precision matrix is inverted analytically. There is no MCMC, random seed, or sampling error; no convergence diagnostic is implied.

For a new row `x*`, the average normalized response has a Student-t distribution with `2aₙ` degrees of freedom, location `x*mₙ`, and scale squared `(bₙ/aₙ) x*Vₙx*ᵀ`. A new individual observation instead has scale squared `(bₙ/aₙ)(1 + x*Vₙx*ᵀ)`.

Displayed intervals are equal-tailed 95% intervals using Student-t quantiles, transformed back to original units. The slope is reported in original metric units per week. `P(slope > 0)` is calculated from its marginal Student-t posterior. It does not mean “probability the person is healthier.”

## Charts and extrapolation

- Points are recorded observations.
- The line is the posterior expected trajectory.
- The darker band is the 95% credible interval for the mean.
- The lighter band is the 95% predictive interval for a single observation.
- The forecast boundary is the last observed date. Horizon is 0, 3, or 7 days after that date, even when the most recent observation is old.

The Gaussian model has unbounded support. Ratings, physiological values, and training load do not. Intervals are intentionally shown without clipping or relabeling them as bounded probabilities. A warning appears if the predictive interval exceeds the declared physical/input scale. A future ordinal or positive-valued likelihood would be more appropriate for some metrics.

## Assumptions and failure modes

The fit assumes a stable linear trajectory, independent approximately Gaussian residuals, and constant residual variance. Daily health data can have nonlinear changes, outliers, seasonality, serial dependence, measurement error, and missingness related to illness or fatigue. A wider or narrower window can change a slope. Testing many metrics/windows invites selective interpretation.

The lag-one residual correlation uses only pairs on consecutive calendar days and requires seven such pairs. Its magnitude above 0.3 produces a warning. This is a descriptive diagnostic with a heuristic threshold; it neither tests independence conclusively nor adjusts interval widths.

Do not pool rMSSD and SDNN as if they were the same measurement. Device scores are vendor-dependent. Use the source and HRV-method filters. Excluding illness conditions on a user-selected subset and can introduce selection bias; unknown illness is not equivalent to zero severity.

## Validation and reproducibility

Unit tests compare the conjugate posterior to independently hand-derived sufficient statistics and a known Student-t quantile. Other tests cover constant series, genuine elapsed time with gaps, prior shrinkage, predictive versus credible widths, physical-bound warnings, duplicate dates, and minimum sample handling. Schema/API tests cover missingness and zero semantics.

The model download contains the model version, settings, observations, prior, posterior parameters, diagnostics, and curve values. This supports independent reproduction. These computational tests do not establish out-of-sample forecasting calibration or clinical validity. Prospective calibration, temporal holdout evaluation, ordinal likelihoods, and autocorrelated-error models are future work.

## Primary reference

Kevin P. Murphy, [Conjugate Bayesian analysis of the Gaussian distribution](https://www.cs.ubc.ca/~murphyk/Papers/bayesGauss.pdf), 2007, explains the Gaussian conjugate families, parameterizations, and Student-t predictive distributions. The regression specialization and every parameter used by this application are explicitly specified above and in `shared/bayes.ts`.
