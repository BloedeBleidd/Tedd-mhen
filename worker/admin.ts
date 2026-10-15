import { DEMO_OWNER } from '../shared/demo';

export async function isAdministrator(db: D1Database, userId: string) {
  return Boolean(
    await db.prepare('SELECT user_id FROM administrators WHERE user_id = ?').bind(userId).first(),
  );
}
export async function adminOverview(db: D1Database) {
  const results = await db.batch([
    db.prepare(
      `SELECT COUNT(*) AS accounts, SUM(created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days')) AS joined7, SUM(created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')) AS joined30 FROM auth_accounts`,
    ),
    db
      .prepare(
        `SELECT COUNT(*) AS entries, COUNT(DISTINCT owner_id) AS recordingAccounts, COALESCE(SUM(length(CAST(data AS BLOB))),0) AS payloadBytes, MIN(date) AS earliestDate, MAX(date) AS latestDate, SUM(updated_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days')) AS changed7 FROM entries WHERE owner_id <> ?`,
      )
      .bind(DEMO_OWNER),
    db
      .prepare(
        'SELECT COUNT(DISTINCT s.user_id) AS signedInAccounts FROM auth_sessions s JOIN auth_accounts a ON a.user_id=s.user_id AND a.version=s.account_version WHERE s.expires_at > ?',
      )
      .bind(Date.now()),
    db.prepare(
      "SELECT substr(created_at,1,10) AS date,COUNT(*) AS accounts FROM auth_accounts WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days') GROUP BY date ORDER BY date",
    ),
    db
      .prepare(
        'SELECT COUNT(*) AS entries, COALESCE(SUM(length(CAST(data AS BLOB))),0) AS payloadBytes FROM entries WHERE owner_id = ?',
      )
      .bind(DEMO_OWNER),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    accounts: results[0].results[0],
    journal: results[1].results[0],
    sessions: results[2].results[0],
    signups: results[3].results,
    demo: results[4].results[0],
  };
}
