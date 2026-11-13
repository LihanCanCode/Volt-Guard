# Contributing to VoltGuard

Thanks for helping! The project has three parts:

| Folder | What | Run tests |
|---|---|---|
| `ml/` | Feature extraction + model training (Python) | `pip install -r requirements.txt -r requirements-dev.txt && pytest` |
| `backend/` | Alert + dashboard server (Node) | `npm ci && npm test` |
| `frontend/` | Phone sensor client + caregiver UI (Vite) | `npm ci && npm test && npm run build` |

## Workflow

1. Open an issue describing the bug or idea first.
2. Branch from `master`, keep changes focused, and add tests for new behaviour.
3. Make sure CI is green, then open a pull request that links the issue.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:` …).
