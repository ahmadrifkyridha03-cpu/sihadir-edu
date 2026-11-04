import type {
  User,
  Teacher,
  Parent,
  Student,
  ParentStudentLink,
  AcademicYear,
  Class,
  Subject,
  Schedule,
  GateAttendance,
  ClassJournal,
  SubjectAttendance,
  Documentation,
  Assessment,
  StudentGrade,
  LeaveRequest,
  WaNotificationLog,
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
  Prisma,
} from '@prisma/client'

// ==============================================================================
// 1. Re-export All Prisma Base Entity Types
// ==============================================================================
export type {
  User,
  Teacher,
  Parent,
  Student,
  ParentStudentLink,
  AcademicYear,
  Class,
  Subject,
  Schedule,
  GateAttendance,
  ClassJournal,
  SubjectAttendance,
  Documentation,
  Assessment,
  StudentGrade,
  LeaveRequest,
  WaNotificationLog,
}

// ==============================================================================
// 2. Re-export All 13 Domain Enums
// ==============================================================================
export {
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
}

// ==============================================================================
// 3. Composite / Relational Models (Common Query Payloads)
// ==============================================================================

/** Student with class details and linked parent contacts */
export type StudentWithClassAndParents = Student & {
  class: Class
  parentLinks: (ParentStudentLink & {
    parent: Parent
  })[]
}

/** Class with homeroom teacher profile and enrolled student count */
export type ClassWithHomeroomAndCount = Class & {
  homeroomTeacher: Teacher | null
  _count: {
    students: number
  }
}

/** Complete Class Journal session payload */
export type ClassJournalWithDetails = ClassJournal & {
  subject: Subject
  teacher: Teacher
  class: Class
  documentations: Documentation[]
  subjectAttendances: SubjectAttendance[]
  assessments: Assessment[]
}

/** Gate attendance record with student profile and enrolled class */
export type GateAttendanceWithStudent = GateAttendance & {
  student: Student & {
    class: Class
  }
}

/** Assessment with all recorded student grades and subject reference */
export type AssessmentWithGrades = Assessment & {
  subject: Subject
  grades: (StudentGrade & {
    student: Pick<Student, 'id' | 'nis' | 'fullName'>
  })[]
}

/** Leave request with student, parent, and reviewing teacher */
export type LeaveRequestWithDetails = LeaveRequest & {
  student: Student & {
    class: Class
  }
  parent: Parent
  approvedBy: Teacher | null
}

/** Parent Portal authenticated session context */
export interface ParentSessionContext {
  userId: string
  parentId: string
  fullName: string
  phoneWa: string
  linkedStudents: (Student & {
    class: Class
  })[]
  activeStudentId: string
}

// ==============================================================================
// 4. Server Action Standard Result & Mutation Contracts
// ==============================================================================

export type ServerActionResult<T = void> =
  | {
      success: true
      data: T
      message?: string
    }
  | {
      success: false
      error: string
      fieldErrors?: Record<string, string[]>
    }

/** Payload for gate QR scan processing */
export interface GateScanInput {
  qrToken: string
  scannedBy?: string
  scanType?: 'GATE_IN' | 'GATE_OUT'
  manualStudentId?: string
}

/** Payload for creating a classroom teaching journal */
export interface CreateClassJournalInput {
  scheduleId?: string
  classId: string
  subjectId: string
  teacherId: string
  journalDate: Date | string
  periodStart: number
  periodEnd: number
  topicMaterial: string
  teacherNotes?: string
  attendances: {
    studentId: string
    status: SubjectStatus
    engagementBadge?: EngagementBadge
    note?: string
  }[]
  documentation?: {
    imageUrl: string
    caption?: string
    visibility?: DocVisibility
    taggedStudentIds?: string[]
    fileSizeKb: number
  }
}

/** Payload for batch grade entry */
export interface BatchGradeEntryInput {
  assessmentId: string
  grades: {
    studentId: string
    score: number
    teacherFeedback?: string
  }[]
}

/** Payload for submitting a student leave request */
export interface SubmitLeaveRequestInput {
  studentId: string
  parentId: string
  startDate: Date | string
  endDate: Date | string
  leaveType: LeaveType
  reason: string
  attachmentUrl?: string
}
