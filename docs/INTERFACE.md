# Interface and motion

The six-language interface uses shared color tokens for light/dark appearance, explicit form labels, anchored numeric scales, and visible keyboard focus. Main content has a skip link. Dialogs use native modal focus management. See [Data dictionary](DATA_DICTIONARY.md) for field semantics and [Data lifecycle](DATA_STORAGE.md) for local appearance preferences.

## Language and activity controls

The animated globe sits beside Appearance and opens manual language selection or consent-based location use. Auto defaults to English and light without location. The device language and dark-mode preference do not replace these defaults. Both dialogs preserve active drafts and honor reduced motion. See [Localization](LOCALIZATION.md) for catalog structure, local geography and canonical storage.

Activity selection has an accent-insensitive search and grouped choices. The current choice stays visible while searching, so typing does not silently change a recorded activity. Strength disciplines expose exercise sets. Analysis pickers omit activity indicators absent from the selected observations.

## Account form feedback

Registration, sign-in, recovery and legacy-owner setup validate fields in the application, using the same email, password and recovery-code schemas as the server. Browser validation popovers are not required. Invalid fields show an associated explanation after blur or submission, expose `aria-invalid`, and are rechecked as the user edits. Submitting invalid values focuses and scrolls to the first invalid field and displays an alert above the submit button. No credential request is sent until local validation passes.

New passwords require 12–128 characters; a visible count reports progress toward the minimum. Sign-in preserves the existing-password rules. Confirmation and the registration privacy acknowledgement have their own messages. Server errors, including unavailable email identifiers and throttling, are brought into view without clearing entered values. Pending requests display “Please wait…”, lock account fields and navigation, and prompt before closing the tab. Navigation is released when the request finishes so a successful registration or recovery can show its one-time code.

## Analysis navigation

Analysis views appear before the page heading in a distinct bordered panel. Each view has an icon, a descriptive label and a large clickable card. The active card uses a contrasting fill and check mark, with `aria-current="page"`; keyboard focus remains visible. Supporting descriptions are associated with their links for assistive technology. Narrow layouts show all four choices in two columns without horizontal scrolling.

## Public entry and mobile layout

The public home page presents **Try demo** before registration. Account forms also link to `/demo`. The demo uses the full journal interface with a normal-flow banner above content offering sign-in and registration. Signed-in workspaces contain no demo switcher. See [Demo workspace](DEMO.md).

Mobile account inputs use 16 px text; primary form actions are at least 48 px tall. Buttons, field controls and account-access links have at least 44 px touch height. The navigation trigger exposes its expanded state and controls the mobile sidebar; closed navigation is excluded from keyboard focus. Open navigation traps keyboard focus, locks background scrolling, and closes with its close button, backdrop or Escape; focus returns to the trigger. Page navigation closes the drawer and returns the viewport to the top. The privacy notice follows the main content so it does not push first-use actions below the fold. Sticky check-in save actions respect the device's bottom safe area without reserving space for a floating demo control.

## Motion contract

Motion communicates appearance, selection and feedback. It never changes a measurement, uncertainty bound, prediction, ranking value or downloaded record.

- Panels reveal once when they enter the viewport, using a fade over 360 ms that keeps controls stationary. Focusing a control settles its panel immediately.
- Chart lines and uncertainty bands reveal horizontally over 640 ms. Observed points and correlation clouds fade over 360 ms at their final coordinates. Axes stay stationary. Native data interpolation is disabled, so switching metrics cannot morph old coordinates into new observations.
- Chart reveals restart for changed data or labels, not unrelated renders with identical content. New analysis jobs replace obsolete results independently of the animation.
- Headings, statistic cards, new workouts, labels, notices and disclosures use short entrance effects. Statistic-card delays are bounded to 135 ms. Buttons, navigation, calendar days and selections respond in 160–240 ms; hover movement applies only to devices with hover capability.
- Appearance dialogs fade and rise when opened. Closing, navigation, saving, validation and focus do not wait for an animation to finish. Numeric displays show their actual values immediately; they do not count through invented intermediate values.

The implementation uses CSS and the browser Web Animations API, without an additional animation library. An IntersectionObserver waits for viewport entry. A short-lived MutationObserver handles responsive charts whose SVG layers arrive after sizing. Observers disconnect after starting; animations and listeners are cancelled on unmount, data replacement, reduced-motion changes, focus and printing. Finished effects retain no hidden or transformed styles. Group-level SVG effects avoid creating a separate animation for every observation.

## Reduced motion and fallbacks

The system’s `prefers-reduced-motion: reduce` setting disables decorative CSS animations/transitions and JavaScript reveals, including chart-tooltip movement. Changes apply during an active session and cancel running effects. Loading text remains visible when its spinner stops. There is no additional preference stored in the account or browser.

Content is visible by default. Without the Web Animations API, panels and charts remain static while supported CSS interactions remain available; without IntersectionObserver, supported animations run when content is ready. Background documents skip reveals. Printing settles active reveals and disables CSS motion. No animation gates access to data or a form action.

Browser contracts: [reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion), [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver), and [Element.animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate). Lifecycle tests cover delayed SVG creation, one-time reveals, cancellation and fallbacks; browser tests check real SVG geometry, live preference changes, scrolling and reduced-motion first render.

## Discovery and recovery

Overview links directly to relationships, the multivariable model, import and export in both workspaces. Its date-window empty state checks the complete journal before suggesting a first entry; historical records remain accessible through Journal. Mobile navigation has a visible Menu label. Check-in section links lead to ratings, sleep and recovery, movement and training, preset habits, and custom activities without covering the form.

A failed initial session request displays an error with Retry; only an unauthorized response opens the public entry flow. A transient background connection failure preserves the open workspace and unsaved form only while its cached identity matches the current API identity. Explicit sign-out clears that identity immediately; unauthorized or changed-account responses discard cached session data. Check-in dates and page navigation are locked during a save, and tab closing prompts while edits or saves are pending. Invalid numerical fields and schema errors produce visible, focused alerts without relying on browser popovers. Failed loads can be retried without reloading the application.

Password changes validate length and confirmation explicitly. Recovery-code screens explain clipboard failures and guard navigation until acknowledgement; the user can explicitly confirm leaving without saving. Imports confirm leaving while requests are pending and report completed rows separately. Export controls stay fixed during preparation, and unavailable downloads explain the missing selection or date range.

Analysis filters report their active count and can be cleared together. Input selection names metrics and labels, caps selection at 180, and reports unavailable selected labels as excluded. Missing label observations are not converted to absence. Correlation comparison excludes the identical same-day outcome; lagged self-comparison remains available. Worker failures show a recoverable error, and new analysis settings immediately remove obsolete results.

## Analysis display and evidence

The mobile analysis navigation keeps four destinations visible in a compact two-column grid. Relationship and multivariable pages provide a direct link to results above the filters. Statistics retain their explanatory text. Chart-size selectors offer responsive Auto (240 px on mobile), Compact (220 px), and Large (480 px); resizing changes presentation only, preserving all observations and model selections. Time axes keep real calendar spacing. Numeric intervals use an explicitly spaced dash in all languages.

On wide screens the descriptive model fit and chronological holdout evaluation appear side by side; on phones they stack. The holdout chart distinguishes later observations, training-model predictions and 95% predictive intervals. Interval score, mean width and signed error supplement MAE, RMSE, coverage and baselines. Source links sit beside analysis results, with worked mathematical explanations and a bibliography in Definitions & methods, including authors, publication titles and scope limitations. Forecasts extend to 28 days with an explicit exploratory-horizon explanation; see [Methodology](METHODOLOGY.md).

## Personal check-in and compact definitions

A visible **Customize my check-in** control configures field visibility without writing a daily observation. Existing values override hidden-field preferences when editing their date. Clearing an enabled rating also hides its blank field on future days; the customization control restores it. Sleep and recovery share one section. Preset habits and the custom library have separate sections below movement and training.

Routine checkboxes remember activity identities while leaving future counts, times, durations and notes empty. Recent selections appear before unused choices; sport options retain their broader categories after a recent-choice group. Semantic choice lists use account usage history, while numeric horizons, scales and dates retain meaningful natural order. No choice order implies statistical or medical importance.

Definitions are collapsed by domain, with sports additionally grouped by the activity registry. Searching opens matching groups. Mathematics topics expose formulas, symbol definitions, examples and source links on demand rather than presenting an unbroken catalog. All explanatory copy is authored in six source catalogs.
