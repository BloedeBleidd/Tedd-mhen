import { DatabaseSync } from 'node:sqlite';
export function adapter(db: DatabaseSync): D1Database {
  let transaction = Promise.resolve();
  function prepare(sql: string, values: unknown[] = []) {
    const result = () => {
      if (/^\s*SELECT/i.test(sql) || /\bRETURNING\b/i.test(sql))
        return { results: db.prepare(sql).all(...(values as [])), meta: { changes: 0 } };
      const response = db.prepare(sql).run(...(values as []));
      return { results: [], meta: { changes: Number(response.changes) } };
    };
    return {
      bind: (...params: unknown[]) => prepare(sql, params),
      all: async () => result(),
      run: async () => result(),
      first: async (column?: string) => {
        const row = db.prepare(sql).get(...(values as []));
        return row ? (column ? row[column] : row) : null;
      },
    };
  }
  return {
    prepare,
    batch: async (statements: { all: () => Promise<unknown> }[]) => {
      const previous = transaction;
      let release!: () => void;
      transaction = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      db.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.all());
        db.exec('COMMIT');
        return results;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      } finally {
        release();
      }
    },
  } as unknown as D1Database;
}
