# Deploys

| When (CT) | Worker version | Deployment | Rollback point |
| --- | --- | --- | --- |
| 2026-10-28 09:35 | 6f6bda35-c742-4ce1-b337-bdbcc2279517 | 9a7a7b6e-c2f6-4462-a772-82c992304df6 | First deploy, nothing before it. To take it offline without deleting anything, disable the workers.dev route. Later deploys roll back to this version id via `wrangler rollback 6f6bda35-c742-4ce1-b337-bdbcc2279517` or Dashboard → Deployments. |

Post-deploy check (09:35 CT): `/`, `/api/index` (live, 51 quotes), `/api/forward`, `/api/tco` all returned 200.
