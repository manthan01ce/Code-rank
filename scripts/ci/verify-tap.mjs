// Validate Node's TAP reporter as a completed test gate, not just an exit code.
// Invocation metadata matters: --test-only output can be indistinguishable from
// an ordinary passing TAP stream, so callers must reject selection arguments.
export function verifyTap(tap, { exitCode = 0, signal = null, timedOut = false, args = [], expectedFiles = [] } = {}) {
  const errors = [];
  const reject = message => errors.push(message);
  if (timedOut) reject('Test subprocess exceeded its deadline');
  if (signal) reject(`Test subprocess terminated by ${signal}`);
  if (exitCode !== 0) reject(`Test subprocess exited with ${exitCode}`);
  if (args.some(arg => /^--test-(?:only|name-pattern|skip-pattern|shard)(?:=|$)/.test(arg))) reject('Focused or filtered test invocation is forbidden');
  if (typeof tap !== 'string' || !tap.trim()) return { ok: false, errors: [...errors, 'Empty TAP output'], counts: {} };
  const lines = tap.replace(/\r\n/g, '\n').split('\n');
  if (lines[0] !== 'TAP version 13') reject('Missing TAP version 13 header');
  if (/^\s*Bail out!/mi.test(tap)) reject('TAP bailout');
  if (/^# .*['"]only['"].*--test-only/m.test(tap) || /runOnly.*--test-only/.test(tap)) reject('Focused test declaration detected');
  const scopes = [];
  const activeScopes = new Map();
  const counts = {};
  const points = [];
  let rootPlanLine = -1;
  let diagnostics = false;
  let currentPoint;
  const scope = (indent, assertion = false) => {
    if (!activeScopes.has(indent) || (assertion && activeScopes.get(indent).plans.length > 0 && indent !== 0)) {
      const value = { indent, points: [], plans: [] };
      activeScopes.set(indent, value);
      scopes.push(value);
    }
    return activeScopes.get(indent);
  };
  for (const [index, line] of lines.entries()) {
    // Node writes untrusted console output as TAP comments. YAML diagnostics can
    // contain source snippets, so never parse apparent assertions inside YAML.
    if (/^\s+---$/.test(line)) { diagnostics = true; continue; }
    if (diagnostics) {
      if (/^\s+\.\.\.$/.test(line)) diagnostics = false;
      else {
        const type = line.match(/^\s+type: ['"]?(test|suite)['"]?$/);
        if (type && currentPoint) currentPoint.type = type[1];
      }
      continue;
    }
    const assertion = line.match(/^( *)(not ok|ok) (\d+)(?: - (.*))?$/);
    if (assertion) {
      const indent = assertion[1].length;
      const entry = { id: Number(assertion[3]), name: assertion[4] || '', type: null };
      scope(indent, true).points.push(entry);
      points.push(entry);
      currentPoint = entry;
      if (assertion[2] === 'not ok') reject(`Failed assertion: ${entry.name}`);
      if (/\s#\s*(?:SKIP|TODO)(?:\s|$)/i.test(entry.name)) reject(`Skipped or TODO assertion: ${entry.name}`);
      if (rootPlanLine >= 0) reject('Assertion appears after the final plan');
      continue;
    }
    const plan = line.match(/^( *)1\.\.(\d+)(?:\s+#(.*))?$/);
    if (plan) {
      const indent = plan[1].length;
      scope(indent).plans.push(Number(plan[2]));
      if (plan[3]) reject('Skipped or annotated test plan');
      if (indent === 0) { rootPlanLine = index; }
      continue;
    }
    const summary = line.match(/^# (tests|suites|pass|fail|cancelled|skipped|todo) (\d+)$/);
    if (summary) {
      if (Object.hasOwn(counts, summary[1])) reject(`Duplicate ${summary[1]} summary`);
      counts[summary[1]] = Number(summary[2]);
      if (rootPlanLine < 0) reject('Summary appears before the final plan');
      continue;
    }
    if (line && line !== 'TAP version 13' && !/^\s*#/.test(line)) reject('Unrecognized TAP protocol line');
  }
  if (diagnostics) reject('Incomplete TAP diagnostic block');
  if (!/^# duration_ms \d+(?:\.\d+)?$/.test(lines.filter(line => line.trim()).at(-1) || '')) reject('Missing final duration summary');
  if (!activeScopes.has(0)) reject('Missing root test plan');
  for (const value of scopes) {
    const { indent } = value;
    if (value.plans.length !== 1) reject(`Expected exactly one plan at indentation ${indent}`);
    else if (value.plans[0] !== value.points.length || value.plans[0] < 1) reject(`Empty or incomplete plan at indentation ${indent}`);
    if (value.points.some((point, index) => point.id !== index + 1)) reject(`Invalid assertion numbering at indentation ${indent}`);
  }
  for (const name of ['tests','suites','pass','fail','cancelled','skipped','todo']) if (!Object.hasOwn(counts, name)) reject(`Missing ${name} summary`);
  if (!(counts.tests > 0) || counts.pass !== counts.tests) reject('No complete passing test set');
  for (const name of ['fail','cancelled','skipped','todo']) if (counts[name] !== 0) reject(`Nonzero ${name} count`);
  const suites = points.filter(point => point.type === 'suite').length;
  const tests = points.filter(point => point.type === 'test');
  if (tests.length !== counts.tests || suites !== counts.suites || points.some(point => !point.type)) reject('Assertion types do not match summary counts');
  // Node treats a file with no test() calls as one passing file-wrapper test.
  const normalizedFiles = new Set(expectedFiles.map(file => String(file).replaceAll('\\', '/')));
  const substantive = tests.filter(point => !normalizedFiles.has(point.name.replaceAll('\\', '/')) && !/(?:^|\/)\S+\.(?:test|fixture)\.[cm]?[jt]s$/.test(point.name));
  if (substantive.length !== tests.length) reject('Empty test file reported as a passing wrapper');
  if (!substantive.length) reject('No substantive test assertions; file wrappers are not coverage');
  return { ok: errors.length === 0, errors, counts };
}
