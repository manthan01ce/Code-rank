# Warm-daemon retirement candidate (#99 / batch 5D)

**Docker acceptance is blocked. Do not merge or close #99 on unit evidence.**
This branch proposes explicit retirement of shared warm daemons while preserving the
existing cold per-job sandbox as the sole execution mode. #98 is merged via #105
(`3fb23e0`); work starts from latest master `502f4f530016b7ac53c4f2f981302d6913d5ff9e`.

## Consumer-based decision

The old global worker flag routed every language's jobs into a fixed shared container.
There was no trusted-input authority or cross-worker admission lock. `start()` and
`destroy()` were no-ops for warm jobs; UUID work directories separated filenames but
not the shared UID/filesystem/process namespace. Removing a work directory did not
terminate detached children. Time/output errors did not destroy the shared daemon.
The missing-daemon fallback only handled one error string and retried in a cold sandbox.
These source observations cannot establish a supported concurrent or serialized warm
contract. The issue explicitly permits retirement after consumer analysis; this branch
chooses retirement rather than asserting untested isolation or trusted-input enforcement.

| Concrete consumer | Previous requirement | Migration / disposition |
| --- | --- | --- |
| `Sandbox` used by Executor and all five language/function runners | Optional global `USE_WARM_DAEMONS=true`, fixed daemon name, missing-daemon retry | Cold UUID container for every job. Legacy enabled/invalid flag fails explicitly with `WARM_DAEMONS_RETIRED`; unset/empty/false keeps cold default. `isWarm` remains false for existing cold-mode observations. |
| Worker bootstrap | Operator environment could enable warm for all HTTP/queue inputs | Check configuration before allocating workers, sockets, heartbeat or reaper; no caller-controlled trusted flag is introduced. |
| `infrastructure/compose.warm-daemons.yaml` | Five persistent named language containers from the canonical image | Overlay removed. Stale Compose invocation must fail. Base/local-database/container/CI profiles keep their existing per-job model and volumes. |
| `scripts/dev/check-system.ps1` | Required five warm containers to exist | No permanent language containers required. Existing Redis check remains; jobs own bounded disposable containers. |
| `scripts/dev/verify-system.js` | Used a “Daemon Working” sample string through the execution API | Same executable diagnostic and arguments, described as cold sandbox execution. |
| Getting-started and image-ownership guides | Advertised warm overlay/global opt-in for local/lab use | Explicit migration below; cold startup commands retained. |
| Opt-in architecture workflow | Rendered removed warm overlay | Remove that stale render command; owning Docker lane now includes retirement regressions. Trigger, opt-in labels and execution budget unchanged. |
| Old warm unit tests | Asserted daemon start/destroy no-ops and fallback | Replaced by stale-flag rejection and cold default tests. Existing cold timeout, resource, teardown and reaper assertions retained. New native Docker tests are active, not quarantined. |
| Historical baseline/predecessor records | Record the old tree and behavior | Remain historical; do not reinterpret them as current support or acceptance. |

No live operator host/configuration was inspected. External adoption of the old documented
mode is therefore unknown, not assumed absent. The explicit error and migration guidance
are required compatibility handling; there is no silent cold fallback for an enabled
legacy flag. Review this retirement and migrate any operator environment before adoption.

## Operator migration before adopting this change

1. Drain/stop the old worker so no active job still uses a shared daemon. Preserve its
   PostgreSQL/Redis data, named volumes, credentials and queue records.
2. Remove `USE_WARM_DAEMONS` from worker environment/configuration (explicit `false` is
   also accepted). Remove the retired warm overlay from startup commands.
3. Inspect the old `coderank-python-daemon`, `coderank-cpp-daemon`, `coderank-c-daemon`,
   `coderank-java-daemon` and `coderank-javascript-daemon` containers. Stop/remove only
   confirmed deployment-owned warm containers after draining. Do not remove database,
   Redis or application volumes; do not use `down -v`, reseed or reset.
4. Build the same canonical image and start the documented cold topology:

```bash
docker build -t coderank-base:latest -f infrastructure/docker/runner/Dockerfile .
docker compose --env-file .env -f infrastructure/docker-compose.yml --profile local-database up -d
npm run worker
```

Container-worker/full-container deployments retain their existing documented profiles
and worker-only Docker access. No daemon startup or per-language image is required.
The canonical `infrastructure/docker/runner/Dockerfile` remains byte-identical.
Cold execution still uses its existing memory/CPU/PID/tmpfs/network/user/capability,
5-second execution cap and bounded lifetime/cleanup policy. No new capacity guarantee.

## Real acceptance required before merge

```bash
npm ci
npm run lint:critical
npm test
npm run build --workspace=apps/api
npm run test:warm-disposition
```

The last command requires real Docker and Compose 2.24.4+. It resolves cold, local,
full-container and CI configurations with disposable environment fixture values; it never
starts application/DB services or publishes expanded environment values. It builds a
unique test tag from the one canonical Dockerfile using a minimal context, records
source/Dockerfile labels and actual image ID/digests, runs the strict active Docker lane,
checks the image did not change, and removes only that test-owned image tag. Existing
quarantined batch execution remains separately tracked by #101; nothing is newly skipped
or quarantined here. No expensive GitHub Actions is enabled or dispatched.

`tests/docker/warm-retirement.test.mjs` requires a real daemon before checking stale
configuration rejection, concurrent cold workspace/output/process boundaries and output
overflow teardown. Existing Docker tests cover every language, lifetime/recovery,
timeout/resource confinement and cleanup. Unit tests and mocks do not replace them.

`test-results/warm-disposition.json` records exact source commit/tree, configuration
projections, Docker/Compose versions, actual image identities and TAP/file-report hashes.
A missing CLI/daemon yields blocked status, nonzero exit and null image identity. This
workspace has no Docker CLI/socket/configured host, so no resolved native Compose or image
execution report exists yet. The matrix remains partial/unverified and #99 stays open.
College host/LAN/cloud/provisioning/production work is outside this issue.
