import React from 'react';
import { db } from '@/lib/db';
import { TeacherJournalForm } from '@/components/teacher/TeacherJournalForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Buat Jurnal Mengajar Baru | SiHadir-Edu',
};

interface NewJournalPageProps {
  searchParams?: Promise<{
    scheduleId?: string;
    classId?: string;
    subjectId?: string;
    teacherId?: string;
    periodStart?: string;
    periodEnd?: string;
    date?: string;
  }>;
}

export default async function NewJournalPage({ searchParams }: NewJournalPageProps) {
  const params = searchParams ? await searchParams : {};

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

  // Pre-fill initialHeader if query parameters exist
  const initialHeader = params.classId
    ? {
        classId: params.classId,
        subjectId: params.subjectId || (subjects[0]?.id ?? ''),
        teacherId: params.teacherId || (teachers[0]?.id ?? ''),
        journalDate: params.date || new Date().toISOString().split('T')[0],
        meetingNo: 1,
        periodStart: Number(params.periodStart) || 1,
        periodEnd: Number(params.periodEnd) || 2,
        topicMaterial: '',
        teacherNotes: '',
      }
    : undefined;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8">
      <TeacherJournalForm
        mode="create"
        classes={classes}
        subjects={subjects}
        teachers={teachers}
        students={students}
        initialHeader={initialHeader}
      />
    </div>
  );
}
