import { BookOpen, ExternalLink, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { scaleDefinitions } from '../../shared/schema';
import { PageHeading, Panel } from '../components/ui';
export function Help() {
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE GUIDANCE"
        title="Better records. Better questions."
        description="How to use your journal and understand what the numbers can tell you."
      />
      <div className="help-intro">
        <BookOpen size={28} strokeWidth={1.3} />
        <div>
          <h2>Start small. Record consistently.</h2>
          <p>
            Take two minutes at a similar time each day. A handful of reliable observations is more
            useful than a detailed record you cannot sustain.
          </p>
        </div>
        <Link className="button primary" to="/check-in">
          Make a check-in
        </Link>
      </div>
      <div className="help-grid">
        <Panel title="01 · Make a daily check-in">
          <p>
            Pick the local date, select the ratings you actually observed, and record sleep and
            training. Sleep belongs to the date you woke up. Enter actual sleep duration separately
            from bedtime and wake time: time in bed is not time asleep.
          </p>
          <p>
            Choose <b>Rest day</b> when you did not train. Leave the training status{' '}
            <b>Not recorded</b> when you do not know. Blank measurements remain missing; zero is a
            recorded value. Notes are optional and are not used by the Bayesian model.
          </p>
          <p>
            Bedtime and wake time are local clock times; the app does not infer sleep duration
            across midnight or daylight-saving changes. Your entry stores an IANA time zone.
          </p>
        </Panel>
        <Panel title="02 · Keep your scales consistent">
          <p>
            These are project-defined self-report scales, not validated clinical instruments. Use
            the same interpretation each day; do not change the meaning halfway through a time
            series.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Low anchor</th>
                  <th>High anchor</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(scaleDefinitions).map((s) => (
                  <tr key={s.label}>
                    <td>{s.label}</td>
                    <td>
                      {s.min} · {s.low}
                    </td>
                    <td>10 · {s.high}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Sleep quality: 1 very poor → 10 excellent. Symptoms: 1 mild → 10 severe. Training
            effort: 1 very easy → 10 maximal. Training pain: 0 none → 10 extreme.
          </p>
        </Panel>
        <Panel title="03 · Understand training load">
          <p>
            Session load = duration in minutes × perceived effort. Daily load sums all sessions and
            is shown in arbitrary units (AU). If any session lacks an effort rating, the whole day’s
            load is unknown. An explicit rest day has a load of zero.
          </p>
          <p>
            This is a simple, project-defined tracking heuristic. It is not a validated readiness
            score and is not comparable across people or necessarily across sports.
          </p>
          <p>
            For strength training, add exercises with set count, repetitions, and weight. Group sets
            only when their repetitions and weight are the same; use another row for a different
            load.
          </p>
        </Panel>
        <Panel title="04 · Read a Bayesian trend">
          <p>
            The model combines a stated prior with your observations. It fits a straight line over
            calendar time using an exact Normal–Inverse-Gamma conjugate regression. At least 14
            non-missing observations of the selected metric are required.
          </p>
          <p>
            <b>95% credible interval:</b> uncertainty about the average trajectory, conditional on
            the model. <b>95% predictive interval:</b> a wider interval for one future observation,
            including day-to-day variability.
          </p>
          <p>
            <b>Probability of an increasing trend:</b> posterior probability that the slope is
            greater than zero. A higher metric is not always better. Forecasts extend at most seven
            days from the most recent measurement.
          </p>
        </Panel>
        <Panel title="05 · Know the limits">
          <p>
            The model assumes a linear pattern, approximately Gaussian noise, constant variance, and
            independent residuals. Daily health records often violate these assumptions. A residual
            lag-one correlation is a diagnostic, not a correction.
          </p>
          <p>
            Bounded ratings are treated as approximately continuous. Intervals are deliberately not
            clipped to the rating scale; boundary warnings make the mismatch visible. Select
            different priors and date windows to assess sensitivity.
          </p>
          <p>
            Changing devices, HRV methods, missing days, and excluding illness can alter results.
            Correlation and time trends do not establish cause. This is exploratory self-tracking,
            not diagnosis or medical advice.
          </p>
        </Panel>
        <Panel title="06 · Export exactly what you need">
          <p>
            Select your date window, data groups, and format. Written notes are excluded by default.
            Dates, time zones, revisions, and timestamps preserve context. JSON, NDJSON, and
            Markdown include a data dictionary; CSV uses dotted columns and JSON arrays for repeated
            items.
          </p>
          <p>
            NDJSON begins with a <code>_meta</code> line; subsequent lines are observations. Exports
            include recorded days only, in ascending date order. Missing days are not invented.
          </p>
          <p>
            No AI provider is connected to this application. Exported records are personal data:
            review your selection before using them elsewhere. The demo uses synthetic records and
            never saves them to your database.
          </p>
        </Panel>
        <Panel title="07 · Explore relationships">
          <p>
            Choose an outcome and compare other measurements on the same date or 1–28 calendar days
            earlier. Sleep belongs to the waking date: use a one-day lag to compare yesterday’s
            training with tonight’s recorded sleep. Daily values, day-to-day changes, detrended
            values and complete 7/28-day averages answer different questions.
          </p>
          <p>
            Pearson measures linear association; Spearman measures ranked association. Rankings
            require at least 14 paired observations. Calendar-block bootstrap intervals need more
            data and describe sampling uncertainty, not causality. Searching many comparisons can
            produce large correlations by chance. Check paired counts and compare different windows.
          </p>
          <Link className="text-link" to="/analysis/relationships">
            Explore relationships
          </Link>
        </Panel>
        <Panel title="08 · Predict with multiple inputs">
          <p>
            Choose an outcome, a same-day or 1/3/7-day horizon, and numeric or categorical inputs.
            Use all recorded dates or a filtered period. Context labels, activities and device
            categories become explicit binary predictors; written notes are not analyzed.
          </p>
          <p>
            The model shows conditional associations, uncertainty and a chronological holdout
            compared with simple baselines. Sparse or constant inputs are listed with exclusion
            reasons. All selected inputs must be observed on eligible rows; unknown values are not
            filled in. A 7-day prediction uses inputs available on its origin date, without
            inventing future training or sleep.
          </p>
          <p>
            Record labels consistently: unchecked context means unknown, while recording no labels
            means none applied. Read each feature’s definition and the model diagnostics before
            interpreting a coefficient as useful predictive evidence.
          </p>
          <Link className="text-link" to="/analysis/metrics">
            Definitions &amp; methods
          </Link>
        </Panel>
        <Panel title="09 · Import an existing journal">
          <p>
            Select a JSON, NDJSON or compatible CSV file, review its dates and supplied fields, then
            confirm the destination. Skip existing days preserves saved observations. Merge changes
            only supplied fields, including explicit nulls; omitted notes remain intact. JSON is the
            preferred archival format. Markdown and model reports cannot be imported as journal
            observations.
          </p>
          <p>
            Each day has its own revision check and result. A conflict or interruption can leave a
            partially completed import. Stop import prevents further rows; a save already sent can
            finish. Check results before retrying. Files accept up to 500 days / 20 MiB.
          </p>
          <Link className="text-link" to="/import">
            Import observations
          </Link>
        </Panel>
      </div>
      <Panel title="Private deployment & data ownership" action={<LockKeyhole size={19} />}>
        <p>
          Create an account with an email identifier and a unique password. Email addresses are not
          verified, and this pilot sends no email. Save your one-time recovery code in a password
          manager. Recovery and password changes replace the code and sign out older sessions.
          Account settings also let you sign out or delete your account and journal.
        </p>
        <p>
          Each account can access only its own records. The original owner can use the legacy
          migration link to keep their existing journal. See Privacy &amp; data for necessary
          cookies, Cloudflare database storage, retention, and exports.
        </p>
        <p>
          Appearance offers Light, Dark, and Auto. Auto uses sunrise and sunset after you choose Use
          device location and grant browser permission; without a location it follows your system
          theme. Approximate coordinates stay in this browser. Update them when travelling or choose
          Forget saved location. There is no background location tracking.
        </p>
        <p>
          See{' '}
          <a
            href="https://github.com/BloedeBleidd/Tedd-mhen/blob/main/docs/DEPLOYMENT.md"
            target="_blank"
            rel="noreferrer"
          >
            the deployment and backup guide <ExternalLink size={13} />
          </a>
          . Narrative fields support up to 50,000 characters each, with a 256 KiB daily request
          limit. D1 storage is finite; attachments are not supported.
        </p>
        <p>
          Authorized administrators can view aggregate account counts, journal volume and recent
          activity in Administration. This panel contains no individual journal entries or email
          lists. Read <Link to="/about">about Piotr Żmuda, the author</Link> and the interests
          behind the project.
        </p>
      </Panel>
      <Panel title="Methodology & primary references">
        <div className="reference-list">
          <a
            href="https://www.cs.ubc.ca/~murphyk/Papers/bayesGauss.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Kevin P. Murphy · Conjugate Bayesian analysis of the Gaussian distribution{' '}
            <ExternalLink size={14} />
          </a>
          <a
            href="https://github.com/BloedeBleidd/Tedd-mhen/blob/main/docs/METHODOLOGY.md"
            target="_blank"
            rel="noreferrer"
          >
            Model equations, priors, assumptions, and validation <ExternalLink size={14} />
          </a>
          <a
            href="https://developers.cloudflare.com/d1/platform/limits/"
            target="_blank"
            rel="noreferrer"
          >
            Cloudflare D1 · Storage and request limits <ExternalLink size={14} />
          </a>
        </div>
      </Panel>
    </>
  );
}
