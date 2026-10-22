#!/usr/bin/env node
import '../packages/core/src/config/env.js';
import { parseArgs } from 'node:util';
import { operateDatabase } from './lib/database-ops.mjs';

try {
  const { values } = parseArgs({ options: {
    target: { type: 'string' }, output: { type: 'string' }, mode: { type: 'string', default: 'verify' },
    'maintenance-confirmed': { type: 'boolean', default: false },
  } });
  const report = await operateDatabase({ databaseUrl: process.env.DATABASE_URL,
    restoreAdminUrl: process.env.RESTORE_ADMIN_DATABASE_URL, target: values.target,
    output: values.output, mode: values.mode, maintenanceConfirmed: values['maintenance-confirmed'] });
  console.log(`Database ${report.mode} complete; backup and verification evidence saved.`);
} catch (error) {
  // Database/tool failures are sanitized by the orchestrator; argument errors
  // also must not echo connection URLs supplied through environment variables.
  console.error(error.message.startsWith('Database operation failed during') ? error.message : 'Database operation rejected; check explicit target, mode, restore target, output, and maintenance confirmation.');
  process.exitCode = 1;
}
