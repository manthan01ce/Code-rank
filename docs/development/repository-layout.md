# Repository ownership after 4K

| Before | After | Consumers and entry points |
| --- | --- | --- |
| Loose scripts in `scripts/` | `scripts/dev/`, `scripts/ci/`, `scripts/ops/` | Root npm scripts, the auth measurement workflow, and test imports point to the owners. Shared harness helpers stay in `scripts/lib/`. |
| Workloads and tooling mixed at `load-tests/` | `load-tests/scenarios/`, `load-tests/scripts/`, `load-tests/lib/` | npm k6 commands and the Windows `load-tests/run-k6.ps1` entry point select the scenarios. The runner concurrency benchmark and capacity tools live under scripts. |
| Web workspace copies of two logos and five template SVGs | `apps/web/public/` | Absolute public image URLs in Next components already resolve to public. Each removed workspace copy matched its public counterpart byte for byte. |
| Competing root setup and architecture guides, loose docs and reports | [Setup](../getting-started.md), [topology](../architecture/three-app-topology.md), [operations](../deployment/DEPLOYMENT_OPERATIONS.md), [testing](test-inventory.md), [historical evidence](../archive/2026-11/) | Root README provides entry points. Historical snapshots keep their original context. New diagnostics write under ignored output paths. |
| Historical root database and runner paths | `packages/database/`, `packages/runner/`, `infrastructure/docker/runner/` | The 4G and 4I predecessors already removed the root database and runner folders. Root npm database commands target their current owning scripts. |

The root retains README, workspace manifests and lockfile, tooling and platform configuration, the environment template and both lab launchers. The canonical Compose file is `infrastructure/docker-compose.yml`. The web, API and worker each retain their own app entry points.

See the [test inventory](test-inventory.md) for the current lanes and [load qualification](../../load-tests/QUALIFICATION.md) for current workloads.
