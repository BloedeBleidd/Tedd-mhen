import { MessageValue } from '../components/MessageValue';
import { useTranslation, Trans } from 'react-i18next';
import { t as tr, locale } from '../i18n';
import { useLoad } from '../lib/api';
import { ErrorBox, Loading, PageHeading, Panel, number, prettyDate } from '../components/ui';
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
  demo: { entries: number; payloadBytes: number };
};
export function Admin() {
  useTranslation();
  const { data, loading, error } = useLoad<Overview>('/api/admin/overview');
  return (
    <>
      <PageHeading
        eyebrow={tr('admin:administration')}
        title={tr('admin:theProjectInNumbers')}
        description={tr('admin:aggregateAccountAndStorageStatisticsPrivateJournalContentsStay')}
      />
      <ErrorBox message={error} />
      {loading && <Loading />}
      {data && (
        <>
          <div className="analysis-stats">
            <div>
              <span className="stat-label">{tr('admin:registeredAccounts')}</span>
              <strong>{data.accounts.accounts}</strong>
              <p>
                <Trans
                  i18nKey="admin:newIn7DaysIn30Days"
                  components={{
                    slot0: <MessageValue value={data.accounts.joined7 ?? 0} />,
                    slot1: <MessageValue value={data.accounts.joined30 ?? 0} />,
                  }}
                />
              </p>
            </div>
            <div>
              <span className="stat-label">{tr('admin:journalEntries')}</span>
              <strong>{number(data.journal.entries, 0)}</strong>
              <p>
                <Trans
                  i18nKey="admin:accountsHaveSavedObservations"
                  components={{ slot0: <MessageValue value={data.journal.recordingAccounts} /> }}
                />
              </p>
            </div>
            <div>
              <span className="stat-label">{tr('admin:journalJsonPayload')}</span>
              <strong>
                {number(data.journal.payloadBytes / 1024 / 1024, 2)}
                <small>{tr('admin:mib')}</small>
              </strong>
              <p>
                <Trans
                  i18nKey="admin:bytesExcludesDatabaseOverheadAndAccounts"
                  components={{
                    slot0: <MessageValue value={number(data.journal.payloadBytes, 0)} />,
                  }}
                />
              </p>
            </div>
          </div>
          <Panel title={tr('admin:sharedDemoJournal')}>
            <p>
              <Trans
                i18nKey="admin:syntheticDaysKibOfJsonTheseExamplesAreExcluded"
                components={{
                  slot0: <MessageValue value={number(data.demo.entries, 0)} />,
                  slot1: <MessageValue value={number(data.demo.payloadBytes / 1024, 1)} />,
                }}
              />
            </p>
          </Panel>
          <Panel title={tr('admin:activityAndCoverage')}>
            <dl className="method-glossary">
              <dt>{tr('admin:accountsWithAnUnexpiredSession')}</dt>
              <dd>
                <Trans
                  i18nKey="admin:thisIsSessionValidityNotACountOfPeople"
                  components={{ slot0: <MessageValue value={data.sessions.signedInAccounts} /> }}
                />
              </dd>
              <dt>{tr('admin:entriesLastChangedInThePast7Days')}</dt>
              <dd>{data.journal.changed7 ?? 0}</dd>
              <dt>{tr('admin:recordedDateRange')}</dt>
              <dd>
                {data.journal.earliestDate
                  ? prettyDate(data.journal.earliestDate)
                  : tr('admin:noEntries')}{' '}
                →{' '}
                {data.journal.latestDate
                  ? prettyDate(data.journal.latestDate)
                  : tr('admin:noEntries')}
              </dd>
              <dt>{tr('admin:snapshotGenerated')}</dt>
              <dd>
                {new Date(data.generatedAt).toLocaleString(locale(), { timeZone: 'UTC' })} UTC
              </dd>
            </dl>
            <p className="small muted">
              {tr('admin:queriesAreAnOperationalSnapshotNotBillingMeasurementsCloudflare')}
            </p>
          </Panel>
          <Panel title={tr('admin:accountCreationLast30Days')}>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{tr('admin:utcDate')}</th>
                    <th>{tr('admin:accountsCreated')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.signups.map((row) => (
                    <tr key={prettyDate(row.date)}>
                      <td>{prettyDate(row.date)}</td>
                      <td>{row.accounts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.signups.length && <p>{tr('admin:noAccountsCreatedInThisPeriod')}</p>}
          </Panel>
        </>
      )}
    </>
  );
}
