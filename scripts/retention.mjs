import '../packages/core/src/config/env.js';
import { parseArgs } from 'node:util';
import sql, { closeDatabase } from '../packages/database/src/client.js';
import { retainOperationalData } from '../packages/database/src/retention.js';
import { checkDatabaseReadiness } from '../packages/database/src/readiness.js';

try {
  const { values } = parseArgs({ options: {
    target: { type: 'string' }, apply: { type: 'boolean', default: false },
    'workspace-days': { type: 'string', default: '180' }, 'log-days': { type: 'string', default: '365' },
    limit: { type: 'string', default: '500' },
  } });
  const database = new URL(process.env.DATABASE_URL);
  if (!values.target || decodeURIComponent(database.pathname.slice(1)) !== values.target) throw Error('Explicit matching database target required');
  if (!(await checkDatabaseReadiness(sql.query)).healthy) throw Error('Current schema required');
  console.log(JSON.stringify(await retainOperationalData(sql.query, {
    apply: values.apply, workspaceDays: Number(values['workspace-days']), logDays: Number(values['log-days']), limit: Number(values.limit),
  })));
} catch {
  console.error('Retention rejected or failed; verify target, current schema and bounded policy. No credentials are included in this error.');
  process.exitCode = 1;
} finally { await closeDatabase(); }
