import {
  PrismaClient,
  Role,
  Gender,
  StudentStatus,
  ParentRelation,
  GateStatus,
  SubjectStatus,
  EngagementBadge,
  AssessmentCategory,
  DocVisibility,
  LeaveType,
  ApprovalStatus,
  WaNotifType,
  WaStatus,
} from "@prisma/client";
import * as crypto from "node:crypto";

const prisma = new PrismaClient();

// Configuration
const QR_SECRET =
  process.env.QR_SIGNING_SECRET ||
  "kunci-rahasia-penandatangan-kartu-qr-siswa-2026";
// Precomputed bcrypt hash for password "Password123!" with 10 rounds
const DEFAULT_PASSWORD_HASH =
  "$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa";

/**
 * Generate cryptographically signed QR token: SHD.<student_short_id>.<signature_8char>
 * Per agent.md Section 5.2 and ARCHITECTURE.md Section 5.1
 */
function generateQrToken(shortId: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(shortId);
  const signature = hmac.digest("hex").substring(0, 8);
  return `SHD.${shortId}.${signature}`;
}

async function main() {
  console.log("🌱 Starting SiHadir-Edu database seeding...");
  const startTime = Date.now();

  // ---------------------------------------------------------------------------
  // 0. Clean Existing Data (Reverse foreign key dependency order)
  // ---------------------------------------------------------------------------
  console.log("🧹 Cleaning existing records...");
  await prisma.waNotificationLog.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.studentGrade.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.documentation.deleteMany();
  await prisma.subjectAttendance.deleteMany();
  await prisma.classJournal.deleteMany();
  await prisma.gateAttendance.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.parentStudentLink.deleteMany();
  await prisma.student.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.class.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.academicYear.deleteMany();
  await prisma.user.deleteMany();

  // ---------------------------------------------------------------------------
  // 1. Seed Academic Year
  // ---------------------------------------------------------------------------
  console.log("📅 Seeding Academic Year...");
  const academicYear = await prisma.academicYear.create({
    data: {
      yearName: "2026/2027",
      semester: 1, // 1: Ganjil
      isActive: true,
    },
  });

  // ---------------------------------------------------------------------------
  // 2. Seed System Users (Admin & Gate Scanner)
  // ---------------------------------------------------------------------------
  console.log("👤 Seeding System Users (Admin & Scanner)...");
  await prisma.user.create({
    data: {
      name: "Administrator SiHadir",
      email: "admin@sihadiredu.sch.id",
      phoneWa: "081100000001",
      passwordHash: DEFAULT_PASSWORD_HASH,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      name: "Petugas Piket Gerbang",
      email: "piket@sihadiredu.sch.id",
      phoneWa: "081100000002",
      passwordHash: DEFAULT_PASSWORD_HASH,
      role: Role.SCANNER,
      isActive: true,
    },
  });

  // ---------------------------------------------------------------------------
  // 3. Seed Teachers & Profiles
  // ---------------------------------------------------------------------------
  console.log("👨‍🏫 Seeding Teachers...");
  const teacherData = [
    {
      name: "Dra. Hj. Siti Nurhaliza, M.Pd.",
      email: "siti.nurhaliza@sihadiredu.sch.id",
      phoneWa: "081234567801",
      nip: "197805122003122001",
      specialty: "Matematika",
    },
    {
      name: "Bambang Pamungkas, S.Pd.",
      email: "bambang.pamungkas@sihadiredu.sch.id",
      phoneWa: "081234567802",
      nip: "198308252008011005",
      specialty: "Bahasa Indonesia",
    },
    {
      name: "Dewi Sartika, S.Si.",
      email: "dewi.sartika@sihadiredu.sch.id",
      phoneWa: "081234567803",
      nip: "198902142014032002",
      specialty: "Ilmu Pengetahuan Alam",
    },
    {
      name: "Ahmad Fauzi, S.Pd., M.Hum.",
      email: "ahmad.fauzi@sihadiredu.sch.id",
      phoneWa: "081234567804",
      nip: "199104192019021004",
      specialty: "Bahasa Inggris",
    },
    {
      name: "Ust. Muhammad Ilham, Lc., M.A.",
      email: "muhammad.ilham@sihadiredu.sch.id",
      phoneWa: "081234567805",
      nip: "198611032011011003",
      specialty: "Pendidikan Agama Islam",
    },
  ];

  const teachers = [];
  for (const t of teacherData) {
    const user = await prisma.user.create({
      data: {
        name: t.name,
        email: t.email,
        phoneWa: t.phoneWa,
        passwordHash: DEFAULT_PASSWORD_HASH,
        role: Role.TEACHER,
        isActive: true,
      },
    });

    const teacher = await prisma.teacher.create({
      data: {
        userId: user.id,
        fullName: t.name,
        nip: t.nip,
        phoneWa: t.phoneWa,
        specialty: t.specialty,
      },
    });
    teachers.push(teacher);
  }

  // ---------------------------------------------------------------------------
  // 4. Seed Classes & Assign Homeroom Teachers (Wali Kelas)
  // ---------------------------------------------------------------------------
  console.log("🏫 Seeding Classes...");
  const classX1 = await prisma.class.create({
    data: {
      academicYearId: academicYear.id,
      className: "X-IPA-1",
      gradeLevel: 10,
      homeroomTeacherId: teachers[0].id, // Siti Nurhaliza
    },
  });

  const classX2 = await prisma.class.create({
    data: {
      academicYearId: academicYear.id,
      className: "X-IPA-2",
      gradeLevel: 10,
      homeroomTeacherId: teachers[1].id, // Bambang Pamungkas
    },
  });

  const classXI1 = await prisma.class.create({
    data: {
      academicYearId: academicYear.id,
      className: "XI-IPA-1",
      gradeLevel: 11,
      homeroomTeacherId: teachers[2].id, // Dewi Sartika
    },
  });

  const classes = [classX1, classX2, classXI1];

  // ---------------------------------------------------------------------------
  // 5. Seed Subjects with Official KKM Thresholds
  // ---------------------------------------------------------------------------
  console.log("📚 Seeding Subjects...");
  const subjectData = [
    { code: "MTK", name: "Matematika", kkm: 75.0 },
    { code: "BIN", name: "Bahasa Indonesia", kkm: 75.0 },
    { code: "BIG", name: "Bahasa Inggris", kkm: 75.0 },
    { code: "IPA", name: "Ilmu Pengetahuan Alam", kkm: 75.0 },
    { code: "PAI", name: "Pendidikan Agama Islam", kkm: 78.0 },
  ];

  const subjects = [];
  for (const s of subjectData) {
    const sub = await prisma.subject.create({
      data: {
        subjectCode: s.code,
        subjectName: s.name,
        kkmScore: s.kkm,
      },
    });
    subjects.push(sub);
  }

  // ---------------------------------------------------------------------------
  // 6. Seed Students with Signed QR Tokens
  // ---------------------------------------------------------------------------
  console.log("🎓 Seeding Students with HMAC Signed QR Tokens...");
  const rawStudentRoster = [
    // Class X-IPA-1 (7 students)
    {
      classId: classX1.id,
      nis: "26101",
      nisn: "0081234567",
      name: "Budi Santoso",
      gender: Gender.L,
    },
    {
      classId: classX1.id,
      nis: "26102",
      nisn: "0081234568",
      name: "Siti Rahmawati",
      gender: Gender.P,
    },
    {
      classId: classX1.id,
      nis: "26103",
      nisn: "0081234569",
      name: "Ahmad Pratama",
      gender: Gender.L,
    },
    {
      classId: classX1.id,
      nis: "26104",
      nisn: "0081234570",
      name: "Ayu Lestari",
      gender: Gender.P,
    },
    {
      classId: classX1.id,
      nis: "26105",
      nisn: "0081234571",
      name: "Farhan Saputra",
      gender: Gender.L,
    },
    {
      classId: classX1.id,
      nis: "26106",
      nisn: "0081234572",
      name: "Nabila Zahra",
      gender: Gender.P,
    },
    {
      classId: classX1.id,
      nis: "26107",
      nisn: "0081234573",
      name: "Muhammad Rizky",
      gender: Gender.L,
    },

    // Class X-IPA-2 (6 students)
    {
      classId: classX2.id,
      nis: "26108",
      nisn: "0081234574",
      name: "Reza Firmansyah",
      gender: Gender.L,
    },
    {
      classId: classX2.id,
      nis: "26109",
      nisn: "0081234575",
      name: "Putri Anggraini",
      gender: Gender.P,
    },
    {
      classId: classX2.id,
      nis: "26110",
      nisn: "0081234576",
      name: "Hendra Gunawan",
      gender: Gender.L,
    },
    {
      classId: classX2.id,
      nis: "26111",
      nisn: "0081234577",
      name: "Rina Melati",
      gender: Gender.P,
    },
    {
      classId: classX2.id,
      nis: "26112",
      nisn: "0081234578",
      name: "Dimas Arya",
      gender: Gender.L,
    },
    {
      classId: classX2.id,
      nis: "26113",
      nisn: "0081234579",
      name: "Maya Indah",
      gender: Gender.P,
    },

    // Class XI-IPA-1 (5 students)
    {
      classId: classXI1.id,
      nis: "26114",
      nisn: "0081234580",
      name: "Tari Safitri",
      gender: Gender.P,
    },
    {
      classId: classXI1.id,
      nis: "26115",
      nisn: "0081234581",
      name: "Dian Kusuma",
      gender: Gender.P,
    },
    {
      classId: classXI1.id,
      nis: "26116",
      nisn: "0081234582",
      name: "Eko Prasetyo",
      gender: Gender.L,
    },
    {
      classId: classXI1.id,
      nis: "26117",
      nisn: "0081234583",
      name: "Citra Dewi",
      gender: Gender.P,
    },
    {
      classId: classXI1.id,
      nis: "26118",
      nisn: "0081234584",
      name: "Gilang Ramadhan",
      gender: Gender.L,
    },
  ];

  const students = [];
  for (const s of rawStudentRoster) {
    const shortId = `std${s.nis}`;
    const qrToken = generateQrToken(shortId, QR_SECRET);
    const photoUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.name.replace(/\s+/g, "")}`;

    const student = await prisma.student.create({
      data: {
        classId: s.classId,
        nis: s.nis,
        nisn: s.nisn,
        fullName: s.name,
        gender: s.gender,
        photoUrl: photoUrl,
        qrToken: qrToken,
        status: StudentStatus.ACTIVE,
      },
    });
    students.push(student);
  }

  // ---------------------------------------------------------------------------
  // 7. Seed Parents & Sibling Multi-Child Links
  // ---------------------------------------------------------------------------
  console.log("👨‍👩‍👧 Seeding Parents & Multi-Child Links (Sibling Pairs)...");
  const parentRawData = [
    { name: "Hendra Supriyadi", phone: "081290000001", occupation: "Wiraswasta" },
    { name: "Sri Wahyuni", phone: "081290000002", occupation: "PNS Guru" },
    { name: "Agus Pratama", phone: "081290000003", occupation: "Karyawan BUMN" },
    { name: "Dedi Irawan", phone: "081290000004", occupation: "Dokter" },
    { name: "Surya Saputra", phone: "081290000005", occupation: "Arsitek" },
    { name: "Rahmat Hidayat", phone: "081290000006", occupation: "Pedagang" },
    { name: "Eko Sulistyo", phone: "081290000007", occupation: "Dosen" },
    { name: "Heri Anggoro", phone: "081290000008", occupation: "Pengusaha" },
    { name: "Bambang Gunawan", phone: "081290000009", occupation: "PNS Kemenkeu" },
    { name: "Yanto Melati", phone: "081290000010", occupation: "Konsultan TI" },
  ];

  const parents = [];
  for (const p of parentRawData) {
    const user = await prisma.user.create({
      data: {
        name: p.name,
        phoneWa: p.phone,
        passwordHash: DEFAULT_PASSWORD_HASH,
        role: Role.PARENT,
        isActive: true,
      },
    });

    const parent = await prisma.parent.create({
      data: {
        userId: user.id,
        fullName: p.name,
        phoneWa: p.phone,
        occupation: p.occupation,
      },
    });
    parents.push(parent);
  }

  // Sibling Links:
  // Sibling Pair 1: Parent 0 (Hendra Supriyadi) -> Budi Santoso (X-IPA-1) & Tari Safitri (XI-IPA-1)
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[0].id,
      studentId: students[0].id,
      relation: ParentRelation.AYAH,
      receiveWaNotif: true,
    },
  });
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[0].id,
      studentId: students[13].id,
      relation: ParentRelation.AYAH,
      receiveWaNotif: true,
    },
  });

  // Sibling Pair 2: Parent 1 (Sri Wahyuni) -> Siti Rahmawati (X-IPA-1) & Reza Firmansyah (X-IPA-2)
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[1].id,
      studentId: students[1].id,
      relation: ParentRelation.IBU,
      receiveWaNotif: true,
    },
  });
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[1].id,
      studentId: students[7].id,
      relation: ParentRelation.IBU,
      receiveWaNotif: true,
    },
  });

  // Remaining Single and Cross-Grade links
  // Parent 2 (Agus Pratama) -> Ahmad Pratama & Dimas Arya
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[2].id,
      studentId: students[2].id,
      relation: ParentRelation.AYAH,
      receiveWaNotif: true,
    },
  });
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[2].id,
      studentId: students[11].id,
      relation: ParentRelation.AYAH,
      receiveWaNotif: true,
    },
  });

  // Parent 3 (Dedi Irawan) -> Ayu Lestari & Maya Indah
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[3].id,
      studentId: students[3].id,
      relation: ParentRelation.AYAH,
      receiveWaNotif: true,
    },
  });
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[3].id,
      studentId: students[12].id,
      relation: ParentRelation.AYAH,
      receiveWaNotif: true,
    },
  });

  // Parent 4 (Surya Saputra) -> Farhan Saputra & Dian Kusuma
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[4].id,
      studentId: students[4].id,
      relation: ParentRelation.AYAH,
      receiveWaNotif: true,
    },
  });
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[4].id,
      studentId: students[14].id,
      relation: ParentRelation.AYAH,
      receiveWaNotif: true,
    },
  });

  // Parent 5 (Rahmat Hidayat) -> Nabila Zahra & Eko Prasetyo
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[5].id,
      studentId: students[5].id,
      relation: ParentRelation.AYAH,
      receiveWaNotif: true,
    },
  });
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[5].id,
      studentId: students[15].id,
      relation: ParentRelation.AYAH,
      receiveWaNotif: true,
    },
  });

  // Parent 6 (Eko Sulistyo) -> Muhammad Rizky & Citra Dewi
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[6].id,
      studentId: students[6].id,
      relation: ParentRelation.AYAH,
      receiveWaNotif: true,
    },
  });
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[6].id,
      studentId: students[16].id,
      relation: ParentRelation.AYAH,
      receiveWaNotif: true,
    },
  });

  // Parent 7 (Heri Anggoro) -> Putri Anggraini & Gilang Ramadhan
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[7].id,
      studentId: students[8].id,
      relation: ParentRelation.AYAH,
      receiveWaNotif: true,
    },
  });
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[7].id,
      studentId: students[17].id,
      relation: ParentRelation.AYAH,
      receiveWaNotif: true,
    },
  });

  // Parent 8 (Bambang Gunawan) -> Hendra Gunawan
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[8].id,
      studentId: students[9].id,
      relation: ParentRelation.AYAH,
      receiveWaNotif: true,
    },
  });

  // Parent 9 (Yanto Melati) -> Rina Melati
  await prisma.parentStudentLink.create({
    data: {
      parentId: parents[9].id,
      studentId: students[10].id,
      relation: ParentRelation.AYAH,
      receiveWaNotif: true,
    },
  });

  // ---------------------------------------------------------------------------
  // 8. Seed Teaching Schedules (Timetable)
  // ---------------------------------------------------------------------------
  console.log("🗓️ Seeding Schedules...");
  // Mapping helpers
  const mtk = subjects.find((s) => s.subjectCode === "MTK")!;
  const bin = subjects.find((s) => s.subjectCode === "BIN")!;
  const big = subjects.find((s) => s.subjectCode === "BIG")!;
  const ipa = subjects.find((s) => s.subjectCode === "IPA")!;
  const pai = subjects.find((s) => s.subjectCode === "PAI")!;

  const siti = teachers.find((t) => t.specialty === "Matematika")!;
  const bambang = teachers.find((t) => t.specialty === "Bahasa Indonesia")!;
  const dewi = teachers.find((t) => t.specialty === "Ilmu Pengetahuan Alam")!;
  const fauzi = teachers.find((t) => t.specialty === "Bahasa Inggris")!;
  const ilham = teachers.find((t) => t.specialty === "Pendidikan Agama Islam")!;

  const scheduleEntries = [
    // Senin
    { classId: classX1.id, subjectId: mtk.id, teacherId: siti.id, day: 1, pStart: 1, pEnd: 2 },
    { classId: classX1.id, subjectId: bin.id, teacherId: bambang.id, day: 1, pStart: 3, pEnd: 4 },
    { classId: classX2.id, subjectId: bin.id, teacherId: bambang.id, day: 1, pStart: 1, pEnd: 2 },
    { classId: classX2.id, subjectId: ipa.id, teacherId: dewi.id, day: 1, pStart: 3, pEnd: 4 },
    { classId: classXI1.id, subjectId: ipa.id, teacherId: dewi.id, day: 1, pStart: 1, pEnd: 3 },

    // Selasa
    { classId: classX1.id, subjectId: big.id, teacherId: fauzi.id, day: 2, pStart: 1, pEnd: 2 },
    { classId: classX1.id, subjectId: pai.id, teacherId: ilham.id, day: 2, pStart: 3, pEnd: 4 },
    { classId: classX2.id, subjectId: mtk.id, teacherId: siti.id, day: 2, pStart: 1, pEnd: 2 },
    { classId: classXI1.id, subjectId: big.id, teacherId: fauzi.id, day: 2, pStart: 1, pEnd: 2 },
    { classId: classXI1.id, subjectId: pai.id, teacherId: ilham.id, day: 2, pStart: 3, pEnd: 4 },

    // Rabu
    { classId: classX1.id, subjectId: ipa.id, teacherId: dewi.id, day: 3, pStart: 1, pEnd: 3 },
    { classId: classX2.id, subjectId: pai.id, teacherId: ilham.id, day: 3, pStart: 1, pEnd: 2 },
    { classId: classX2.id, subjectId: big.id, teacherId: fauzi.id, day: 3, pStart: 3, pEnd: 4 },
    { classId: classXI1.id, subjectId: mtk.id, teacherId: siti.id, day: 3, pStart: 1, pEnd: 2 },
    { classId: classXI1.id, subjectId: bin.id, teacherId: bambang.id, day: 3, pStart: 3, pEnd: 4 },
  ];

  const createdSchedules = [];
  for (const s of scheduleEntries) {
    const sched = await prisma.schedule.create({
      data: {
        classId: s.classId,
        subjectId: s.subjectId,
        teacherId: s.teacherId,
        dayOfWeek: s.day,
        periodStart: s.pStart,
        periodEnd: s.pEnd,
      },
    });
    createdSchedules.push(sched);
  }

  // ---------------------------------------------------------------------------
  // 9. Seed Sample Initial Attendance & Activity for Verification
  // ---------------------------------------------------------------------------
  console.log("⏱️ Seeding Sample Gate Attendance & Today's Journal...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Student 0 (Budi Santoso) - Arrived on-time at 06:45 WIB
  const checkInOnTime = new Date(today);
  checkInOnTime.setHours(6, 45, 0, 0);
  await prisma.gateAttendance.create({
    data: {
      studentId: students[0].id,
      attendanceDate: today,
      checkInTime: checkInOnTime,
      status: GateStatus.HADIR,
      lateMinutes: 0,
      scannedBy: "KIOSK_GATE_1",
    },
  });

  // Student 1 (Siti Rahmawati) - Arrived late at 07:35 WIB (20 mins late)
  const checkInLate = new Date(today);
  checkInLate.setHours(7, 35, 0, 0);
  await prisma.gateAttendance.create({
    data: {
      studentId: students[1].id,
      attendanceDate: today,
      checkInTime: checkInLate,
      status: GateStatus.TERLAMBAT,
      lateMinutes: 20,
      scannedBy: "KIOSK_GATE_1",
    },
  });

  // Student 2 (Ahmad Pratama) - Leave Request SAKIT approved by Wali Kelas
  await prisma.leaveRequest.create({
    data: {
      studentId: students[2].id,
      parentId: parents[2].id,
      startDate: today,
      endDate: today,
      leaveType: LeaveType.SAKIT,
      reason: "Demam tinggi dan flu, istirahat dokter 1 hari.",
      attachmentUrl:
        "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=800",
      approvalStatus: ApprovalStatus.APPROVED,
      approvedById: teachers[0].id,
    },
  });

  // Sample Class Journal for X-IPA-1 (Senin Jam 1-2: Matematika)
  const mondayMathSchedule = createdSchedules[0];
  const journal = await prisma.classJournal.create({
    data: {
      scheduleId: mondayMathSchedule.id,
      classId: classX1.id,
      subjectId: mtk.id,
      teacherId: siti.id,
      journalDate: today,
      periodStart: 1,
      periodEnd: 2,
      topicMaterial: "Sistem Persamaan Linear Dua Variabel (SPLDV)",
      teacherNotes:
        "Siswa aktif berdiskusi dalam kelompok. Budi menyelesaikan soal latihan di papan tulis.",
    },
  });

  // Subject attendances for journal
  await prisma.subjectAttendance.create({
    data: {
      journalId: journal.id,
      studentId: students[0].id, // Budi Santoso
      status: SubjectStatus.HADIR,
      engagementBadge: EngagementBadge.ACTIVE_STAR,
      note: "Aktif maju mengerjakan contoh soal SPLDV.",
    },
  });

  await prisma.subjectAttendance.create({
    data: {
      journalId: journal.id,
      studentId: students[1].id, // Siti Rahmawati
      status: SubjectStatus.HADIR,
      engagementBadge: EngagementBadge.GOOD,
      note: "Mengikuti materi dengan baik setelah tiba di kelas.",
    },
  });

  await prisma.subjectAttendance.create({
    data: {
      journalId: journal.id,
      studentId: students[2].id, // Ahmad Pratama
      status: SubjectStatus.SAKIT,
      engagementBadge: EngagementBadge.GOOD,
      note: "Izin sakit (surat terlampir).",
    },
  });

  // Documentation photo proof (WebP compressed <180KB)
  await prisma.documentation.create({
    data: {
      journalId: journal.id,
      imageUrl:
        "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1280",
      caption:
        "Diskusi kelompok penyelesaian soal cerita metode eliminasi SPLDV.",
      visibility: DocVisibility.CLASS_PUBLIC,
      fileSizeKb: 142,
    },
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Seeding completed successfully in ${duration}s!`);
  console.log(`📊 Summary of Seeded Entities:`);
  console.log(`   - 1 Active Academic Year (2026/2027 Ganjil)`);
  console.log(`   - 3 Classes (X-IPA-1, X-IPA-2, XI-IPA-1)`);
  console.log(`   - 5 Teachers with Homeroom assignments`);
  console.log(`   - 2 System Admin/Scanner Users`);
  console.log(`   - 5 Subjects with KKM (75.00 / 78.00)`);
  console.log(`   - 18 Students with HMAC-SHA256 Signed QR Tokens`);
  console.log(`   - 10 Parents & 12 Relational Links (2 Verified Sibling Pairs)`);
  console.log(`   - 15 Teaching Schedule Entries`);
  console.log(`   - Sample Gate Attendance, Leave Request & Class Journal`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
