# Project: School Attendance & Grading Web Application (SiHadir-Edu)

## Architecture
- **Framework**: Next.js (App Router, Server Actions, Route Handlers), React 19, TypeScript
- **Styling & UI**: Tailwind CSS, Lucide React icons, mobile-first PWA responsiveness
- **Database & Auth**: Supabase PostgreSQL with 13 core ERD tables + relational entities, Row Level Security (RLS) policies, bcrypt/argon2/PIN authentication
- **Media Pipeline**: Client-side Canvas WebP compression (<180 KB, max 1280px) -> Cloudinary / Supabase Storage
- **Notification Engine**: WhatsApp Gateway (Fonnte / Wablas) with anti-ban queue, 4-10s random jitter, and Spintax formatting
- **Kiosk Mode**: High-contrast scanner shell with `html5-qrcode` & USB 2D barcode scanner support, large profile photo verification pop-up, and audio feedback

## Feature Inventory
Every feature from the Survey phase appears here with its assigned milestone.
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F0.1 Governance (`agent.md`) | Execution rules, agent guidelines, and UI/UX standards | M1 | Survey (R1) |
| 2 | F0.2 Knowledge Graph | Project architecture & schema tracking with graphify | M1 | Survey (R1) |
| 3 | F0.3 Version Control Setup | Git repository initialization & comprehensive .gitignore | M1 | Survey (Codebase) |
| 4 | F1.1 Next.js App Shell | Next.js App Router setup with Tailwind CSS & dependencies | M2 | Survey (Arch) |
| 5 | F1.2 Database Schema (13 ERD) | Supabase PostgreSQL 13 ERD tables, types & relations | M2 | Survey (Arch) |
| 6 | F1.3 Environment Config | Environment variable template (`.env.example`) & client config | M2 | Survey (Workflow) |
| 7 | F1.4 Seed Data Script | Seed database with academic years, classes, teachers, students, parents | M2 | Survey (Arch) |
| 8 | F2.1 Academic Year Management | CRUD for academic years & active semester | M2 | Survey (PRD F1.1) |
| 9 | F2.2 Class & Rombel Management | CRUD for classes, grade levels, and homeroom teachers | M2 | Survey (PRD F1.1) |
| 10 | F2.3 Subject & KKM Management | CRUD for subjects & minimum passing criteria (KKM) | M2 | Survey (PRD F1.1) |
| 11 | F2.4 Teaching Schedule Management | Timetable allocation (class, subject, teacher, day, periods) | M2 | Survey (Arch) |
| 12 | F2.5 User & Teacher Accounts | Profile & auth creation for teachers and administrators | M2 | Survey (Arch) |
| 13 | F2.6 Student Profile Management | Student registry with NIS, NISN, photos, status, QR tokens | M2 | Survey (PRD F1.2) |
| 14 | F2.7 Parent Profile & Sibling Link | Many-to-many parent-student links for multi-child support | M2 | Survey (PRD F1.2) |
| 15 | F3.1 Gate QR Scanner Engine | Webcam (`html5-qrcode`) and USB 2D Barcode scanner engine | M3 | Survey (PRD F2.1) |
| 16 | F3.2 Signed QR Token Verification | Validates `SHD.<student_id>.<sig>` cryptographic tokens | M3 | Survey (Arch) |
| 17 | F3.3 Gate Lateness Calculation | Automated evaluation of arrival against gate late threshold | M3 | Survey (PRD F2.1) |
| 18 | F3.4 Gate Departure Check-Out | Afternoon check-out scan recording | M3 | Survey (PRD F2.1) |
| 19 | F3.5 Face Verification Pop-up | Large photo pop-up & audio tones (`beep-success`/`error`) | M3 | Survey (PRD F2.1) |
| 20 | F3.6 5-Minute Scan Cooldown | Deduplication and rate-limiting anti-fraud check | M3 | Survey (PRD F2.1) |
| 21 | F3.7 Manual Gate Attendance Fallback | Search-based check-in ("Tanpa Kartu") with audit trail | M3 | Survey (Workflow) |
| 22 | F3.8 Classroom Roster Prefill | Auto-population of class roster from gate scans & leaves | M3 | Survey (PRD F2.2) |
| 23 | F3.9 In-Session Attendance & Bolos | Teacher 1-click status validation & skipping detection | M3 | Survey (PRD F2.2) |
| 24 | F3.10 Online Leave Submission | Parent leave request with photo proof attachment | M3 | Survey (PRD F2.3) |
| 25 | F3.11 Leave Verification Workflow | Homeroom teacher review (approve/reject) dashboard | M3 | Survey (PRD F2.3) |
| 26 | F4.1 Daily Engagement Badges | Tier 1 1-tap badges (🌟, ✅, ⚠️, ❌) with default GOOD | M4 | Survey (PRD F3.1) |
| 27 | F4.2 Per-Student Engagement Notes | Qualitative feedback remarks linked to daily attendance | M4 | Survey (PRD F3.1) |
| 28 | F4.3 Formal Assessment Creation | Tier 2 formal evaluations (Tugas, Kuis, UH, PTS, PAS) | M4 | Survey (PRD F3.2) |
| 29 | F4.4 Numerical Grade Entry | 0.00-100.00 score entry with spreadsheet copy-paste | M4 | Survey (PRD F3.2) |
| 30 | F4.5 KKM Mastery & Remedial Flag | Real-time visual comparison against subject KKM score | M4 | Survey (PRD F3.2) |
| 31 | F4.6 Grade Progression Analytics | Historical scoring curves & category averages | M4 | Survey (PRD F3.2) |
| 32 | F4.7 Classroom Documentation Upload | 1-3 photos captured per journal session | M4 | Survey (PRD F4.1) |
| 33 | F4.8 Client-Side WebP Compression | WebWorker canvas resize <=1280px, WebP <=180 KB | M4 | Survey (PRD F4.2) |
| 34 | F4.9 Documentation Visibility Scoping | CLASS_PUBLIC vs TAGGED_STUDENTS_ONLY RLS filtering | M4 | Survey (PRD F4.3) |
| 35 | F5.1 WhatsApp Gateway REST Client | Integration client for Fonnte / Wablas API endpoints | M5 | Survey (PRD F7.1) |
| 36 | F5.2 Priority Notification Dispatch | Routing rules prioritizing immediate alerts (Late/Bolos) | M5 | Survey (PRD F7.2) |
| 37 | F5.3 Anti-Ban Queue & Random Delay | Background queue with 4-10 second randomized jitter | M5 | Survey (PRD F7.3) |
| 38 | F5.4 Dynamic Spintax Formatter | Template engine varying greetings & phrasing | M5 | Survey (PRD F7.4) |
| 39 | F5.5 Attendance Matrix Recap | Monthly/semester grid (H/S/I/A/T) & percentage calculator | M5 | Survey (PRD F5.1) |
| 40 | F5.6 Early Warning System (EWS) | Automated detection of at-risk attendance/grade patterns | M5 | Survey (PRD F5.3) |
| 41 | F5.7 Multi-Format Report Export | 1-click export to Excel (.xlsx) and printable PDF | M5 | Survey (PRD F5.4) |
| 42 | F5.8 Mass QR Card PDF Generator | Print-ready A4 PDF with CR80 standard ID cards | M5 | Survey (PRD F1.3) |
| 43 | F6.1 Parent Authentication & PIN | Low-friction WhatsApp phone + 6-digit PIN login | M6 | Survey (PRD F6.1) |
| 44 | F6.2 Multi-Child Switcher | Sibling switcher dropdown in Parent Portal header | M6 | Survey (PRD F2.5) |
| 45 | F6.3 Real-Time Activity Timeline | Chronological student daily timeline feed | M6 | Survey (PRD F6.1) |
| 46 | F6.4 Class Activity Photo Gallery | Verified classroom photo feed with filter & modal | M6 | Survey (PRD F4.3) |
| 47 | F6.5 PWA Manifest & Service Worker | Installable mobile web app configuration | M6 | Survey (PRD F5.2) |
| 48 | F6.6 Teacher Dashboard UI Polish | Mobile-first schedule, active journal & quick actions | M6 | Survey (DESIGN) |
| 49 | F6.7 Kiosk Scanner Interface | High-contrast dual-pane kiosk view with live clock | M6 | Survey (DESIGN) |
| 50 | F6.8 UI/UX Design System Polish | Styling tokens, Plus Jakarta Sans, micro-interactions | M6 | Survey (DESIGN) |
| 51 | F7.1 E2E Test Suite Validation | Pass 100% of Tiers 1-4 opaque-box test cases | M7 | Survey (Dual Track) |
| 52 | F7.2 Adversarial Coverage Hardening | Tier 5 adversarial stress testing & vulnerability checks | M7 | Survey (Dual Track) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Foundation & Knowledge Tracking | F0.1, F0.2, F0.3: `agent.md` with guidelines & UI standards, graphify knowledge graph, Git init | none | IN_PROGRESS |
| M2 | Core Architecture & Database Setup | F1.1-F1.4, F2.1-F2.7: Next.js + Tailwind setup, Prisma/Supabase 13 ERD tables & migrations, seed data | M1 | PLANNED |
| M3 | Attendance Engine & Anti-Fraud | F3.1-F3.11: Gate QR scanner, signed tokens, cooldown, face popup, roster prefill, bolos alert, leaves | M2 | PLANNED |
| M4 | Grading & Classroom Documentation | F4.1-F4.9: Tier 1 badges & notes, Tier 2 formal grading & KKM, WebP compression (<180KB), documentation | M2 | PLANNED |
| M5 | WhatsApp Gateway & Analytics Recaps | F5.1-F5.8: WhatsApp gateway, anti-ban queue, Spintax, attendance matrix, EWS, Excel/PDF export, QR cards | M3, M4 | PLANNED |
| M6 | Dashboards, Parent Portal & UI Polish | F6.1-F6.8: Parent portal PWA, child switcher, timeline, gallery, teacher dashboard, kiosk, UI tokens | M3, M4, M5 | PLANNED |
| M7 | Final Milestone & E2E Hardening | F7.1-F7.2: 100% pass of Tiers 1-4 E2E tests, Tier 5 adversarial stress-testing & coverage hardening | M1-M6 | PLANNED |

## Interface Contracts

### M2 (Database) <-> M3, M4, M5, M6
- Prisma client export: `@/lib/prisma` or `@/lib/supabase`
- Types export: `@/types/database` (User, Student, Class, GateAttendance, ClassJournal, SubjectAttendance, Documentation, Assessment, StudentGrade, LeaveRequest, WaNotificationLog)
- Enum definitions: `Role`, `AttendanceStatus`, `EngagementBadge`, `AssessmentCategory`, `Visibility`, `LeaveType`, `ApprovalStatus`, `WaStatus`

### M3 (Attendance) <-> M5 (WhatsApp Gateway)
- Function: `enqueueWhatsAppNotification({ studentId, targetPhone, notifType, payload })`
- Event triggers: `GATE_LATE`, `ABSENT_ALERT`, `LEAVE_STATUS`

### M4 (Documentation) <-> Storage Pipeline
- Function: `compressImage(file: File): Promise<{ blob: Blob, sizeKb: number }>`
  - Enforces: width <= 1280px, format: `image/webp`, size <= 180 KB
- Storage upload contract: returns public URL string

### M6 (Parent Portal) <-> M2, M3, M4
- Session context: `{ userId, parentId, linkedStudents: Student[] }`
- Active student context: `activeStudentId: string`

## Code Layout
```text
d:\WEBSITE ABSENSI\
├── agent.md                           # Workflow rules & UI design standards (M1)
├── graphify-out/                      # Project knowledge graph (M1)
├── package.json                       # Next.js, React, Tailwind, Prisma dependencies (M2)
├── tsconfig.json                      # TypeScript configuration (M2)
├── next.config.mjs                    # Next.js configuration (M2)
├── tailwind.config.ts                 # Tailwind design tokens & font family (M2)
├── .env.example                       # Environment template (M2)
├── prisma/
│   ├── schema.prisma                  # 13+ Supabase PostgreSQL ERD models (M2)
│   └── seed.ts                        # Seed script for realistic school demo data (M2)
├── public/
│   ├── manifest.json                  # PWA Manifest (M6)
│   ├── audio/                         # beep-success.mp3, beep-error.mp3 (M3)
│   └── icons/                         # PWA app icons (M6)
└── src/
    ├── app/                           # App Router routes & layouts
    │   ├── (auth)/login/              # Login page (Parent, Teacher, Admin)
    │   ├── (scanner)/gate-scanner/    # Gate Kiosk QR scanner page (M3)
    │   ├── (teacher)/                 # Teacher portal, schedule & journals (M4, M6)
    │   ├── (parent)/parent-dashboard/ # Parent portal PWA timeline & gallery (M6)
    │   └── (admin)/                   # Recaps, master data, QR generator (M5)
    ├── components/                    # Reusable UI components
    │   ├── ui/                        # Button, Card, Badge, Modal, Tabs, Toaster
    │   ├── attendance/                # Scanner viewfinder, FacePopup, RosterTable
    │   ├── grading/                   # BadgeSelector, GradeGrid, KkmIndicator
    │   ├── documentation/             # WebpUploader, PhotoGrid
    │   └── parent/                    # ChildSwitcher, ActivityTimeline
    ├── lib/                           # Core utilities & clients
    │   ├── db.ts                      # Prisma / Supabase client
    │   ├── compression.ts             # Client-side WebP compression engine (<180 KB)
    │   ├── qr-token.ts                # HMAC QR signature generation & validation
    │   └── whatsapp.ts                # WhatsApp client, anti-ban queue & Spintax
    └── types/                         # Shared TypeScript interfaces
```
