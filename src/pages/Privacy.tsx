import { useTranslation, Trans } from 'react-i18next';
import { t as tr } from '../i18n';
import { WorkspaceLink as Link } from '../components/WorkspaceLink';
import { PageHeading, Panel } from '../components/ui';
export function Privacy() {
  useTranslation();
  return (
    <>
      <PageHeading
        eyebrow={tr('privacy:privacyData')}
        title={tr('privacy:yourJournalClearlyExplained')}
        description={tr('privacy:whatThisPilotStoresWhyItStoresItAnd')}
      />
      <Panel title={tr('privacy:privateRecordsInAPublicSourceProject')} className="prose-panel">
        <p>{tr('privacy:teddMhenIsOperatedByTheOwnerOfThis')}</p>
        <p>{tr('privacy:savingACheckInSendsYourSelectedRatingsTraining')}</p>
        <p>{tr('habits:privacy')}</p>
        <p>{tr('personalization:privacy')}</p>
        <p>{tr('privacy:emailAddressesAreNotVerifiedInThisPilotNo')}</p>
      </Panel>
      <Panel title={tr('privacy:analysisImportsAndAdministration')} className="prose-panel">
        <p>{tr('privacy:relationshipCalculationsAndBayesianModelsRunInYourBrowser')}</p>
        <p>{tr('privacy:importFilesAreReadAndValidatedInYourBrowser')}</p>
        <p>{tr('privacy:theApplicationSAdministratorPanelExposesAggregateAccountCounts')}</p>
      </Panel>
      <Panel title={tr('privacy:cookiesAndBrowserStorage')} className="prose-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{tr('privacy:item')}</th>
                <th>{tr('privacy:purpose')}</th>
                <th>{tr('privacy:lifetime')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>{tr('privacy:hostTeddmhenSession')}</code>
                </td>
                <td>{tr('privacy:necessarySignInCookieHttponlySecureAndSamesiteLax')}</td>
                <td>{tr('privacy:upTo7DaysRevokedBySignOutRecovery')}</td>
              </tr>
              <tr>
                <td>{tr('privacy:cloudflareSecurityAccessCookies')}</td>
                <td>
                  <Trans
                    i18nKey="privacy:cloudflareMaySetSecurityCookiesTheLegacyOwnerMigration"
                    components={{ slot0: <code /> }}
                  />
                </td>
                <td>
                  {tr(
                    'privacy:cloudflareConfigurationAndSessionSettingsDetermineExpiryTheMigration',
                  )}
                </td>
              </tr>
              <tr>
                <td>
                  <code>{tr('privacy:teddmhenAppearanceV1')}</code>
                </td>
                <td>{tr('privacy:localStorageForAutoLightDarkAndOptionalApproximate')}</td>
                <td>{tr('privacy:untilChangedForgottenOrBrowserSiteDataIsCleared')}</td>
              </tr>
              <tr>
                <td>
                  <code>teddmhen.language.v1</code>
                </td>
                <td>{tr('privacy:languageStorage')}</td>
                <td>{tr('privacy:untilChangedForgottenOrBrowserSiteDataIsCleared')}</td>
              </tr>
              <tr>
                <td>
                  <code>{tr('privacy:teddmhenPrivacyNoticeV1')}</code>
                </td>
                <td>{tr('privacy:localStorageRememberingThatThisNoticeWasDismissedDismissal')}</td>
                <td>{tr('privacy:untilSiteDataIsClearedOrTheNoticeVersion')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>{tr('privacy:noAdvertisingCookiesAnalyticsSdksThirdPartyFontsOr')}</p>
        <p>
          <Trans
            i18nKey="privacy:seeCloudflareSCookieDocumentationAndAccessCookieDocumentation"
            components={{
              slot0: (
                <a
                  href="https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/"
                  target="_blank"
                  rel="noreferrer"
                />
              ),
              slot1: (
                <a
                  href="https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/"
                  target="_blank"
                  rel="noreferrer"
                />
              ),
            }}
          />
        </p>
      </Panel>
      <Panel title={tr('privacy:optionalLocationForAutomaticAppearance')} className="prose-panel">
        <p>{tr('privacy:appearanceUseDeviceLocationRequestsBrowserPermissionAfterYour')}</p>
        <p>{tr('privacy:yourBrowserOrOperatingSystemMayUseItsOwn')}</p>
      </Panel>
      <Panel title={tr('privacy:retentionDeletionAndExports')} className="prose-panel">
        <p>{tr('privacy:journalEntriesRemainInTheActiveDatabaseUntilYou')}</p>
        <p>
          <Trans
            i18nKey="privacy:deletedDataMayRemainInCloudflareRecoveryHistoryFor"
            components={{
              slot0: (
                <a
                  href="https://developers.cloudflare.com/d1/reference/time-travel/"
                  target="_blank"
                  rel="noreferrer"
                />
              ),
            }}
          />
        </p>
        <p>{tr('privacy:exportsAreDownloadedToADestinationYouChooseDeleting')}</p>
      </Panel>
      <Panel title={tr('privacy:hostingAndPilotLimits')} className="prose-panel">
        <p>{tr('privacy:cloudflareProcessesRequestsToServeTheApplicationAndMay')}</p>
        <p>{tr('privacy:thePilotHasNoSubscriptionChargeOrApplicationImposed')}</p>
        <Link className="text-link" to="/account">
          {tr('privacy:accountControls')}
        </Link>
      </Panel>
    </>
  );
}
