/**
 * Seed fixtures and realistic demographic data for E2E testing
 * SiHadir-Edu (Milestone 7)
 */

import { generateSignedQrToken } from '../../../src/lib/qr-token';
import { hashPin } from '../../../src/lib/auth-crypto';

export interface MockAcademicYear {
  id: string;
  yearName: string;
  semester: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockClass {
  id: string;
  className: string;
  gradeLevel: number;
  academicYearId: string;
  homeroomTeacherId: string;
  roomNumber?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockTeacher {
  id: string;
  userId: string;
  nip: string;
  fullName: string;
  phoneWa: string;
  specialty: string;
}

export interface MockSubject {
  id: string;
  subjectCode: string;
  subjectName: string;
  kkmScore: number;
  gradeLevel: number;
  isActive: boolean;
}

export interface MockStudent {
  id: string;
  nis: string;
  nisn: string;
  fullName: string;
  gender: 'L' | 'P';
  classId: string;
  qrToken: string;
  status: 'ACTIVE' | 'GRADUATED' | 'MOVED';
  photoUrl?: string | null;
  phoneWa?: string | null;
}

export interface MockParent {
  id: string;
  userId: string;
  fullName: string;
  phoneWa: string;
  occupation?: string;
}

export interface MockParentStudentLink {
  id: string;
  parentId: string;
  studentId: string;
  relation: 'AYAH' | 'IBU' | 'WALI';
  receiveWaNotif: boolean;
  isEmergencyContact: boolean;
}

export const SEED_ACADEMIC_YEARS: MockAcademicYear[] = [
  {
    id: 'ay-2025-ganjil',
    yearName: '2025/2026',
    semester: 1,
    startDate: new Date('2025-07-15T00:00:00.000Z'),
    endDate: new Date('2025-12-20T00:00:00.000Z'),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'ay-2025-genap',
    yearName: '2025/2026',
    semester: 2,
    startDate: new Date('2026-01-05T00:00:00.000Z'),
    endDate: new Date('2026-06-25T00:00:00.000Z'),
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const SEED_TEACHERS: MockTeacher[] = [
  {
    id: 'teacher-siti',
    userId: 'user-teacher-siti',
    nip: '197508152000032001',
    fullName: 'Dra. Hj. Siti Nurhaliza',
    phoneWa: '081234567890',
    specialty: 'Matematika',
  },
  {
    id: 'teacher-bambang',
    userId: 'user-teacher-bambang',
    nip: '198203102005011002',
    fullName: 'Bambang Pamungkas, S.Pd',
    phoneWa: '081234567891',
    specialty: 'Bahasa Indonesia',
  },
  {
    id: 'teacher-sri',
    userId: 'user-teacher-sri',
    nip: '198511202008012003',
    fullName: 'Sri Wahyuni, M.Pd',
    phoneWa: '081234567892',
    specialty: 'Fisika',
  },
];

export const SEED_CLASSES: MockClass[] = [
  {
    id: 'class-x-ipa-1',
    className: 'X-IPA-1',
    gradeLevel: 10,
    academicYearId: 'ay-2025-ganjil',
    homeroomTeacherId: 'teacher-siti',
    roomNumber: 'R-101',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'class-x-ipa-2',
    className: 'X-IPA-2',
    gradeLevel: 10,
    academicYearId: 'ay-2025-ganjil',
    homeroomTeacherId: 'teacher-bambang',
    roomNumber: 'R-102',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'class-xi-ipa-1',
    className: 'XI-IPA-1',
    gradeLevel: 11,
    academicYearId: 'ay-2025-ganjil',
    homeroomTeacherId: 'teacher-sri',
    roomNumber: 'R-201',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const SEED_SUBJECTS: MockSubject[] = [
  {
    id: 'subj-mtk',
    subjectCode: 'MTK',
    subjectName: 'Matematika',
    kkmScore: 75.0,
    gradeLevel: 10,
    isActive: true,
  },
  {
    id: 'subj-bin',
    subjectCode: 'BIN',
    subjectName: 'Bahasa Indonesia',
    kkmScore: 75.0,
    gradeLevel: 10,
    isActive: true,
  },
  {
    id: 'subj-fis',
    subjectCode: 'FIS',
    subjectName: 'Fisika',
    kkmScore: 75.0,
    gradeLevel: 10,
    isActive: true,
  },
  {
    id: 'subj-big',
    subjectCode: 'BIG',
    subjectName: 'Bahasa Inggris',
    kkmScore: 75.0,
    gradeLevel: 10,
    isActive: true,
  },
];

// Indonesian sample names generator for 100 students
const FIRST_NAMES_MALE = [
  'Budi', 'Ahmad', 'Farhan', 'Dimas', 'Rizky', 'Fajar', 'Eko', 'Bayu', 'Gilang',
  'Ilham', 'Aditya', 'Doni', 'Hendra', 'Wahyu', 'Bagus', 'Indra', 'Agus', 'Teguh',
  'Galih', 'Yusuf'
];

const FIRST_NAMES_FEMALE = [
  'Siti', 'Dewi', 'Putri', 'Nurul', 'Rina', 'Mega', 'Anisa', 'Nadia', 'Dian',
  'Fitri', 'Ayu', 'Intan', 'Tiara', 'Lestari', 'Rahma', 'Wulan', 'Maya', 'Sari',
  'Tari', 'Zahra'
];

const LAST_NAMES = [
  'Santoso', 'Rahmawati', 'Fauzi', 'Lestari', 'Saputra', 'Pratama', 'Hidayat',
  'Kusuma', 'Wibowo', 'Nugroho', 'Siregar', 'Nasution', 'Kurniawan', 'Gunawan',
  'Permana', 'Setiawan', 'Utami', 'Mahendra', 'Suryani', 'Wijaya'
];

export function generateSeedStudents(count: number = 100): MockStudent[] {
  const students: MockStudent[] = [];
  for (let i = 1; i <= count; i++) {
    const nisNum = 26100 + i;
    const nis = nisNum.toString();
    const nisn = `007${nisNum}01`;
    const isMale = i % 2 !== 0;
    const firstList = isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE;
    const firstName = firstList[(i - 1) % firstList.length];
    const lastName = LAST_NAMES[(i - 1) % LAST_NAMES.length];
    const fullName = `${firstName} ${lastName}`;
    const gender: 'L' | 'P' = isMale ? 'L' : 'P';
    const classId = i <= 30 ? 'class-x-ipa-1' : i <= 65 ? 'class-x-ipa-2' : 'class-xi-ipa-1';
    const qrToken = generateSignedQrToken(nis);

    students.push({
      id: `std-${nis}`,
      nis,
      nisn,
      fullName,
      gender,
      classId,
      qrToken,
      status: 'ACTIVE',
      photoUrl: i <= 5 ? `/images/students/${nis}.jpg` : null,
      phoneWa: `0812${String(10000000 + i).padStart(8, '0')}`,
    });
  }
  return students;
}

export const SEED_STUDENTS = generateSeedStudents(100);

export const SEED_PARENTS: MockParent[] = [
  {
    id: 'parent-hendra',
    userId: 'user-parent-hendra',
    fullName: 'Hendra Wijaya',
    phoneWa: '081290000001',
    occupation: 'Wiraswasta',
  },
  {
    id: 'parent-agus',
    userId: 'user-parent-agus',
    fullName: 'Agus Rahmawati',
    phoneWa: '081290000002',
    occupation: 'PNS',
  },
  {
    id: 'parent-joko',
    userId: 'user-parent-joko',
    fullName: 'Joko Saputra',
    phoneWa: '081290000003',
    occupation: 'Karyawan Swasta',
  },
];

export const SEED_PARENT_STUDENT_LINKS: MockParentStudentLink[] = [
  {
    id: 'link-hendra-budi',
    parentId: 'parent-hendra',
    studentId: 'std-26101', // Budi Santoso (X-IPA-1)
    relation: 'AYAH',
    receiveWaNotif: true,
    isEmergencyContact: true,
  },
  {
    id: 'link-hendra-dewi',
    parentId: 'parent-hendra',
    studentId: 'std-26104', // Dewi Lestari (X-IPA-1 - sibling)
    relation: 'AYAH',
    receiveWaNotif: true,
    isEmergencyContact: true,
  },
  {
    id: 'link-agus-siti',
    parentId: 'parent-agus',
    studentId: 'std-26102', // Siti Rahmawati
    relation: 'AYAH',
    receiveWaNotif: true,
    isEmergencyContact: true,
  },
  {
    id: 'link-joko-farhan',
    parentId: 'parent-joko',
    studentId: 'std-26105', // Farhan Saputra
    relation: 'AYAH',
    receiveWaNotif: true,
    isEmergencyContact: true,
  },
];
