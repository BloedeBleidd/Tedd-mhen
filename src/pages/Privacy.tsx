import { WorkspaceLink as Link } from '../components/WorkspaceLink';
import { PageHeading, Panel } from '../components/ui';
export function Privacy() {
  return (
    <>
      <PageHeading
        eyebrow="PRIVACY & DATA"
        title="Your journal. Clearly explained."
        description="What this pilot stores, why it stores it, and what you can remove. Updated 14 October 2026."
      />
      <Panel title="Private records in a public-source project" className="prose-panel">
        <p>
          Tedd’mhen is operated by the owner of this deployment on their Cloudflare account. The
          source code is public; your journal entries are not. Each account can access only its own
          records. The operator and authorized Cloudflare administrators can administer the
          database; this is not end-to-end encrypted storage.
        </p>
        <p>
          Saving a check-in sends your selected ratings, training, sleep, physiology, symptoms,
          context labels, optional notes, date, time zone, and revision metadata to Cloudflare D1.
          Account records contain your email identifier, a salted password hash, a hash of your
          recovery code, and session records. Passwords and recovery codes are not stored as
          readable text.
        </p>
        <p>
          Email addresses are not verified in this pilot. No verification or reset emails are sent.
          Use a unique password and save your recovery code; possession of the code and email
          enables a password reset.
        </p>
      </Panel>
      <Panel title="Analysis, imports and administration" className="prose-panel">
        <p>
          Relationship calculations and Bayesian models run in your browser using your selected
          observations. Written notes are not used as model inputs. Downloaded model reports can
          contain selected measurements and labels, so treat them as personal data.
        </p>
        <p>
          Import files are read and validated in your browser. Confirmation saves the reviewed
          observations to your signed-in account. Imported data follows the same storage and
          deletion rules as manual check-ins. Source account IDs and revisions are not imported.
        </p>
        <p>
          The application’s administrator panel exposes aggregate account counts, journal JSON
          volume and recent activity. It does not display individual email addresses or journal
          contents. Infrastructure administrators still have database access as described above.
        </p>
      </Panel>
      <Panel title="Cookies and browser storage" className="prose-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Purpose</th>
                <th>Lifetime</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>__Host-teddmhen_session</code>
                </td>
                <td>
                  Necessary sign-in cookie. HttpOnly, Secure and SameSite=Lax in production. Journal
                  contents are not stored in it.
                </td>
                <td>
                  Up to 7 days; revoked by sign-out, recovery, password change or account deletion.
                </td>
              </tr>
              <tr>
                <td>Cloudflare security / Access cookies</td>
                <td>
                  Cloudflare may set security cookies. The legacy owner migration route also uses
                  Access cookies, including <code>CF_Authorization</code>; ordinary account sign-in
                  does not use Access.
                </td>
                <td>
                  Cloudflare configuration and session settings determine expiry; the migration
                  Access session is configured for 24 hours.
                </td>
              </tr>
              <tr>
                <td>
                  <code>teddmhen.appearance.v1</code>
                </td>
                <td>Local storage for Auto / Light / Dark and optional approximate coordinates.</td>
                <td>Until changed, forgotten, or browser site data is cleared.</td>
              </tr>
              <tr>
                <td>
                  <code>teddmhen.privacy-notice.v1</code>
                </td>
                <td>
                  Local storage remembering that this notice was dismissed. Dismissal does not
                  enable tracking or grant location permission.
                </td>
                <td>Until site data is cleared or the notice version changes.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          No advertising cookies, analytics SDKs, third-party fonts, or tracking pixels are added by
          this application. Blocking necessary cookies prevents sign-in. Clearing local preferences
          does not delete database records. The browser may separately cache public application
          files.
        </p>
        <p>
          See Cloudflare’s{' '}
          <a
            href="https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/"
            target="_blank"
            rel="noreferrer"
          >
            cookie documentation
          </a>{' '}
          and{' '}
          <a
            href="https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/"
            target="_blank"
            rel="noreferrer"
          >
            Access cookie documentation
          </a>{' '}
          for infrastructure cookies.
        </p>
      </Panel>
      <Panel title="Optional location for automatic appearance" className="prose-panel">
        <p>
          Appearance → Use device location requests browser permission after your click. Coordinates
          are rounded to two decimal places and saved only in this browser, separately from your
          journal. Sunrise and sunset are calculated on your device. This application does not send
          those coordinates to its API, database, or an external sun-time service.
        </p>
        <p>
          Your browser or operating system may use its own location provider to determine your
          position. There is no background location tracking. Update the saved location when
          travelling, or choose Forget saved location. Without a location, Auto follows your system
          appearance. Light and Dark override the solar schedule.
        </p>
      </Panel>
      <Panel title="Retention, deletion and exports" className="prose-panel">
        <p>
          Journal entries remain in the active database until you delete them. Delete individual
          days from Daily check-in, or delete your account and all entries from Account. Password
          changes and recovery invalidate previous sessions immediately; expired session rows are
          cleaned up when new sessions are created.
        </p>
        <p>
          Deleted data may remain in Cloudflare recovery history for the applicable retention
          window. D1 Time Travel currently retains up to 7 days on Workers Free or 30 days on
          Workers Paid. Manual migration backups are retained for at most 30 days unless an incident
          requires a documented exception. An infrastructure restore can bring back older records;
          the operator must review deletions before restoring service. See{' '}
          <a
            href="https://developers.cloudflare.com/d1/reference/time-travel/"
            target="_blank"
            rel="noreferrer"
          >
            Cloudflare’s recovery documentation
          </a>
          .
        </p>
        <p>
          Exports are downloaded to a destination you choose. Deleting data here does not remove
          downloaded files or copies shared elsewhere. No LLM is connected to Tedd’mhen; uploading
          an export to another service is your separate action. Shared synthetic demo records are
          stored in D1 under a technical owner without sign-in credentials. Anyone can explore them
          at /demo without an account. Your demo edits and imports stay only in this tab’s memory
          and disappear when you leave demo mode or reload; they never update your personal journal
          or the shared examples.
        </p>
      </Panel>
      <Panel title="Hosting and pilot limits" className="prose-panel">
        <p>
          Cloudflare processes requests to serve the application and may process IP addresses,
          security events and operational metadata under its policies. Authentication rate limits
          use short-lived hashed IP/email keys. Application error logs exclude credentials, recovery
          codes, and journal bodies. The database was provisioned in Cloudflare’s EEUR region; this
          is not a promise that all infrastructure processing stays in that region.
        </p>
        <p>
          The pilot has no subscription charge or application-imposed user-count cap. Storage,
          traffic and compute remain subject to Cloudflare quotas. For a data issue, contact the
          deployment operator privately; never put health records, passwords or exports into the
          public repository.
        </p>
        <Link className="text-link" to="/account">
          Account controls
        </Link>
      </Panel>
    </>
  );
}
