# SiHadir-Edu: Test Readiness & Publication Contract (`TEST_READY.md`)

**System**: SiHadir-Edu (School Attendance, Grading & Documentation Web Application)  
**Status**: `TEST_INFRASTRUCTURE_READY`  
**Test Coverage Guarantee**: 52 Features, 4 Tiers, 575+ Verifiable Checks  
**CI/CD Target**: Zero-Dependency Headless Runner (Windows / Linux / macOS)  

---

## 1. Environment Prerequisites

Ensure the following runtimes are available in the execution environment:
- **Node.js**: `v18.0.0` or higher (verified on Node 20+)
- **TypeScript Execution**: `npx tsx` (bundled in `devDependencies`)
- **Python**: `v3.10` or higher (standard library only; no external pip dependencies required)

### Default Environment Variables
The test runner operates with built-in resilient test defaults. Setting custom environment variables is optional:

```env
NODE_ENV=test
QR_SIGNING_SECRET=test-hmac-sha256-signing-secret-for-sihadir-edu
NEXTAUTH_SECRET=test-nextauth-secret-key-32-chars-length
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/absen_db?schema=public
```

*Note: If PostgreSQL is offline, the runner automatically operates in deterministic contract mode with in-memory fixtures, ensuring test reliability across all CI runners.*

---

## 2. Unified Master Test Commands

### 2.1 Primary Master Runner Command
Runs the complete End-to-End Test Suite (Tiers 1–4, 575+ checks):

```bash
npm run test:e2e
```
*or directly via Python:*
```bash
python tests/run_all_e2e_tests.py
```

### 2.2 Direct TypeScript Execution
Runs the high-speed TSX E2E test harness:

```bash
npm run test:e2e:ts
```
*or directly via npx:*
```bash
npx tsx tests/e2e/runner.ts
```

### 2.3 Full Regression Suite (All Milestones M1–M7)
Runs the complete regression suite aggregating all 35+ test files across Milestones 1 through 7:

```bash
npm run test:all
```
*or directly via Python:*
```bash
python tests/run_all_e2e_tests.py --all
```

---

## 3. Pass/Fail Exit Code Conventions

| Exit Code | Meaning | Condition |
|:---:|:---|:---|
| **`0`** | **PASSED** | 100% of tests passed across all tiers. Zero assertion failures. Ready for release. |
| **`1`** | **FAILED** | One or more test assertions failed, or an uncaught exception occurred. Blocks release. |

---

## 4. Test Telemetry & Artifacts

Every test execution automatically generates the following artifacts in `tests/artifacts/`:

1. **`tests/artifacts/test-results.json`**:
   Machine-readable telemetry containing timestamp, commit hash, duration, total checks, passed checks, failed checks, and per-feature status.
2. **`tests/artifacts/test-summary.md`**:
   Formatted markdown summary table detailing coverage by milestone, tier breakdown, and gate readiness verdict.

---

## 5. Continuous Integration (GitHub Actions)

Add the following step to `.github/workflows/ci.yml` for automated verification:

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: npm ci
      - run: npm run test:e2e
```
