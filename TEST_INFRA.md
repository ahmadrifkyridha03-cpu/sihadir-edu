# SiHadir-Edu: End-to-End Test Infrastructure Blueprint (`TEST_INFRA.md`)

## 1. Testing Philosophy & Operational Axioms

### 1.1 Opaque-Box (Black-Box) Testing
- **Contract-Based Verification**: Tests treat system components as opaque units. Verification occurs exclusively through published contracts:
  * Next.js Server Actions (`src/actions/*.ts`)
  * REST API Route Handlers (`src/app/api/**/*.ts`)
  * Exported Domain Logic APIs (`src/lib/*.ts`)
  * Rendered UI DOM invariants and accessibility roles
- **Decoupling from Private Internals**: Tests do NOT depend on internal variable names, private methods, or volatile Tailwind utility order. Any refactor that preserves business logic and input/output contracts passes without modifying test code.
- **Headless & CI-Native**: All tests run without graphical UI dependencies, virtual displays, or manual prompts. Compatible with Windows PowerShell, Linux bash, and macOS.
- **Zero External Mock Leakage**: Mocking is confined strictly to the test environment harness (`tests/e2e/mocks/`) and never leaves mock stubs in production bundles.

### 1.2 Deterministic Execution & Offline Resilience
- **Zero Flakiness Rule**: Tests must never rely on arbitrary `sleep()` intervals or active Internet connections.
- **Graceful Dual-Mode Database Execution**:
  * *Live Mode*: When a valid `DATABASE_URL` is reachable, queries execute against PostgreSQL.
  * *Mock Engine Mode*: When offline or unconfigured, tests seamlessly fall back to deterministic in-memory mock stores implementing the 13 core ERD entities.

---

## 2. 52-Feature Inventory Coverage Matrix

Every feature from `PROJECT.md` is assigned an opaque-box verification target across all 4 tiers:

| # | Feature Code | Feature Name | Milestone | Primary Verification Entry Point | Expected Contract / Invariant |
|---|---|---|---|---|---|
| 1 | F0.1 | Governance (`agent.md`) | M1 | File inspection & AST check | 754 lines, 13 ERD models, UI tokens defined |
| 2 | F0.2 | Knowledge Graph | M1 | `graphify-out/` structure | Multigraph nodes >= 120, edges >= 110 |
| 3 | F0.3 | Version Control Setup | M1 | Git log & `.gitignore` | Main branch commit, isolation of `.env` & `node_modules` |
| 4 | F1.1 | Next.js App Shell | M2 | `next.config.mjs`, `package.json` | Next.js 15+, React 19, strict TypeScript |
| 5 | F1.2 | Database Schema (13 ERD) | M2 | `prisma/schema.prisma` | 13 models, 13 enums, referential actions (Cascade/Restrict/SetNull) |
| 6 | F1.3 | Environment Config | M2 | `.env.example`, client configs | All required env keys documented with safe fallbacks |
| 7 | F1.4 | Seed Data Script | M2 | `prisma/seed.ts` | Complete Indonesian school demographic dataset |
| 8 | F2.1 | Academic Year Management | M2 | `src/actions/master-data.ts` | CRUD operations, active semester toggling |
| 9 | F2.2 | Class & Rombel Management | M2 | `src/actions/master-data.ts` | Class creation, grade levels, homeroom assignment |
| 10 | F2.3 | Subject & KKM Management | M2 | `src/actions/master-data.ts` | Subject CRUD, KKM threshold bounds (0.00-100.00) |
| 11 | F2.4 | Teaching Schedule Management | M2 | `src/lib/teacher-schedule.ts` | Timetable period mapping (Periods 1-10, break periods) |
| 12 | F2.5 | User & Teacher Accounts | M2 | `src/lib/auth-crypto.ts` | PBKDF2/bcrypt hashing, role assignments |
| 13 | F2.6 | Student Profile Management | M2 | `src/actions/master-data.ts` | NIS/NISN uniqueness, profile metadata |
| 14 | F2.7 | Parent Profile & Sibling Link | M2 | `src/actions/parent-auth.ts` | Many-to-many parent-student links for multi-child support |
| 15 | F3.1 | Gate QR Scanner Engine | M3 | `src/actions/gate-scanner.ts` | Scanner event processor (webcam + USB barcode wedge) |
| 16 | F3.2 | Signed QR Token Verification | M3 | `src/lib/qr-token.ts` | HMAC-SHA256 `SHD.<id>.<sig>` verification |
| 17 | F3.3 | Gate Lateness Calculation | M3 | `src/lib/attendance.ts` | Threshold 07:15 WIB, late minutes calculation |
| 18 | F3.4 | Gate Departure Check-Out | M3 | `src/actions/gate-scanner.ts` | Afternoon scan sets `checkOutTime` |
| 19 | F3.5 | Face Verification Pop-up | M3 | `src/components/attendance/FaceVerificationPopup.tsx` | Portrait modal, audio chime triggers |
| 20 | F3.6 | 5-Minute Scan Cooldown | M3 | `src/actions/gate-scanner.ts` | Idempotent duplicate rejection within 300 seconds |
| 21 | F3.7 | Manual Gate Fallback | M3 | `src/actions/gate-scanner.ts` | Search by NIS/name, `scanned_by = MANUAL_OPERATOR_*` |
| 22 | F3.8 | Classroom Roster Prefill | M3 | `src/actions/journal.ts` | Gate scans + approved leaves pre-populate class roster |
| 23 | F3.9 | In-Session Attendance & Bolos | M3 | `src/actions/attendance.ts` | Truancy detection: Gate=HADIR + Class=ALPA_BOLOS |
| 24 | F3.10 | Online Leave Submission | M3 | `src/actions/leave.ts` | Parent leave request with photo attachment |
| 25 | F3.11 | Leave Verification Workflow | M3 | `src/actions/leave.ts` | Homeroom approve/reject; status cascade to gate attendance |
| 26 | F4.1 | Daily Engagement Badges | M4 | `src/lib/grading.ts` | 4 tactile badges (ACTIVE_STAR, GOOD, LESS_FOCUS, NO_TASK) |
| 27 | F4.2 | Per-Student Engagement Notes | M4 | `src/actions/journal.ts` | Qualitative feedback strings saved per subject attendance |
| 28 | F4.3 | Formal Assessment Creation | M4 | `src/actions/grading.ts` | Assessment categories (TUGAS, KUIS, PRAKTIKUM, UH, PTS, PAS) |
| 29 | F4.4 | Numerical Grade Entry | M4 | `src/actions/grading.ts` | 0.00-100.00 score validation, spreadsheet copy-paste parser |
| 30 | F4.5 | KKM Mastery & Remedial Flag | M4 | `src/lib/grading.ts` | `score >= kkmScore` -> Tuntas; `< kkmScore` -> Remedial |
| 31 | F4.6 | Grade Progression Analytics | M4 | `src/actions/analytics.ts` | Category averages & progression history |
| 32 | F4.7 | Classroom Documentation Upload | M4 | `src/actions/documentation.ts` | 1-3 photos per journal session with captions |
| 33 | F4.8 | Client-Side WebP Compression | M4 | `src/lib/compression.ts` | Canvas resize <=1280px, WebP <=180 KB, quality 0.75 |
| 34 | F4.9 | Documentation Visibility Scoping | M4 | `src/actions/parent-gallery.ts` | CLASS_PUBLIC vs TAGGED_STUDENTS_ONLY RLS filtering |
| 35 | F5.1 | WhatsApp Gateway REST Client | M5 | `src/lib/whatsapp.ts` | Fonnte/Wablas client with mock ledger fallback |
| 36 | F5.2 | Priority Notification Dispatch | M5 | `src/lib/whatsapp.ts` | Immediate alerts for Late, Bolos, Leave status |
| 37 | F5.3 | Anti-Ban Queue & Random Delay | M5 | `src/lib/whatsapp.ts` | Queue processor with 4-10 second randomized delay |
| 38 | F5.4 | Dynamic Spintax Formatter | M5 | `src/lib/whatsapp.ts` | Template engine `{A|B|C}` randomization |
| 39 | F5.5 | Attendance Matrix Recap | M5 | `src/lib/analytics/recap-matrix.ts` | Days 1-31 matrix, Dapodik 8355 % Kehadiran formula |
| 40 | F5.6 | Early Warning System (EWS) | M5 | `src/lib/analytics/early-warning.ts` | Alpa >=3, Late >=5, consecutive below KKM detection |
| 41 | F5.7 | Multi-Format Report Export | M5 | `src/lib/export/excel-export.ts`, `pdf-export.ts` | ExcelJS 4-worksheet & jsPDF printable reports |
| 42 | F5.8 | Mass QR Card PDF Generator | M5 | `src/lib/export/qr-card-export.ts` | A4 grid of CR80 (85.6mm x 54mm) cards with HMAC QR |
| 43 | F6.1 | Parent Authentication & PIN | M6 | `src/lib/auth-crypto.ts`, `rate-limit.ts` | PBKDF2 PIN verification, 5-attempt brute-force lockout |
| 44 | F6.2 | Multi-Child Switcher | M6 | `src/components/parent/ChildSwitcher.tsx` | Sibling switcher dropdown & active child context |
| 45 | F6.3 | Real-Time Activity Timeline | M6 | `src/lib/activity-feed.ts` | Chronological daily timeline (Gate -> Journals -> Grades) |
| 46 | F6.4 | Class Activity Photo Gallery | M6 | `src/actions/parent-gallery.ts` | Filtered photo feed with responsive modal lightbox |
| 47 | F6.5 | PWA Manifest & Service Worker | M6 | `public/manifest.json`, `public/sw.js` | Standalone PWA, cache-first offline support, high-res icons |
| 48 | F6.6 | Teacher Dashboard UI Polish | M6 | `src/lib/teacher-schedule.ts`, `src/actions/teacher.ts` | Period schedule math, elapsed time bar, mobile layout |
| 49 | F6.7 | Kiosk Scanner Interface | M6 | `src/app/(scanner)/gate-scanner/page.tsx` | High-contrast dual-pane view, live clock HUD |
| 50 | F6.8 | UI/UX Design System Polish | M6 | `tailwind.config.ts`, `src/app/globals.css` | WCAG AAA contrast (>=7.0:1), Plus Jakarta Sans font |
| 51 | F7.1 | E2E Test Suite Validation | M7 | `tests/e2e/runner.ts` | 100% pass across all Tiers 1-4 opaque-box checks |
| 52 | F7.2 | Adversarial Coverage Hardening | M7 | `tests/adversarial_*.ts` | Cryptographic fuzzing, timing attacks, mutation resilience |

---

## 3. Four-Tier Coverage Thresholds & Check Minimums

The E2E test harness establishes 4 non-overlapping coverage tiers:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   TOTAL VERIFIABLE CHECKS: 575+ CHECKS                 │
├────────────────────────────────────────────────────────────────────────┤
│  Tier 1: Feature Unit/Isolation Coverage   -> 52 × 5 = 260 Checks      │
│  Tier 2: Boundary & Corner Cases           -> 52 × 5 = 260 Checks      │
│  Tier 3: Cross-Feature Pairwise Workflows  -> 7 × 5  =  35 Checks      │
│  Tier 4: Real-World School Workloads       -> 5 × 4  =  20 Checks      │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Tier 1: Feature Coverage (Isolation / Happy Path)
- **Threshold**: Minimum **5 checks per feature** across all 52 features = **260 checks minimum**.
- **Scope**: Happy-path operations verifying each feature in isolation (valid credentials, standard QR token creation, normal scan event, valid grade entry, clean image compression, correct matrix formula).

### 3.2 Tier 2: Boundary & Corner Cases
- **Threshold**: Minimum **5 checks per feature** = **260 checks minimum**.
- **Scope**:
  * Null, empty, and undefined string inputs.
  * Timezone offset boundaries (07:15:00 WIB exactly vs 07:15:01 WIB).
  * Cooldown edge conditions: repeated scan at 299s (rejected) vs 301s (accepted).
  * Grade scale limits (-1, 0.00, 100.00, 100.01, NaN, infinite).
  * WebP compression constraints: images >1280px resized down; files <=180KB; non-image rejected.
  * Rate limiting: 4th attempt allowed, 5th attempt allowed, 6th attempt locked for 15 minutes.
  * Spintax recursion: nested brackets `{A|{B|C}}` evaluated without infinite loops.
  * Calendar effective days: mid-month zero-days divisor guard preventing division by zero.

### 3.3 Tier 3: Cross-Feature Pairwise Workflows
- **Threshold**: Minimum **7 multi-feature pairwise workflows $\times$ 5 assertions = 35 checks minimum**.
- **Workflows**:
  1. `F3.1` (Gate Scan) $\to$ `F3.8` (Roster Prefill) $\to$ `F3.9` (Bolos Detection) $\to$ `F5.2` (WhatsApp Alert).
  2. `F3.10` (Leave Submit) $\to$ `F3.11` (Homeroom Approval) $\to$ `F3.8` (Roster Cascade) $\to$ `F5.2` (WA Notif).
  3. `F4.7` (Journal Session) $\to$ `F4.4` (Grade Entry) $\to$ `F4.5` (KKM Flag) $\to$ `F5.6` (EWS Calculation).
  4. `F5.3` (WA Anti-Ban Queue) $\to$ `F5.4` (Spintax) $\to$ Status Transition (`QUEUED` $\to$ `SENT`).
  5. `F5.5` (Matrix Recap) $\to$ `F5.6` (EWS Alert) $\to$ `F5.7` (ExcelJS 4-worksheet & PDF Export).
  6. `F2.6` (Student Profile) $\to$ `F3.2` (HMAC QR Token) $\to$ `F5.8` (Mass CR80 Cards) $\to$ `F3.1` (Kiosk Scan).
  7. `F6.1` (Parent PIN Auth) $\to$ `F6.2` (Child Switcher) $\to$ `F4.9` (Scoped Gallery) $\to$ `F6.5` (PWA SW Cache).

### 3.4 Tier 4: Real-World Application Scenarios
- **Threshold**: Minimum **5 realistic school day simulations $\times$ 4 assertions = 20 checks minimum**.
- **Scenarios**:
  1. *The Morning Gate Rush*: 100 students arriving between 06:30 and 07:30 WIB; verifies on-time vs late classification, cooldown rate limiting, and fallback manual search for students without physical cards.
  2. *Teacher Daily Classroom Routine*: Homeroom teacher opens Period 1 journal; roster automatically pre-fills from morning gate scans; teacher marks attendance, attaches compressed WebP photo, assigns engagement badges, and locks journal.
  3. *The Truancy Anomaly ("Bolos")*: Student scans at morning gate (HADIR) but ditches Period 3 physics; teacher flags ALPA_BOLOS; system triggers high-priority WhatsApp alert and records an EWS flag.
  4. *Parent Sick Leave with Doctor Certificate*: Parent logs in with phone + PIN, submits leave request with doctor certificate image; homeroom teacher reviews and approves; gate and class rosters cascade to SAKIT; attendance percentage recalculates correctly.
  5. *End-of-Semester Academic & Attendance Recap*: Admin runs Dapodik 8355 matrix calculation across all rombels; EWS identifies at-risk students exceeding alpa/lateness thresholds; exports multi-tab Excel spreadsheet and official printable PDF.

---

## 4. Test Harness Directory Architecture

The test harness is organized under `tests/e2e/`:

```text
d:\WEBSITE ABSENSI\
└── tests/
    ├── e2e/
    │   ├── runner.ts                     # TypeScript E2E Master Harness
    │   ├── test_tier1_features.ts        # Tier 1: 52 Isolated Feature Tests (>=260 checks)
    │   ├── test_tier2_boundaries.ts      # Tier 2: Boundary & Corner Case Tests (>=260 checks)
    │   ├── test_tier3_pairwise.ts        # Tier 3: 7 Cross-Feature Workflows (>=35 checks)
    │   ├── test_tier4_scenarios.ts       # Tier 4: 5 School Workload Scenarios (>=20 checks)
    │   └── mocks/
    │       ├── in-memory-db.ts           # Standalone mock implementation of 13 Prisma models
    │       ├── mock-data.ts              # Seeded realistic school demographic fixtures
    │       └── mock-whatsapp-gateway.ts  # In-memory Fonnte/Wablas queue ledger
    ├── run_all_e2e_tests.py              # Unified Python Master Test Runner & CLI Reporter
    ├── artifacts/                        # Output directory for test reports & JSON metrics
    └── ... (existing M1-M6 regression & adversarial test suites)
```

---

## 5. Pass/Fail Semantics & Exit Codes

1. **Strict Exit Codes**:
   - `Exit 0`: 100% of checks passed; zero assertion errors; zero unhandled promise rejections.
   - `Exit 1`: One or more assertions failed, or an unhandled exception occurred.
2. **Explicit Failure Reporting**:
   - Every failed assertion displays:
     * Feature Code (e.g. `[F3.6 Gate Cooldown]`)
     * Failure Reason (e.g. `Expected ALREADY_SCANNED, received SUCCESS`)
     * File and Line Location
     * Input Arguments and Output Return Value
3. **Artifact Generation**:
   - Each run writes:
     * `tests/artifacts/test-results.json` (machine-parsable structured telemetry)
     * `tests/artifacts/test-summary.md` (markdown report with pass counts and timing)
