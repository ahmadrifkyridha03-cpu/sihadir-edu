import React from 'react';
import { db } from '@/lib/db';
import { TeacherJournalForm } from '@/components/teacher/TeacherJournalForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Buat Jurnal Mengajar Baru | SiHadir-Edu',
};

export default async function NewJournalPage() {
  let classes: { id: string; className: string; gradeLevel: number }[] = [];
  let subjects: { id: string; subjectName: string; subjectCode: string; kkmScore: number }[] = [];
  let teachers: { id: string; fullName: string }[] = [];
  let students: { id: string; fullName: string; nis: string; classId: string }[] = [];

  try {
    if (process.env.DATABASE_URL) {
      const [rawClasses, rawSubjects, rawTeachers, rawStudents] = await Promise.all([
        db.class.findMany({
          orderBy: { className: 'asc' },
          select: { id: true, className: true, gradeLevel: true },
        }),
        db.subject.findMany({
          orderBy: { subjectName: 'asc' },
          select: { id: true, subjectName: true, subjectCode: true, kkmScore: true },
        }),
        db.teacher.findMany({
          orderBy: { fullName: 'asc' },
          select: { id: true, fullName: true },
        }),
        db.student.findMany({
          where: { status: 'ACTIVE' },
          orderBy: { fullName: 'asc' },
          select: { id: true, fullName: true, nis: true, classId: true },
        }),
      ]);

      classes = rawClasses;
      subjects = rawSubjects.map((s) => ({
        id: s.id,
        subjectName: s.subjectName,
        subjectCode: s.subjectCode,
        kkmScore: Number(s.kkmScore),
      }));
      teachers = rawTeachers;
      students = rawStudents;
    }
  } catch (err) {
    console.warn('[NewJournalPage] DB query failed during render:', err);
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8">
      <TeacherJournalForm
        mode="create"
        classes={classes}
        subjects={subjects}
        teachers={teachers}
        students={students}
      />
    </div>
  );
}
