/**
 * In-Memory Database Repository matching Prisma 13+ core models
 * Provides deterministic offline execution for E2E tests and scenarios.
 * SiHadir-Edu (Milestone 7)
 */

import {
  SEED_ACADEMIC_YEARS,
  SEED_CLASSES,
  SEED_TEACHERS,
  SEED_SUBJECTS,
  SEED_STUDENTS,
  SEED_PARENTS,
  SEED_PARENT_STUDENT_LINKS,
  MockStudent,
  MockClass,
  MockTeacher,
  MockSubject,
  MockParent,
} from './mock-data';
import { hashPin } from '../../../src/lib/auth-crypto';

export class InMemoryDb {
  public academicYears: any[] = [];
  public classes: any[] = [];
  public teachers: any[] = [];
  public subjects: any[] = [];
  public students: any[] = [];
  public users: any[] = [];
  public parents: any[] = [];
  public parentStudentLinks: any[] = [];
  public schedules: any[] = [];
  public gateAttendances: any[] = [];
  public classJournals: any[] = [];
  public subjectAttendances: any[] = [];
  public documentations: any[] = [];
  public assessments: any[] = [];
  public studentGrades: any[] = [];
  public leaveRequests: any[] = [];
  public waNotificationLogs: any[] = [];

  constructor() {
    this.seed();
  }

  public reset(): void {
    this.academicYears = [];
    this.classes = [];
    this.teachers = [];
    this.subjects = [];
    this.students = [];
    this.users = [];
    this.parents = [];
    this.parentStudentLinks = [];
    this.schedules = [];
    this.gateAttendances = [];
    this.classJournals = [];
    this.subjectAttendances = [];
    this.documentations = [];
    this.assessments = [];
    this.studentGrades = [];
    this.leaveRequests = [];
    this.waNotificationLogs = [];
    this.seed();
  }

  public seed(): void {
    this.academicYears = JSON.parse(JSON.stringify(SEED_ACADEMIC_YEARS));
    this.classes = JSON.parse(JSON.stringify(SEED_CLASSES));
    this.teachers = JSON.parse(JSON.stringify(SEED_TEACHERS));
    this.subjects = JSON.parse(JSON.stringify(SEED_SUBJECTS));
    this.students = JSON.parse(JSON.stringify(SEED_STUDENTS));
    this.parents = JSON.parse(JSON.stringify(SEED_PARENTS));
    this.parentStudentLinks = JSON.parse(JSON.stringify(SEED_PARENT_STUDENT_LINKS));

    // Seed default Users for teachers and parents
    const defaultPinHash = hashPin('123456');
    this.users = [
      {
        id: 'user-admin',
        name: 'Pak Hendra Admin',
        phoneWa: '081200000001',
        email: 'admin@sihadir.edu',
        passwordHash: defaultPinHash,
        role: 'ADMIN',
        isActive: true,
      },
      ...this.teachers.map((t) => ({
        id: t.userId,
        name: t.fullName,
        phoneWa: t.phoneWa,
        email: `${t.id}@sihadir.edu`,
        passwordHash: defaultPinHash,
        role: 'TEACHER',
        isActive: true,
      })),
      ...this.parents.map((p) => ({
        id: p.userId,
        name: p.fullName,
        phoneWa: p.phoneWa,
        email: `${p.id}@sihadir.edu`,
        passwordHash: defaultPinHash,
        role: 'PARENT',
        isActive: true,
      })),
    ];

    // Seed default teaching schedule
    this.schedules = [
      {
        id: 'sched-1',
        classId: 'class-x-ipa-1',
        teacherId: 'teacher-siti',
        subjectId: 'subj-mtk',
        dayOfWeek: 1, // Monday
        periodStart: 1,
        periodEnd: 2,
        academicYearId: 'ay-2025-ganjil',
      },
      {
        id: 'sched-2',
        classId: 'class-x-ipa-1',
        teacherId: 'teacher-bambang',
        subjectId: 'subj-bin',
        dayOfWeek: 1,
        periodStart: 3,
        periodEnd: 4,
        academicYearId: 'ay-2025-ganjil',
      },
      {
        id: 'sched-3',
        classId: 'class-x-ipa-1',
        teacherId: 'teacher-sri',
        subjectId: 'subj-fis',
        dayOfWeek: 2, // Tuesday
        periodStart: 1,
        periodEnd: 2,
        academicYearId: 'ay-2025-ganjil',
      },
    ];
  }

  private matchesWhere(item: any, where?: any): boolean {
    if (!where) return true;
    for (const key of Object.keys(where)) {
      const condition = where[key];
      if (condition === undefined) continue;

      if (key === 'OR' && Array.isArray(condition)) {
        const anyMatch = condition.some((cond) => this.matchesWhere(item, cond));
        if (!anyMatch) return false;
        continue;
      }

      if (key === 'AND' && Array.isArray(condition)) {
        const allMatch = condition.every((cond) => this.matchesWhere(item, cond));
        if (!allMatch) return false;
        continue;
      }

      const val = item[key];

      if (condition !== null && typeof condition === 'object' && !(condition instanceof Date)) {
        if (!(key in item)) {
          if (key === 'journal' && item.journalId) {
            const j = this.classJournals.find((cj) => cj.id === item.journalId);
            if (!j || !this.matchesWhere(j, condition)) return false;
            continue;
          }
          if (key === 'student' && item.studentId) {
            const s = this.students.find((std) => std.id === item.studentId);
            if (!s || !this.matchesWhere(s, condition)) return false;
            continue;
          }
          if (key === 'class' && item.classId) {
            const c = this.classes.find((cls) => cls.id === item.classId);
            if (!c || !this.matchesWhere(c, condition)) return false;
            continue;
          }
          if (!this.matchesWhere(item, condition)) return false;
          continue;
        }
        if ('equals' in condition && condition.equals !== val) return false;
        if ('in' in condition && Array.isArray(condition.in) && !condition.in.includes(val)) return false;
        if ('not' in condition) {
          if (condition.not === null) {
            if (val === null || val === undefined) return false;
          } else if (condition.not === val) {
            return false;
          }
        }
        if ('contains' in condition && typeof val === 'string' && !val.toLowerCase().includes(String(condition.contains).toLowerCase())) return false;
        if ('startsWith' in condition && typeof val === 'string' && !val.startsWith(condition.startsWith)) return false;
        if ('gte' in condition && val < condition.gte) return false;
        if ('lte' in condition && val > condition.lte) return false;
        if ('gt' in condition && val <= condition.gt) return false;
        if ('lt' in condition && val >= condition.lt) return false;
      } else if (condition instanceof Date) {
        if (new Date(val).getTime() !== condition.getTime()) return false;
      } else if (val !== condition) {
        return false;
      }
    }
    return true;
  }

  private createRepository<T extends { id?: string }>(getCollection: () => T[]) {
    return {
      findUnique: async (args: { where: any; include?: any }): Promise<any> => {
        const collection = getCollection();
        const found = collection.find((item) => this.matchesWhere(item, args.where));
        if (!found) return null;
        return this.enrichIncludes(found, args.include);
      },
      findFirst: async (args: { where?: any; include?: any; orderBy?: any }): Promise<any> => {
        const collection = getCollection();
        let list = collection.filter((item) => this.matchesWhere(item, args.where));
        if (args.orderBy) {
          list = this.sortList(list, args.orderBy);
        }
        const found = list[0] || null;
        if (!found) return null;
        return this.enrichIncludes(found, args.include);
      },
      findMany: async (args: { where?: any; include?: any; orderBy?: any; take?: number; skip?: number } = {}): Promise<any[]> => {
        const collection = getCollection();
        let list = collection.filter((item) => this.matchesWhere(item, args.where));
        if (args.orderBy) {
          list = this.sortList(list, args.orderBy);
        }
        if (args.skip) {
          list = list.slice(args.skip);
        }
        if (args.take) {
          list = list.slice(0, args.take);
        }
        return list.map((item) => this.enrichIncludes(item, args.include));
      },
      create: async (args: { data: any; include?: any }): Promise<any> => {
        const collection = getCollection();
        const id = args.data.id || `mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newItem = {
          ...args.data,
          id,
          createdAt: args.data.createdAt || new Date(),
          updatedAt: args.data.updatedAt || new Date(),
        };
        collection.push(newItem);
        return this.enrichIncludes(newItem, args.include);
      },
      update: async (args: { where: any; data: any; include?: any }): Promise<any> => {
        const collection = getCollection();
        const index = collection.findIndex((item) => this.matchesWhere(item, args.where));
        if (index === -1) throw new Error('Record to update not found');
        const updated = {
          ...collection[index],
          ...args.data,
          updatedAt: new Date(),
        };
        collection[index] = updated;
        return this.enrichIncludes(updated, args.include);
      },
      updateMany: async (args: { where?: any; data: any }): Promise<{ count: number }> => {
        const collection = getCollection();
        let count = 0;
        for (let i = 0; i < collection.length; i++) {
          if (this.matchesWhere(collection[i], args.where)) {
            collection[i] = {
              ...collection[i],
              ...args.data,
              updatedAt: new Date(),
            };
            count++;
          }
        }
        return { count };
      },
      upsert: async (args: { where: any; create: any; update: any; include?: any }): Promise<any> => {
        const collection = getCollection();
        const index = collection.findIndex((item) => this.matchesWhere(item, args.where));
        if (index !== -1) {
          const updated = {
            ...collection[index],
            ...args.update,
            updatedAt: new Date(),
          };
          collection[index] = updated;
          return this.enrichIncludes(updated, args.include);
        } else {
          const id = args.create.id || `mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const newItem = {
            ...args.create,
            id,
            createdAt: args.create.createdAt || new Date(),
            updatedAt: args.create.updatedAt || new Date(),
          };
          collection.push(newItem);
          return this.enrichIncludes(newItem, args.include);
        }
      },
      delete: async (args: { where: any }): Promise<any> => {
        const collection = getCollection();
        const index = collection.findIndex((item) => this.matchesWhere(item, args.where));
        if (index === -1) throw new Error('Record to delete not found');
        const [deleted] = collection.splice(index, 1);
        return deleted;
      },
      deleteMany: async (args: { where?: any }): Promise<{ count: number }> => {
        const collection = getCollection();
        const initialCount = collection.length;
        const remaining = collection.filter((item) => !this.matchesWhere(item, args.where));
        const deletedCount = initialCount - remaining.length;
        collection.length = 0;
        collection.push(...remaining);
        return { count: deletedCount };
      },
      count: async (args: { where?: any } = {}): Promise<number> => {
        const collection = getCollection();
        return collection.filter((item) => this.matchesWhere(item, args.where)).length;
      },
    };
  }

  private sortList(list: any[], orderBy: any): any[] {
    const copy = [...list];
    const key = Object.keys(orderBy)[0];
    const direction = orderBy[key];
    copy.sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }

  private enrichIncludes(item: any, include?: any): any {
    if (!include || !item) return item;
    const cloned = { ...item };

    // Relations resolution
    if (include.class && cloned.classId) {
      const c = this.classes.find((cls) => cls.id === cloned.classId) || null;
      cloned.class = c ? this.enrichIncludes(c, include.class.include) : null;
    }
    if (include.homeroomTeacher && cloned.homeroomTeacherId) {
      cloned.homeroomTeacher = this.teachers.find((t) => t.id === cloned.homeroomTeacherId) || null;
    }
    if (include.student && cloned.studentId) {
      const s = this.students.find((std) => std.id === cloned.studentId) || null;
      cloned.student = s ? this.enrichIncludes(s, include.student.include) : null;
    }
    if (include.teacher) {
      if (cloned.teacherId) {
        cloned.teacher = this.teachers.find((t) => t.id === cloned.teacherId) || null;
      } else {
        cloned.teacher = this.teachers.find((t) => t.userId === cloned.id) || null;
      }
    }
    if (include.subject && cloned.subjectId) {
      cloned.subject = this.subjects.find((s) => s.id === cloned.subjectId) || null;
    }
    if (include.studentLinks && cloned.id) {
      cloned.studentLinks = this.parentStudentLinks
        .filter((l) => l.parentId === cloned.id)
        .map((link) => {
          if (include.studentLinks.include?.student) {
            const student = this.students.find((s) => s.id === link.studentId);
            return {
              ...link,
              student: include.studentLinks.include.student.include?.class && student
                ? { ...student, class: this.classes.find((c) => c.id === student.classId) }
                : student,
            };
          }
          return link;
        });
    }
    if (include.parentLinks && cloned.id) {
      cloned.parentLinks = this.parentStudentLinks
        .filter((l) => l.studentId === cloned.id)
        .map((link) => {
          const parent = this.parents.find((p) => p.id === link.parentId) || null;
          return {
            ...link,
            parent: include.parentLinks.include?.parent ? parent : undefined,
          };
        });
    }
    if (include.parent) {
      if (cloned.parentId) {
        cloned.parent = this.parents.find((p) => p.id === cloned.parentId) || null;
      } else {
        cloned.parent = this.parents.find((p) => p.userId === cloned.id) || null;
      }
    }
    if (include.academicYear && cloned.academicYearId) {
      cloned.academicYear = this.academicYears.find((ay) => ay.id === cloned.academicYearId) || null;
    }
    if (include.schedules) {
      cloned.schedules = this.schedules.filter((s) => s.classId === cloned.id);
    }
    if (include.students) {
      cloned.students = this.students.filter((s) => s.classId === cloned.id);
    }
    if (include.gateAttendances) {
      cloned.gateAttendances = this.gateAttendances.filter((g) => g.studentId === cloned.id);
    }
    if (include.leaveRequests) {
      cloned.leaveRequests = this.leaveRequests.filter((l) => l.studentId === cloned.id);
    }
    if (include.subjectAttendances) {
      cloned.subjectAttendances = this.subjectAttendances.filter(
        (sa) => sa.studentId === cloned.id || sa.journalId === cloned.id
      );
    }
    if (include.assessment && cloned.assessmentId) {
      const ass = this.assessments.find((a) => a.id === cloned.assessmentId) || {
        id: cloned.assessmentId,
        subjectId: 'subj-mtk',
        title: 'Penilaian Formatif',
        category: 'TUGAS',
        maxScore: 100,
      };
      const subj = this.subjects.find((s) => s.id === ass.subjectId) || this.subjects[0];
      cloned.assessment = {
        ...ass,
        subject: subj,
      };
    }
    if (include.grades) {
      cloned.grades = this.studentGrades.filter((g) => g.studentId === cloned.id);
    }
    if (include.journal && cloned.journalId) {
      const j = this.classJournals.find((cj) => cj.id === cloned.journalId) || null;
      cloned.journal = j ? this.enrichIncludes(j, include.journal.include) : null;
    }

    return cloned;
  }

  public get academicYear() {
    return this.createRepository(() => this.academicYears);
  }
  public get class() {
    return this.createRepository(() => this.classes);
  }
  public get teacher() {
    return this.createRepository(() => this.teachers);
  }
  public get subject() {
    return this.createRepository(() => this.subjects);
  }
  public get student() {
    return this.createRepository(() => this.students);
  }
  public get user() {
    return this.createRepository(() => this.users);
  }
  public get parent() {
    return this.createRepository(() => this.parents);
  }
  public get parentStudentLink() {
    return this.createRepository(() => this.parentStudentLinks);
  }
  public get schedule() {
    return this.createRepository(() => this.schedules);
  }
  public get gateAttendance() {
    return this.createRepository(() => this.gateAttendances);
  }
  public get classJournal() {
    return this.createRepository(() => this.classJournals);
  }
  public get subjectAttendance() {
    return this.createRepository(() => this.subjectAttendances);
  }
  public get documentation() {
    return this.createRepository(() => this.documentations);
  }
  public get assessment() {
    return this.createRepository(() => this.assessments);
  }
  public get studentGrade() {
    return this.createRepository(() => this.studentGrades);
  }
  public get leaveRequest() {
    return this.createRepository(() => this.leaveRequests);
  }
  public get waNotificationLog() {
    return this.createRepository(() => this.waNotificationLogs);
  }

  public async $transaction(arg: any): Promise<any> {
    if (Array.isArray(arg)) {
      const results = [];
      for (const op of arg) {
        results.push(await op);
      }
      return results;
    } else if (typeof arg === 'function') {
      return await arg(this);
    }
    throw new Error('Unsupported $transaction argument');
  }
}

export const inMemoryDb = new InMemoryDb();
export default inMemoryDb;
