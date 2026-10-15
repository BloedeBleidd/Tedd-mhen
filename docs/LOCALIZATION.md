# Languages and canonical data

The interface supports English (`en`), Polish (`pl`), Spanish (`es`), German (`de`), French (`fr`) and Portuguese (`pt`). Source code, database identifiers, interchange schemas and technical documentation use English. User-authored notes, session titles, exercise names and context labels retain their original language and case. Context labels trim outer whitespace; narratives do not.

## Presentation architecture

`src/locales/<language>/<namespace>.json` contains authored, source-controlled messages. Namespaces follow pages and shared concerns: activities, enums, measurements, validation, account access, and application navigation. There is no translation service, runtime machine translation or DOM text replacement.

`src/i18n.ts` initializes i18next and react-i18next. English is the fallback; other languages are loaded on demand as complete bundles. A failed load leaves the last complete language active and exposes a retry action. Components subscribe to language changes without remounting the workspace, so drafts, active filters, unsaved edits and the temporary demo journal survive a language change. Rich sentences use named React slots through `Trans`; numeric slots preserve zero. Plural forms use a numeric `count`, never English suffix concatenation. See the [react-i18next component contract](https://react.i18next.com/latest/trans-component) and [i18next interpolation rules](https://www.i18next.com/translation-function/interpolation).

`localize` is a presentation adapter for application-owned English metadata and known backend messages. It must never receive arbitrary user notes or titles. Context feature labels translate only their fixed prefix. Structured API validation issues are rendered with localized field names and bounds. Canonical exports and model reports retain English keys, identifiers, units and method descriptions for reproducibility. Browser-owned file dialogs, date pickers and permission prompts follow browser/OS localization.

Numbers, dates and times use `Intl` with the active locale. Numeric storage stays numeric; switching languages never parses translated display labels back into data. Date-only journal values retain their calendar date rather than being converted across time zones.

## Defaults and permission

The globe beside Appearance opens language preferences. Its short entrance animation respects reduced motion. Manual language selection wins over location and is stored under `teddmhen.language.v1`. Auto is the default. Without a saved permitted location, or outside a supported suggested region, Auto uses English; the browser language and IP country are not substituted.

The location button requests browser permission only after a click. Appearance and language share the same approximate coordinates, rounded to two decimal places, under `teddmhen.appearance.v1`. Coordinates stay in the browser and are not sent to the application API, database or a geocoding service. The browser/OS location provider operates independently. Forgetting location removes the shared position; a reported permission revocation also clears it. There is no background location polling. Auto appearance uses local sunrise/sunset calculations, with light as its no-location fallback, irrespective of system dark mode.

The country lookup runs locally against bundled polygons, including holes and disconnected territories. It suggests a language rather than inferring nationality or personal preference. Multilingual countries necessarily need a manual override: Belgium and Luxembourg suggest French, while Switzerland and Canada fall back to English. Coastlines, borders, small territories and approximate device coordinates can produce an imperfect suggestion. Manual selection is always available.

## Map provenance

`src/data/language-regions.json` derives from Natural Earth 1:10m Admin 0 countries, [revision 9380cca83db5f9aef52d5e762765100745f84b27](https://github.com/nvkelso/natural-earth-vector/blob/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_10m_admin_0_countries.geojson). Natural Earth publishes its map data in the [public domain](https://www.naturalearthdata.com/about/). No personal location data is included in this file.

The source SHA-256 is `239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255`. `node scripts/build-language-map.mjs` fetches this pinned source, verifies the checksum, keeps the countries listed in its explicit suggestion table, rounds vertices to four decimals and writes the runtime artifact. The map is loaded only when a saved location needs resolution. It is not required to display the application in English or a manually chosen language.

## Activities and extension rules

`shared/activities.ts` is the single registry of 150 stable activity IDs and their groups. Existing IDs remain valid, including the original broad categories. Each activity has a display name in all six `activities.json` catalogs. The selector searches localized names without accents, groups results, and retains the current value while filtering. Strength disciplines expose sets and exercises through the shared `supportsSets` predicate. Analysis input pickers show only activity categories observed in the selected data; the definitions guide includes the full registry.

For example, `workouts[].type = "swimming"` displays as “Swimming”, “Pływanie” or “Schwimmen”. A user title containing “Swimming” remains unchanged. Imports validate IDs against the same registry; translated names are not accepted as identifiers. Adding activities is an additive schema-version-1 change and does not rewrite existing records.

To add copy, create a semantic key in the relevant namespace and author every translation in the same change. Keep whole sentences together, preserve interpolation/React slots, and use stable IDs in controls. To add an activity, update the registry and all six catalogs. To add a language, update the language type, loader, native name, locale mapping, complete catalogs and tests; country suggestions remain an independent product choice.

Tests check namespace/key/slot parity, metadata coverage, plurals, validation, canonical import round trips, Unicode notes, location geometry and language selection. Browser tests cover all six languages, mobile page widths, permission-controlled defaults, draft retention and activity switching. Statistical models continue to consume the same canonical values regardless of display language.

Habit presets use stable `preset:<English ID>` keys and six `habitCatalog.json` catalogs. Custom activity names remain original text associated with `custom:<UUID>` keys. Habit feature labels carry structured display metadata so a custom name matching an English phrase or containing interpolation-like characters is never looked up as interface copy. `habits`, `habitMetadata` and `checkinReview` namespaces hold editor, error, export and review messages. Counts/durations stay numeric; local event times stay canonical `HH:mm`. See [Habits](HABITS.md).
