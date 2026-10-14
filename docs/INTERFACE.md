# Interface and motion

The English interface uses shared color tokens for light/dark appearance, explicit form labels, anchored numeric scales, and visible keyboard focus. Main content has a skip link. Dialogs use native modal focus management. See [Data dictionary](DATA_DICTIONARY.md) for field semantics and [Data lifecycle](DATA_STORAGE.md) for local appearance preferences.

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
