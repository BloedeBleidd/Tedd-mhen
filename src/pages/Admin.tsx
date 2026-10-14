import { useLoad } from '../lib/api';
import { ErrorBox, Loading, PageHeading, Panel, number } from '../components/ui';
type Overview = {
  generatedAt: string;
  accounts: { accounts: number; joined7: number | null; joined30: number | null };
  journal: {
    entries: number;
    recordingAccounts: number;
    payloadBytes: number;
    earliestDate: string | null;
    latestDate: string | null;
    changed7: number | null;
  };
  sessions: { signedInAccounts: number };
  signups: { date: string; accounts: number }[];
};
export function Admin() {
  const { data, loading, error } = useLoad<Overview>('/api/admin/overview');
  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="The project, in numbers."
        description="Aggregate account and storage statistics. Private journal contents stay outside this panel."
      />
      <ErrorBox message={error} />
      {loading && <Loading />}
      {data && (
        <>
          <div className="analysis-stats">
            <div>
              <span className="stat-label">Registered accounts</span>
              <strong>{data.accounts.accounts}</strong>
              <p>
                {data.accounts.joined7 ?? 0} new in 7 days · {data.accounts.joined30 ?? 0} in 30
                days
              </p>
            </div>
            <div>
              <span className="stat-label">Journal entries</span>
              <strong>{number(data.journal.entries, 0)}</strong>
              <p>{data.journal.recordingAccounts} accounts have saved observations</p>
            </div>
            <div>
              <span className="stat-label">Journal JSON payload</span>
              <strong>
                {number(data.journal.payloadBytes / 1024 / 1024, 2)}
                <small> MiB</small>
              </strong>
              <p>
                {number(data.journal.payloadBytes, 0)} bytes · excludes database overhead and
                accounts
              </p>
            </div>
          </div>
          <Panel title="Activity and coverage">
            <dl className="method-glossary">
              <dt>Accounts with an unexpired session</dt>
              <dd>
                {data.sessions.signedInAccounts}. This is session validity, not a count of people
                currently online.
              </dd>
              <dt>Entries last changed in the past 7 days</dt>
              <dd>{data.journal.changed7 ?? 0}</dd>
              <dt>Recorded date range</dt>
              <dd>
                {data.journal.earliestDate ?? 'No entries'} →{' '}
                {data.journal.latestDate ?? 'No entries'}
              </dd>
              <dt>Snapshot generated</dt>
              <dd>{data.generatedAt}</dd>
            </dl>
            <p className="small muted">
              Queries are an operational snapshot, not billing measurements. Cloudflare’s dashboard
              is authoritative for storage overhead, request quotas and billing. Deleted
              accounts/entries are absent from these counts.
            </p>
          </Panel>
          <Panel title="Account creation · last 30 days">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>UTC date</th>
                    <th>Accounts created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.signups.map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td>{row.accounts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.signups.length && <p>No accounts created in this period.</p>}
          </Panel>
        </>
      )}
    </>
  );
}
