import React from 'react';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { TeacherJournalForm } from '@/components/teacher/TeacherJournalForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Edit Jurnal Mengajar | SiHadir-Edu',
};

interface JournalPageProps {
  params: Promise<{ id: string }>;
}

export default async function JournalDetailsPage({ params }: JournalPageProps) {
  const { id } = await params;

  let journal: any = null;
  let classes: any[] = [];
  let subjects: any[] = [];
  let teachers: any[] = [];
  let students: any[] = [];

  try {
    if (process.env.DATABASE_URL) {
      [journal, classes, subjects, teachers, students] = await Promise.all([
        db.classJournal.findUnique({
          where: { id },
          include: {
            class: true,
            subject: true,
            teacher: true,
            subjectAttendances: true,
            documentations: true,
            assessments: {
              include: {
                grades: true,
              },
            },
          },
        }),
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
    }
  } catch (err) {
    console.warn('[JournalDetailsPage] DB query failed during render:', err);
  }

  if (!journal) {
    // If not found in DB
    return (
      <div className="min-h-screen bg-slate-50/50 p-6 flex flex-col items-center justify-center text-center">
        <h2 className="text-lg font-bold text-slate-800">Jurnal Mengajar Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500 mt-1">
          Jurnal dengan ID {id} tidak ada atau koneksi database sedang offline.
        </p>
      </div>
    );
  }

  const isLocked = Boolean(journal.teacherNotes?.includes('[LOCKED]'));

  const formattedSubjects = subjects.map((s) => ({
    id: s.id,
    subjectName: s.subjectName,
    subjectCode: s.subjectCode,
    kkmScore: Number(s.kkmScore),
  }));

  const initialHeader = {
    classId: journal.classId,
    subjectId: journal.subjectId,
    teacherId: journal.teacherId,
    journalDate: journal.journalDate.toISOString().split('T')[0],
    meetingNo: 1,
    periodStart: journal.periodStart,
    periodEnd: journal.periodEnd,
    topicMaterial: journal.topicMaterial,
    teacherNotes: journal.teacherNotes || '',
  };

  const initialAttendances = journal.subjectAttendances.map((a: any) => ({
    studentId: a.studentId,
    status: a.status,
    engagementBadge: a.engagementBadge,
    note: a.note,
  }));

  const initialPhotos = journal.documentations.map((d: any) => ({
    id: d.id,
    file: new File([], 'photo.webp'),
    base64: d.imageUrl,
    originalSizeKb: d.fileSizeKb,
    compressedSizeKb: d.fileSizeKb,
    savingsPercent: 0,
    caption: d.caption || '',
    visibility: d.visibility,
    taggedStudentIds: Array.isArray(d.taggedStudentIds)
      ? (d.taggedStudentIds as string[])
      : [],
  }));

  const linkedAssessment = journal.assessments[0];
  const initialAssessment = linkedAssessment
    ? {
        id: linkedAssessment.id,
        title: linkedAssessment.title,
        category: linkedAssessment.category,
        maxScore: Number(linkedAssessment.maxScore),
        grades: linkedAssessment.grades.map((g: any) => ({
          studentId: g.studentId,
          score: Number(g.score),
          teacherFeedback: g.teacherFeedback,
        })),
      }
    : null;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8">
      <TeacherJournalForm
        mode="edit"
        journalId={journal.id}
        isLocked={isLocked}
        classes={classes}
        subjects={formattedSubjects}
        teachers={teachers}
        students={students}
        initialHeader={initialHeader}
        initialAttendances={initialAttendances}
        initialPhotos={initialPhotos}
        initialAssessment={initialAssessment}
      />
    </div>
  );
}
