# Load-test entry point audit (#100 / batch 5E)

Baseline: latest pulled master `1b819ef209ce94ffe7b912cb176819e60191518b`.
Commands below run from the repository root unless a guide explicitly changes directory.
The workload scripts, durations, thresholds, resource assumptions and public arguments
are unchanged. Historical tuning guides keep their observations, with corrected relative
scenario/helper paths and an explicit link to the current startup guide.

| Public entry | Executable owner / disposition |
| --- | --- |
| `npm run k6:smoke-100` | `load-tests/scenarios/smoke-test-100vu.js`; repaired missing root-level path, same BASE_URL and arguments |
| `npm run k6:stress` | `load-tests/scenarios/stress-test.js`; repaired missing root-level path, same BASE_URL and arguments |
| `k6:smoke`, `k6:api`, `k6:execution`, `k6:all` | Existing Windows PowerShell `load-tests/run-k6.ps1` entry; names/arguments unchanged |
| `k6:qualify:smoke/api/run/submission/concurrency` | Existing `load-tests/scenarios/qualification.js`, same MODE values |
| `test:capacity` | Existing `load-tests/scripts/capacity.mjs`; also imported by authenticated-stack, already current |
| `run-k6.ps1 -Test smoke/smoke-100/stress/api/execution/websocket/ratelimit/submission/max/all` | All literal scenario selections already correct; `all` still selects only its original five scenarios |
| `load-tests/scripts/test-smoke.ps1`, `test-api.ps1` | Existing PSScriptRoot-relative scenarios/reports; guide commands now include `scripts/`; startup hint uses supported root `npm run dev` |
| `load-tests/scripts/run-all-tests.ps1` | Uses its own directory to find parent `run-k6.ps1` and reports, so calling it from another working directory no longer selects a nonexistent relative runner |
| `load-tests/scripts/run-full-suite.ps1` | Existing scenario-root resolution, with runner-concurrency benchmark under scripts; requires PowerShell 7 (existing ternary syntax) |
| `load-tests/scripts/run-local-diagnostic.mjs` | Replaces retired web server path with current web-runtime launcher and starts the separate API; existing bounded smoke stages unchanged |
| `scripts/dev/profile-local-pages.mjs`, `profile-auth-components.mjs` | Audited literal executable references resolve; no workload/profile change required |
| `scripts/ci/auth-performance-stack.mjs` | Current web-runtime entry plus deliberate historical cluster fallback for baseline comparisons; not an active broken move |
| Direct benchmark and other scenario invocations | README/qualification paths already grouped correctly; all workload files remain byte-identical |

`tests/unit/load-test-entrypoints.test.mjs` runs in normal discovery and the existing
Windows fast job. It checks the explicitly supported npm command shapes, this runner's
literal switch/ScriptFile convention, helper roots, profiler/diagnostic executable
literals and current fenced guide command references. It deliberately does not attempt
to parse arbitrary shell commands. The Windows job uses native PowerShell parsers for
all load-test PS scripts and the public Windows PowerShell runner separately. Workflow
triggers and expensive opt-in gates are unchanged.

Local k6, pwsh and powershell executables are unavailable. No stress, maximum-capacity,
college or production workload is run. Native Windows parser evidence and exact final
SHA/commands/exit codes are recorded in the PR; missing or failed checks are not passes.
Broader hardware-qualified load/capacity certification remains separate from this path repair.
