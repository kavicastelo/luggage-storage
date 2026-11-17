# Initiative 7 — WS-7.5 CI/CD & Repository Governance Report

---

## 1. CI/CD Pipeline Updates (`.github/workflows/ci.yml` & `.github/dependabot.yml`)
- **Branch Triggers:** Added `'feature/**'` alongside `main`, `dev`, `develop`, `feat/phase-1b-identity`, `'feat/**'` on both `push` and `pull_request`.
- **`validate` Job:** Starts PostGIS (`infrastructure/docker/docker-compose.yml`), installs with `pnpm install --frozen-lockfile`, builds `@luggage-storage/contracts`, runs `pnpm db:migrate` against a clean database, and executes `pnpm verify` (`lint`, `typecheck`, `test`, `build`).
- **`security-audit` Job:** Runs blocking `pnpm audit --audit-level=critical` (`0` critical vulnerabilities observed locally) and non-blocking `pnpm audit --audit-level=high` advisory visibility (currently reports 1 upstream high / 8 moderate advisories in `picomatch <=4.0.7` under `metro` / `react-native`, `GHSA-fc5q-39xc-vjpf`, with `Patched versions: None`).
- **`browser-e2e` Job (`needs: [validate]`):** Starts PostGIS, runs `pnpm db:migrate`, installs Chromium (`playwright install --with-deps chromium`), runs `pnpm --filter @luggage-storage/web test:e2e`, and uploads `apps/web/playwright-report/` & `apps/web/test-results/` artifacts on failure.
- **Dependabot (`.github/dependabot.yml`):** Configured weekly update PRs for `npm` (`pnpm`) and `github-actions`.

---

## 2. Branch Protection & `dev` / `main` Reconciliation

### Current State
- `main` (`8613dac`) is **39 commits ahead** of `dev` (`ce0afbd`).
- `gh` CLI is not installed in the local execution environment and GitHub Admin permissions are external to this workspace, so branch protection could not be mutated programmatically here.

### Administrator Checklist (GitHub Repository Settings -> Branches)
1. **Protect `main`:**
   - Require a pull request before merging (`1` minimum approving review, dismiss stale approvals).
   - Require status checks to pass before merging: `validate`, `security-audit`, `browser-e2e`.
   - Require conversation resolution before merging.
   - Disable force pushes and branch deletions (`include administrators` recommended).
2. **Reconcile `dev` with `main`:**
   - Fast-forward or merge `main` into `dev` (`git checkout dev && git merge --ff-only main && git push origin dev`) once PR for Initiative 7 merges into `main`.
   - Protect `dev` against force pushes and branch deletions with `validate` required.
3. **Standard Release Workflow:**
   - `feature/*` branch -> local `pnpm verify` & `test:e2e` -> Pull Request to `main` -> CI (`validate`, `security-audit`, `browser-e2e`) -> peer review -> merge -> staging deployment & smoke test -> production promotion -> rollback via previous release tag/container + forward-only DB migration discipline.

