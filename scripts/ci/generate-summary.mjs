import fs from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function formatStatus(outcome) {
  switch (outcome) {
    case 'success': return '✅ Passed';
    case 'failure': return '❌ Failed';
    case 'skipped': return '⚪ Skipped';
    case 'cancelled': return '⏹️ Cancelled';
    default: return `❓ Unknown (${outcome})`;
  }
}

export function formatPreflight(outcome) {
  switch (outcome) {
    case 'success': return '✅ Current & Verified';
    case 'failure': return '❌ Failed';
    case 'skipped': return '⚪ Skipped';
    case 'cancelled': return '⏹️ Cancelled';
    default: return `❓ Unknown (${outcome})`;
  }
}

export function getUnitDetails(outcome, tapContent = null) {
  let label = 'Unit Test Suite';
  let status = formatStatus(outcome);

  if (outcome === 'success' && tapContent) {
    const testsMatch = tapContent.match(/^# tests (\d+)$/m);
    const passMatch = tapContent.match(/^# pass (\d+)$/m);
    const failMatch = tapContent.match(/^# fail (\d+)$/m);
    if (testsMatch && passMatch && testsMatch[1] === passMatch[1] && (!failMatch || failMatch[1] === '0')) {
      label = `Unit Test Suite (${testsMatch[1]} tests)`;
      status = '✅ All Passed';
    }
  }

  return { label, status };
}

export function buildSummary(env = process.env, tapContent = null) {
  const { label: unitLabel, status: unitStatus } = getUnitDetails(env.OUTCOME_UNIT, tapContent);

  return [
    '### 🚀 Fast CI Check Results',
    '| Check | Status |',
    '|---|---|',
    `| Dependency Installation | ${formatStatus(env.OUTCOME_INSTALL)} |`,
    `| Critical Linting | ${formatStatus(env.OUTCOME_LINT)} |`,
    `| Database Migrations | ${formatStatus(env.OUTCOME_MIGRATE)} |`,
    `| Database Schema Preflight | ${formatPreflight(env.OUTCOME_PREFLIGHT)} |`,
    `| ${unitLabel} | ${unitStatus} |`,
    '',
  ].join('\n');
}

export function writeSummary(env = process.env, rootDir = process.cwd()) {
  let tapContent = null;
  if (env.OUTCOME_UNIT === 'success') {
    try {
      tapContent = fs.readFileSync(resolve(rootDir, 'test-results', 'unit.tap'), 'utf8');
    } catch {
      // Omit count if artifact is unreadable
    }
  }

  const markdown = buildSummary(env, tapContent);
  const summaryPath = env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    fs.appendFileSync(summaryPath, markdown);
  } else {
    process.stdout.write(markdown);
  }
  return markdown;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeSummary();
}
