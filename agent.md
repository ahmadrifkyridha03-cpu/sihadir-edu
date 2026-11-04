# SiHadir-Edu: Agent Constitution, Operational Architecture & UI/UX Governance

> **Repository**: `d:\WEBSITE ABSENSI`  
> **System Name**: SiHadir-Edu (*Sistem Informasi Absensi, Nilai, & Dokumentasi Pembelajaran Siswa Terintegrasi Orang Tua*)  
> **Target Institutions**: Indonesian SD, SMP, SMA, and SMK (100–1,500 students)  
> **Primary Tech Stack**: Next.js 15+ (App Router, Server Actions), TypeScript (Strict), Tailwind CSS, Supabase PostgreSQL (13 ERD Tables), Cloudinary / Supabase Storage, WhatsApp Gateway (Fonnte/Wablas)  
> **Design Intelligence Engines**: `ui-ux-pro-max`, `impeccable`, `emil-design-eng`

---

## 1. Executive Summary & Purpose of `agent.md`

`agent.md` serves as the authoritative, durable constitution and operational playbook for all autonomous agents, subagents, and human developers collaborating on **SiHadir-Edu**.

Every engineering, architectural, and design decision within the repository must align with the core axioms, domain rules, security constraints, and UI/UX polish standards defined in this document.

---

## 2. Project Context & Operating Environment

### 2.1 The Indonesian School Reality
- **Target Scale**: Indonesian public and private schools accommodating **100 to 1,500 active students**.
- **Field Constraints & User Profiles**:
  1. **Parents (Orang Tua)**: High variance in digital literacy and smartphone specs (ranging from budget Android Go devices to iPhones). Over 90% access the system via WhatsApp links or mobile browsers. Requires **zero cognitive friction**, instant comprehension (**The 3-Second Rule**), and a low-friction auth mechanism (**WhatsApp phone number + 6-digit PIN**).
  2. **Teachers (Guru Mapel & Wali Kelas)**: Operating in classrooms with constrained lesson times (40–45 mins per period) and spotty Wi-Fi. Administrative overhead must be minimized: full classroom attendance, learning documentation photo, and engagement badges must be completed in **less than 2 minutes**.
  3. **School Administration & Gate Operators (Petugas Piket / Kiosk)**: High throughput required at morning gates (06:00 – 07:15 WIB). Scanner response latency must stay **under 1 second per scan** to prevent bottlenecks.
  4. **Budgetary Reality**: Zero recurring operational software budget. The entire production stack must function reliably within **100% Free-Tier Cloud Resources**.

### 2.2 The Three Pillars of Transparency
SiHadir-Edu bridges the traditional communication gap between schools and homes via:
1. **Attendance Layering (Presensi Dual-Layer)**: Gate scan + per-period subject journal to eradicate "titip absen" and classroom skipping (*bolos jam pelajaran*).
2. **Academic Engagement (Nilai & Keaktifan Harian)**: Real-time feedback via 4 tactile engagement badges and formal grade records with KKM thresholds.
3. **Authentic Visual Proof (Dokumentasi Kelas Terkompresi)**: Direct classroom photos showing actual learning activities compressed automatically on the client side to prevent cloud storage exhaustion.

---

## 3. Core Architecture & Technical Stack

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (Mobile & Desktop PWA)             │
│  - Next.js 15+ App Router / React 19 / TypeScript (Strict Mode)        │
│  - Tailwind CSS + Lucide Icons + Plus Jakarta Sans + JetBrains Mono    │
│  - Client-side WebWorker WebP Canvas Compression Engine (<180 KB)      │
│  - html5-qrcode Webcam Scanner & USB 2D Barcode HID Keyboard Wedge     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / Server Actions
┌───────────────────────────────────▼────────────────────────────────────┐
│                    APPLICATION LAYER (Vercel Free Tier)                │
│  - Next.js Server Actions & Route Handlers                             │
│  - HMAC-SHA256 Cryptographic QR Token Verification                    │
│  - Anti-Ban WhatsApp Queue Manager with 4-10s Randomized Jitter        │
│  - Early Warning System (EWS) Analytical Engine                        │
└─────────────────┬──────────────────────────────────┬───────────────────┘
                  │ SQL via Pooler                   │ REST API
┌─────────────────▼─────────────────┐   ┌────────────▼───────────────────┐
│     DATA LAYER (Supabase Free)    │   │      EXTERNAL / NOTIFICATIONS  │
│  - PostgreSQL 15+ (500 MB Free)   │   │  - WhatsApp Gateway (Fonnte)   │
│  - 13 ERD Tables + Strict RLS     │   │  - Cloudinary Free Media (25GB)│
│  - Prisma ORM + PgBouncer         │   │  - Spintax Template Engine     │
└───────────────────────────────────┘   └────────────────────────────────┘
```

### 3.1 Technology Matrix
| Layer | Technology | Selection Rationale & Free-Tier Capacity |
| :--- | :--- | :--- |
| **Framework** | Next.js 15+ (App Router, Server Actions) | Serverless full-stack, instant API response, zero cold-start delay for end users on Vercel Hobby Plan (100 GB bandwidth/mo). |
| **Language** | TypeScript (Strict Mode) | End-to-end type safety between database schema, Server Actions, and UI components. |
| **Styling** | Tailwind CSS + Lucide React | Utility-first styling with zero CSS runtime overhead, optimized mobile-first responsive tokens. |
| **Database** | Supabase PostgreSQL 15+ | Relational integrity with 500 MB free storage (capable of storing >1,500,000 attendance and grade records with proper indexing). |
| **ORM / Data Access**| Prisma ORM (`@prisma/client`) | Declarative schema modeling, automatic migration history, type generation, connection pooling via Supabase PgBouncer. |
| **Media Storage** | Cloudinary Free Tier (25 GB) or Supabase Storage (1 GB) | Combined with mandatory WebP client compression (<180 KB), 1 GB accommodates >6,800 photos; Cloudinary accommodates >160,000 photos. |
| **QR Engine** | `html5-qrcode` & USB HID Barcode Listener | Dual-mode scanning: laptop/tablet webcam or hardware 2D USB laser scanner with zero UI lag. |
| **WhatsApp Gateway**| Fonnte / Wablas REST API Client | Local Indonesian gateway provider with support for randomized delays and Spintax formatting. |
| **PWA Engine** | Web App Manifest + Service Worker | Installable to Android and iOS home screens, camera access without sandboxed iframe limitations. |

---

## 4. Database Architecture & Schema Specification (13 Core ERD Entities)

The database models 13 core relational tables plus necessary lookup and scheduling structures. All primary keys use `UUID` with `gen_random_uuid()` defaults. Timestamps (`created_at`, `updated_at`) must be UTC.

```prisma
// datasource and generator definition
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}

// Enums
enum Role {
  ADMIN
  TEACHER
  PARENT
  STUDENT
  SCANNER
}

enum Gender {
  L
  P
}

enum StudentStatus {
  ACTIVE
  GRADUATED
  MOVED
}

enum ParentRelation {
  AYAH
  IBU
  WALI
}

enum GateStatus {
  HADIR
  TERLAMBAT
  IZIN
  SAKIT
  ALPA
}

enum SubjectStatus {
  HADIR
  SAKIT
  IZIN
  ALPA_BOLOS
}

enum EngagementBadge {
  ACTIVE_STAR   // 🌟 Sangat Aktif
  GOOD          // ✅ Mengikuti Pembelajaran (Default)
  LESS_FOCUS    // ⚠️ Kurang Fokus / Mengantuk
  NO_TASK       // ❌ Tidak Mengumpulkan Tugas
}

enum AssessmentCategory {
  TUGAS
  KUIS
  PRAKTIKUM
  UH
  PTS
  PAS
}

enum DocVisibility {
  CLASS_PUBLIC
  TAGGED_STUDENTS_ONLY
}

enum LeaveType {
  SAKIT
  IZIN
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

enum WaNotifType {
  GATE_LATE
  GATE_IN
  ABSENT_ALERT
  GRADE_UPDATE
  DAILY_DIGEST
}

enum WaStatus {
  QUEUED
  SENT
  FAILED
}

// 1. Users & Profiles
model User {
  id            String    @id @default(uuid()) @db.Uuid
  name          String    @db.VarChar(120)
  phoneWa       String?   @unique @map("phone_wa") @db.VarChar(20)
  email         String?   @unique @db.VarChar(120)
  passwordHash  String    @map("password_hash") @db.Text
  role          Role      @default(PARENT)
  isActive      Boolean   @default(true) @map("is_active")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  teacher       Teacher?
  parent        Parent?
  student       Student?

  @@map("users")
}

model Teacher {
  id            String    @id @default(uuid()) @db.Uuid
  userId        String    @unique @map("user_id") @db.Uuid
  nip           String?   @unique @db.VarChar(30)
  fullName      String    @map("full_name") @db.VarChar(120)
  phoneWa       String    @map("phone_wa") @db.VarChar(20)
  specialty     String?   @db.VarChar(100)

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  homeroomClass Class?    @relation("HomeroomTeacher")
  schedules     Schedule[]
  journals      ClassJournal[]
  assessments   Assessment[]
  approvedLeaves LeaveRequest[] @relation("ApprovedByTeacher")

  @@map("teachers")
}

model Parent {
  id            String    @id @default(uuid()) @db.Uuid
  userId        String    @unique @map("user_id") @db.Uuid
  fullName      String    @map("full_name") @db.VarChar(120)
  phoneWa       String    @unique @map("phone_wa") @db.VarChar(20)
  occupation    String?   @db.VarChar(100)

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  studentLinks  ParentStudentLink[]
  leaveRequests LeaveRequest[]

  @@map("parents")
}

model Student {
  id            String        @id @default(uuid()) @db.Uuid
  userId        String?       @unique @map("user_id") @db.Uuid
  classId       String        @map("class_id") @db.Uuid
  nis           String        @unique @db.VarChar(20)
  nisn          String        @unique @db.VarChar(20)
  fullName      String        @map("full_name") @db.VarChar(120)
  gender        Gender        @default(L)
  photoUrl      String?       @map("photo_url") @db.Text
  qrToken       String        @unique @map("qr_token") @db.VarChar(64)
  status        StudentStatus @default(ACTIVE)
  createdAt     DateTime      @default(now()) @map("created_at")

  user          User?         @relation(fields: [userId], references: [id], onDelete: SetNull)
  class         Class         @relation(fields: [classId], references: [id], onDelete: Restrict)
  parentLinks   ParentStudentLink[]
  gateAttendances GateAttendance[]
  subjectAttendances SubjectAttendance[]
  studentGrades StudentGrade[]
  leaveRequests LeaveRequest[]
  waNotificationLogs WaNotificationLog[]

  @@index([classId])
  @@index([qrToken])
  @@map("students")
}

// Many-to-Many link for Sibling support
model ParentStudentLink {
  id             String         @id @default(uuid()) @db.Uuid
  parentId       String         @map("parent_id") @db.Uuid
  studentId      String         @map("student_id") @db.Uuid
  relation       ParentRelation @default(AYAH)
  receiveWaNotif Boolean        @default(true) @map("receive_wa_notif")

  parent         Parent         @relation(fields: [parentId], references: [id], onDelete: Cascade)
  student        Student        @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([parentId, studentId])
  @@map("parent_student_links")
}

// 2. Academic Structure
model AcademicYear {
  id            String    @id @default(uuid()) @db.Uuid
  yearName      String    @map("year_name") @db.VarChar(20) // e.g. "2026/2027"
  semester      Int       @default(1) // 1: Ganjil, 2: Genap
  isActive      Boolean   @default(true) @map("is_active")
  classes       Class[]

  @@map("academic_years")
}

model Class {
  id                 String       @id @default(uuid()) @db.Uuid
  academicYearId     String       @map("academic_year_id") @db.Uuid
  homeroomTeacherId  String?      @unique @map("homeroom_teacher_id") @db.Uuid
  className          String       @map("class_name") @db.VarChar(50) // e.g. "X-IPA-1"
  gradeLevel         Int          @map("grade_level") // 7, 8, 9 or 10, 11, 12

  academicYear       AcademicYear @relation(fields: [academicYearId], references: [id], onDelete: Restrict)
  homeroomTeacher    Teacher?     @relation("HomeroomTeacher", fields: [homeroomTeacherId], references: [id], onDelete: SetNull)
  students           Student[]
  schedules          Schedule[]
  classJournals      ClassJournal[]
  assessments        Assessment[]

  @@index([academicYearId])
  @@map("classes")
}

model Subject {
  id            String     @id @default(uuid()) @db.Uuid
  subjectCode   String     @unique @map("subject_code") @db.VarChar(20) // e.g. "MTK", "BIN"
  subjectName   String     @map("subject_name") @db.VarChar(100)
  kkmScore      Decimal    @default(75.00) @map("kkm_score") @db.Decimal(5, 2)

  schedules     Schedule[]
  classJournals ClassJournal[]
  assessments   Assessment[]

  @@map("subjects")
}

model Schedule {
  id            String     @id @default(uuid()) @db.Uuid
  classId       String     @map("class_id") @db.Uuid
  subjectId     String     @map("subject_id") @db.Uuid
  teacherId     String     @map("teacher_id") @db.Uuid
  dayOfWeek     Int        @map("day_of_week") // 1: Senin .. 6: Sabtu
  periodStart   Int        @map("period_start") // Jam ke-
  periodEnd     Int        @map("period_end")

  class         Class      @relation(fields: [classId], references: [id], onDelete: Cascade)
  subject       Subject    @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  teacher       Teacher    @relation(fields: [teacherId], references: [id], onDelete: Restrict)
  classJournals ClassJournal[]

  @@index([classId, dayOfWeek])
  @@map("schedules")
}

// 3. Attendance Entities
model GateAttendance {
  id             String     @id @default(uuid()) @db.Uuid
  studentId      String     @map("student_id") @db.Uuid
  attendanceDate DateTime   @map("attendance_date") @db.Date
  checkInTime    DateTime?  @map("check_in_time")
  checkOutTime   DateTime?  @map("check_out_time")
  status         GateStatus @default(HADIR)
  lateMinutes    Int        @default(0) @map("late_minutes")
  scannedBy      String?    @map("scanned_by") @db.VarChar(100)

  student        Student    @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, attendanceDate])
  @@index([attendanceDate, status])
  @@map("gate_attendances")
}

model ClassJournal {
  id                 String              @id @default(uuid()) @db.Uuid
  scheduleId         String?             @map("schedule_id") @db.Uuid
  classId            String              @map("class_id") @db.Uuid
  subjectId          String              @map("subject_id") @db.Uuid
  teacherId          String              @map("teacher_id") @db.Uuid
  journalDate        DateTime            @map("journal_date") @db.Date
  periodStart        Int                 @map("period_start")
  periodEnd          Int                 @map("period_end")
  topicMaterial      String              @map("topic_material") @db.VarChar(255)
  teacherNotes       String?             @map("teacher_notes") @db.Text
  createdAt          DateTime            @default(now()) @map("created_at")

  schedule           Schedule?           @relation(fields: [scheduleId], references: [id], onDelete: SetNull)
  class              Class               @relation(fields: [classId], references: [id], onDelete: Restrict)
  subject            Subject             @relation(fields: [subjectId], references: [id], onDelete: Restrict)
  teacher            Teacher             @relation(fields: [teacherId], references: [id], onDelete: Restrict)
  subjectAttendances SubjectAttendance[]
  documentations     Documentation[]
  assessments        Assessment[]

  @@index([classId, journalDate])
  @@map("class_journals")
}

model SubjectAttendance {
  id              String          @id @default(uuid()) @db.Uuid
  journalId       String          @map("journal_id") @db.Uuid
  studentId       String          @map("student_id") @db.Uuid
  status          SubjectStatus   @default(HADIR)
  engagementBadge EngagementBadge @default(GOOD) @map("engagement_badge")
  note            String?         @db.VarChar(255)

  journal         ClassJournal    @relation(fields: [journalId], references: [id], onDelete: Cascade)
  student         Student         @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([journalId, studentId])
  @@index([studentId, status])
  @@map("subject_attendances")
}

// 4. Learning Proof & Assessments
model Documentation {
  id               String        @id @default(uuid()) @db.Uuid
  journalId        String        @map("journal_id") @db.Uuid
  imageUrl         String        @map("image_url") @db.Text
  caption          String?       @db.VarChar(255)
  visibility       DocVisibility @default(CLASS_PUBLIC)
  taggedStudentIds Json?         @map("tagged_student_ids") // String[] of student UUIDs
  fileSizeKb       Int           @map("file_size_kb")
  createdAt        DateTime      @default(now()) @map("created_at")

  journal          ClassJournal  @relation(fields: [journalId], references: [id], onDelete: Cascade)

  @@index([journalId])
  @@map("documentations")
}

model Assessment {
  id             String             @id @default(uuid()) @db.Uuid
  classId        String             @map("class_id") @db.Uuid
  subjectId      String             @map("subject_id") @db.Uuid
  teacherId      String             @map("teacher_id") @db.Uuid
  journalId      String?            @map("journal_id") @db.Uuid
  title          String             @db.VarChar(120)
  category       AssessmentCategory @default(TUGAS)
  assessmentDate DateTime           @map("assessment_date") @db.Date
  maxScore       Decimal            @default(100.00) @map("max_score") @db.Decimal(5, 2)

  class          Class              @relation(fields: [classId], references: [id], onDelete: Cascade)
  subject        Subject            @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  teacher        Teacher            @relation(fields: [teacherId], references: [id], onDelete: Restrict)
  journal        ClassJournal?      @relation(fields: [journalId], references: [id], onDelete: SetNull)
  grades         StudentGrade[]

  @@index([classId, subjectId])
  @@map("assessments")
}

model StudentGrade {
  id              String      @id @default(uuid()) @db.Uuid
  assessmentId    String      @map("assessment_id") @db.Uuid
  studentId       String      @map("student_id") @db.Uuid
  score           Decimal     @db.Decimal(5, 2)
  teacherFeedback String?     @map("teacher_feedback") @db.VarChar(255)
  updatedAt       DateTime    @updatedAt @map("updated_at")

  assessment      Assessment  @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  student         Student     @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([assessmentId, studentId])
  @@index([studentId])
  @@map("student_grades")
}

// 5. Leave Requests & Notifications
model LeaveRequest {
  id             String         @id @default(uuid()) @db.Uuid
  studentId      String         @map("student_id") @db.Uuid
  parentId       String         @map("parent_id") @db.Uuid
  startDate      DateTime       @map("start_date") @db.Date
  endDate        DateTime       @map("end_date") @db.Date
  leaveType      LeaveType      @map("leave_type")
  reason         String         @db.Text
  attachmentUrl  String?        @map("attachment_url") @db.Text
  approvalStatus ApprovalStatus @default(PENDING) @map("approval_status")
  approvedById   String?        @map("approved_by_id") @db.Uuid
  createdAt      DateTime       @default(now()) @map("created_at")

  student        Student        @relation(fields: [studentId], references: [id], onDelete: Cascade)
  parent         Parent         @relation(fields: [parentId], references: [id], onDelete: Cascade)
  approvedBy     Teacher?       @relation("ApprovedByTeacher", fields: [approvedById], references: [id], onDelete: SetNull)

  @@index([studentId, approvalStatus])
  @@map("leave_requests")
}

model WaNotificationLog {
  id           String      @id @default(uuid()) @db.Uuid
  studentId    String      @map("student_id") @db.Uuid
  targetPhone  String      @map("target_phone") @db.VarChar(20)
  notifType    WaNotifType @map("notif_type")
  messageBody  String      @map("message_body") @db.Text
  status       WaStatus    @default(QUEUED)
  scheduledAt  DateTime    @default(now()) @map("scheduled_at")
  sentAt       DateTime?   @map("sent_at")

  student      Student     @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@index([status, scheduledAt])
  @@map("wa_notification_logs")
}
```

---

## 5. Strict Domain Rules & Business Logic Specifications

### 5.1 Dual-Layer Attendance Engine
The system resolves the critical loophole where students scan once in the morning and then ditch later classes:
1. **Layer 1: Gate Attendance (Kedatangan & Kepulangan)**
   - Scan between `06:00` and `GATE_LATE_THRESHOLD` (default `07:15 WIB`): Status marked `HADIR`, `late_minutes = 0`.
   - Scan after `GATE_LATE_THRESHOLD` and before `11:00 WIB`: Status marked `TERLAMBAT`, `late_minutes = max(0, minutes_past_threshold)`. Triggers high-priority WhatsApp notification dispatch.
   - Scan after `GATE_CHECKOUT_START` (default `13:30` / `14:00 WIB`): Sets `check_out_time`.
2. **Layer 2: Subject Classroom Attendance (Jurnal Mapel)**
   - When a teacher opens their journal session, the roster automatically **pre-fills**:
     * Students scanned at gate are marked `HADIR`.
     * Students with approved `LeaveRequest` on the date are marked `SAKIT` or `IZIN`.
     * Unscanned students with no leave are marked `ALPA_BOLOS`.
   - The teacher performs a rapid 1-tap confirmation. If a student who scanned at the gate is missing from class, the teacher selects `ALPA_BOLOS`.
   - **Bolos Detection Rule**: Any record where `GateAttendance.status == HADIR` but `SubjectAttendance.status == ALPA_BOLOS` flags a critical anomaly, triggering the Early Warning System and an immediate parent notification.

### 5.2 Anti-Fraud & Anti-Titip Absen Protocol
1. **Cryptographically Signed QR Tokens**:
   - Plaintext student IDs or raw NIS strings (e.g. `2026001`) are **strictly prohibited**.
   - Token structure: `SHD.<student_short_id>.<signature>` where `signature` is an 8-character hex HMAC-SHA256 of `student_short_id` generated with `QR_SIGNING_SECRET`.
   - The scanner validates the signature before checking the database. Counterfeit or tampered QR codes fail instantly.
2. **5-Minute Scan Cooldown (Rate Limiting)**:
   - Repeated scans of the same token within `< 300 seconds` are rejected idempotently. The server returns HTTP 200 with `{ status: "ALREADY_SCANNED", message: "Sudah tercatat hadir pada pukul 06:54 WIB" }`, preventing double database writes.
3. **Face Verification Pop-up & Audio Tones**:
   - On successful scan, the Kiosk UI displays a high-contrast modal featuring:
     * Full-size student profile photo (prominent visual confirmation).
     * Full Name and Class (e.g. "BUDI SANTOSO — X-IPA-1").
     * Arrival timestamp and status badge.
   - Petugas Piket immediately spots if the student presenting the card does not match the photo.
   - Dual audio cues: `beep-success.mp3` (clear high tone) vs `beep-error.mp3` (low warning tone).
4. **Manual Fallback ("Tanpa Kartu")**:
   - If a student forgets or damages their physical card, the operator searches by NIS/Name and logs attendance with `scanned_by = "MANUAL_OPERATOR_<id>"` for audit compliance.

### 5.3 Client-Side Photo Compression Pipeline
To guarantee that image uploads never exhaust free cloud storage:
- **Mandatory Canvas WebWorker Execution**:
  * Input: Raw camera photo (typically 3–5 MB JPEG from smartphone sensors).
  * Max resolution bounding box: `1280px` (longest side).
  * Output format: `image/webp`.
  * Compression quality: `0.75 – 0.78`.
  * Maximum payload size ceiling: **<= 180 KB** (average 120–150 KB).
  * Threading: Run inside a WebWorker via `browser-image-compression` or OffscreenCanvas so the main UI thread never drops frames or freezes during photo capture.
- **Upload Endpoint Policy**:
  * Server-side route handler rejects any incoming multipart file exceeding `250 KB` or with mime-type other than `image/webp`.
  * Direct upload to Cloudinary signed presets or Supabase Storage public bucket.

### 5.4 Two-Tier Assessment & Grading Engine
Prevents teacher burnout from daily grading while ensuring actionable academic tracking:
- **Tier 1: Quick Daily Engagement Badges (1 Tap)**
  * Default state: All present students receive `GOOD` (✅ *Mengikuti dengan Baik*).
  * Teacher only taps outliers:
    - `ACTIVE_STAR` (🌟 *Sangat Aktif / Bertanya / Maju ke Depan*)
    - `LESS_FOCUS` (⚠️ *Kurang Fokus / Mengantuk / Mengobrol*)
    - `NO_TASK` (❌ *Tidak Mengumpulkan Tugas Harian*)
  * Optional short text note per student (e.g. *"Aktif menjawab soal pecahan"*).
- **Tier 2: Formal Academic Assessments (0.00 – 100.00)**
  * Structured under categories: `TUGAS`, `KUIS`, `PRAKTIKUM`, `UH`, `PTS`, `PAS`.
  * Real-time KKM comparison: `score >= subject.kkmScore` renders green badge (*Tuntas*); `score < subject.kkmScore` renders amber badge (*Remedial Wajib*).
  * Batch input enabled via spreadsheet copy-paste parser (tab-separated / CSV paste handler).

### 5.5 WhatsApp Gateway & Anti-Ban Architecture
Prevents Meta automated spam detection and number blocking:
1. **Anomaly-First Notification Prioritization**:
   - **Immediate Dispatch Queue**:
     * `GATE_LATE` (Student arrives late).
     * `ALPA_BOLOS` (Student missing from class without excuse).
     * `LEAVE_STATUS` (Approval/rejection of leave request).
   - **Daily Digest Mode**:
     * Normal on-time arrival notifications are consolidated into an optional afternoon digest (15:00 WIB) summarizing attendance, subjects attended, and grades earned.
2. **Anti-Ban Jitter & Queue Management**:
   - Messages are enqueued to `wa_notification_logs`.
   - Dispatch worker enforces a **randomized delay of 4 to 10 seconds** between consecutive messages.
3. **Dynamic Spintax Message Formatting**:
   - Randomizes greeting, structure, and phrasing to eliminate repetitive message hash signatures:
   ```text
   {Assalamu'alaikum|Selamat Pagi|Halo} Bapak/Ibu {nama_ortu},
   Kami menginformasikan presensi putra/putri Anda:
   👤 Nama: *{nama_siswa}* ({kelas})
   🕒 Waktu Scan: {jam_scan} WIB
   📌 Status: *{status_kehadiran}*
   
   Pantau foto dokumentasi belajar & nilai harian melalui portal:
   🔗 {link_portal_ortu}
   ```

---

## 6. UI/UX Design System & Intelligence Standards

Synthesized from `ui-ux-pro-max`, `impeccable`, and `emil-design-eng`:

### 6.1 Design Tokens & The "Swiss & Minimalist Education" Aesthetic
- **Mode Selection**: **Operate Mode** for Teacher & Admin; **Read/Operate Mode** for Parent Portal.
- **Color Tokens**:
  ```css
  :root {
    --color-primary: #2563EB;          /* Tailwind blue-600: Trust, educational authority */
    --color-primary-hover: #1D4ED8;    /* Tailwind blue-700 */
    --color-background: #F8FAFC;       /* Tailwind slate-50: Crisp, glare-free background */
    --color-surface: #FFFFFF;          /* Pure white card containers */
    --color-foreground: #0F172A;       /* Tailwind slate-900: High-contrast typography */
    --color-muted: #475569;            /* Tailwind slate-600: Supporting metadata */
    --color-border: #E2E8F0;           /* Tailwind slate-200: Subtle separation lines */
    
    /* Semantic Status Tokens */
    --status-hadir-fg: #059669;        /* emerald-600 */
    --status-hadir-bg: #D1FAE5;        /* emerald-100 */
    --status-terlambat-fg: #D97706;    /* amber-600 */
    --status-terlambat-bg: #FEF3C7;    /* amber-100 */
    --status-izin-fg: #0284C7;         /* sky-600 */
    --status-izin-bg: #E0F2FE;         /* sky-100 */
    --status-sakit-fg: #7C3AED;        /* violet-600 */
    --status-sakit-bg: #EDE9FE;        /* violet-100 */
    --status-alpa-fg: #E11D48;         /* rose-600 */
    --status-alpa-bg: #FFE4E6;         /* rose-100 */
  }
  ```

### 6.2 Typography & Numerical Legibility
- **Font Stack**:
  * Primary UI Font: `Plus Jakarta Sans`, `Inter`, -apple-system, sans-serif.
  * Number & Data Font: `tabular-nums` CSS feature with fallback to `JetBrains Mono` for timestamps (`06:54 WIB`), student grades (`88.50`), and attendance matrix grids.
- **Type Hierarchy**:
  * Heading 1: 24px (1.5rem), font-weight 700, tracking -0.02em.
  * Heading 2: 18px (1.125rem), font-weight 600, tracking -0.01em.
  * Body: 14px (0.875rem), line-height 1.5, regular.
  * Caption / Badge: 12px (0.75rem), font-weight 600, uppercase letter-spacing 0.05em.

### 6.3 Emil Kowalski Micro-Interaction Rules
To make the web application feel tactile, responsive, and native:
1. **Active Button Feedback**: Every pressable element must have `transform: scale(0.97)` on `:active` with `transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1)`.
2. **Never Animate from `scale(0)`**: Entrances must scale from `scale(0.95)` with `opacity: 0` to `scale(1)` with `opacity: 1`. Modals enter centered; popovers scale from their trigger's anchor.
3. **Strict Easing Constraints**:
   - **Never use `ease-in`** for interactive UI (starts slow and feels sluggish).
   - Use custom ease-out: `cubic-bezier(0.23, 1, 0.32, 1)` for snappy entrance.
   - UI animation durations must stay **under 250ms**.
4. **No `transition: all`**: Always specify explicit animated properties (`transition: transform 160ms ease-out, opacity 160ms ease-out`).
5. **Tactile Haptics**: On mobile scanners, trigger `navigator.vibrate(10)` upon a valid QR decode.
6. **Accessibility**:
   - All interactive touch targets must measure at least **44px × 44px**.
   - Hover states must be gated behind `@media (hover: hover) and (pointer: fine)`.
   - Honor `prefers-reduced-motion` by reducing transform movements to gentle opacity transitions.

### 6.4 The 3-Second Rule (Parent Portal UX)
When a parent opens the dashboard, they must instantly see answers to three primary questions without scrolling:
1. *Is my child safely at school?* -> Large top status banner: `[✅ HADIR TEPAT WAKTU (06:48 WIB)]`.
2. *What are they currently learning?* -> Active class card with subject name, teacher, and topic.
3. *How is their daily participation?* -> Prominent badge (e.g. `🌟 Aktif Bertanya`).

---

## 7. Role-Based Navigation & Screen Specifications

### 7.1 Parent Portal (Mobile PWA First)
- **Persistent Header**: School crest/name, Notification bell, and **Child Switcher Dropdown** (for multi-child families to toggle between siblings in 1 tap without logging out).
- **Daily Timeline View**: Chronological vertical cards showing:
  * Gate check-in timestamp and lateness indicator.
  * Per-period class cards with teacher photo, subject, lesson topic, engagement badge, and direct classroom photo.
  * New assessment scores posted today.
  * Gate departure check-out timestamp.
- **Bottom Navigation Bar**: `[🏠 Beranda]` `[📸 Galeri Foto]` `[📊 Nilai & Rapor]` `[📝 Izin/Sakit]`.
- **Leave Request Screen**: Simple form with date picker, Sakit/Izin toggle, reason textarea, and camera upload for doctor's note (compressed automatically to WebP).

### 7.2 Teacher & Wali Kelas Portal (Mobile / Tablet First)
- **Today's Teaching Schedule**: Clean list of scheduled classes today with status tags (`Belum Mulai`, `Sedang Berlangsung`, `Selesai`).
- **Classroom Journal Form**:
  * Topic material input field.
  * Camera button with live compression preview showing compressed size (e.g. `134 KB WebP`).
  * Class roster with pre-filled gate attendance.
  * 1-tap engagement badge selector (`🌟`, `✅`, `⚠️`, `❌`) with default `✅`.
  * Quick score input column with numeric keypad hint (`inputmode="decimal"`).
- **Wali Kelas Verification Inbox**: Queue of pending leave requests submitted by parents, with 1-tap `[Terima]` and `[Tolak]` actions.

### 7.3 Gate Kiosk Scanner Screen (High-Contrast Desktop / Tablet)
- **Left Pane (Scanner Viewfinder)**:
  * Live camera stream with `html5-qrcode` overlay and active laser line animation.
  * Keyboard wedge listener capturing USB 2D scanner keystrokes terminating in `Enter`.
  * Manual fallback NIS search bar.
- **Right Pane (Verification HUD)**:
  * Current live school clock (`06:54:12 WIB`) using tabular numerals.
  * Large verified student portrait modal (prominent face view).
  * Student Name, NISN, and Class banner in high contrast.
  * Recent 5 scan history log with status badges and audio chime.

### 7.4 Admin & Recap Center (Desktop First)
- **Monthly Attendance Matrix**:
  * Full spreadsheet-style grid (Days 1–31).
  * Color-coded status tokens (`H`, `T`, `I`, `S`, `A`).
  * Right summary columns: Total Hadir, Sakit, Izin, Alpa, Terlambat, and **% Kehadiran**.
- **Early Warning System (EWS) Alert Panel**:
  * Automated table highlighting students exceeding thresholds:
    - Alpa >= 3 times in a month (Red highlight).
    - Terlambat >= 5 times in a month (Amber highlight).
    - Consecutive scores below KKM.
  * Action button: 1-click WhatsApp summons message to parent.
- **Export Engine**:
  * 1-click Export to Excel (`.xlsx`) with automated styling and formulas.
  * 1-click Print-Ready PDF with official school header (kop surat), date, and signature blocks.
- **Mass QR Card Generator**:
  * Standard CR80 layout (85.6mm × 54mm).
  * Grid of 8–10 cards per A4 page with school logo, photo, student identity, and high-contrast HMAC-signed QR code.

---

## 8. Milestone Execution & Directory Structure Mapping

Implementation proceeds through the 7 milestones established in `PROJECT.md`:

```text
d:\WEBSITE ABSENSI\
├── agent.md                            # Blueprint implemented (M1)
├── PROJECT.md                          # Master milestone plan & feature inventory (M1)
├── graphify-out/                       # Knowledge graph tracking (M1)
├── package.json                        # Next.js 15, Tailwind, Prisma, Lucide (M2)
├── tsconfig.json                       # Strict TypeScript configuration (M2)
├── tailwind.config.ts                  # Design tokens, color palette, fonts (M2)
├── prisma/
│   ├── schema.prisma                   # 13 Core ERD tables + Relations (M2)
│   └── seed.ts                         # Realistic Indonesian school demo seed (M2)
├── public/
│   ├── manifest.json                   # Mobile PWA configuration (M6)
│   ├── sounds/                         # beep-success.mp3, beep-error.mp3 (M3)
│   └── icons/                          # PWA icons (M6)
└── src/
    ├── app/
    │   ├── (auth)/login/               # Role-based login (WA + PIN for Parents) (M2, M6)
    │   ├── (scanner)/gate-scanner/     # High-contrast Gate Kiosk scanner (M3, M6)
    │   ├── (teacher)/
    │   │   ├── dashboard/              # Teaching schedule & quick actions (M4, M6)
    │   │   ├── journal/[id]/           # Classroom journal + attendance + photo (M4)
    │   │   └── grades/                 # Academic assessment grade entry (M4)
    │   ├── (parent)/
    │   │   ├── parent-dashboard/       # Real-time timeline & child switcher (M6)
    │   │   ├── documentations/         # Class activity photo gallery (M6)
    │   │   ├── grades-report/          # Grade history & KKM tracker (M6)
    │   │   └── leave-request/          # Online leave form with photo proof (M3, M6)
    │   └── (admin)/
    │       ├── master-data/            # CRUD Academic, Class, Teacher, Student (M2)
    │       ├── qr-cards/               # Mass CR80 PDF generator (M5)
    │       ├── recap-attendance/       # 1-31 Matrix & EWS panel (M5)
    │       └── wa-settings/            # WhatsApp gateway & log monitor (M5)
    ├── components/
    │   ├── ui/                         # Button, Card, Badge, Modal, Toaster (M2, M6)
    │   ├── attendance/                 # QR viewfinder, FacePopup, RosterTable (M3)
    │   ├── grading/                    # BadgeSelector, GradeGrid, KkmIndicator (M4)
    │   ├── documentation/              # WebpUploader, PhotoGrid (M4)
    │   └── parent/                     # ChildSwitcher, ActivityTimeline (M6)
    ├── lib/
    │   ├── db.ts                       # Prisma client singleton (M2)
    │   ├── compression.ts              # WebP Canvas compression engine (<180KB) (M4)
    │   ├── qr-token.ts                 # HMAC token generation & validation (M3)
    │   ├── whatsapp.ts                 # Fonnte REST client, queue & Spintax (M5)
    │   └── export-excel-pdf.ts         # ExcelJS & jsPDF export utilities (M5)
    └── types/                          # Shared database & view interfaces (M2)
```

---

## 9. Code Quality Floor, Safety & Development Guidelines

1. **Strict Type Safety**: No usage of `any`. All API responses, Server Action returns, and component props must be explicitly typed.
2. **Server Action Validation**: Validate all inputs using `zod` before executing database mutations.
3. **Data Boundary Enforcement**: Parent sessions must strictly enforce Row-Level Security / session filtering so parents can never query data belonging to other students.
4. **Toast Feedback**: All user actions (save, update, delete, submit) must trigger clean toast feedback via Sonner with accessible text.
5. **Zero Console Warnings**: Clean compile and typecheck without unused variable warnings or unhandled Promise rejections.
