import * as React from 'react';
import { redirect } from 'next/navigation';
import db from '@/lib/db';
import { getParentSession, getActiveStudentIdFromCookie } from '@/lib/session';
import { getParentGalleryAction } from '@/actions/parent-gallery';
import { PhotoGalleryGrid } from '@/components/parent/PhotoGalleryGrid';
import { Image as ImageIcon } from 'lucide-react';

interface DocumentationsPageProps {
  searchParams: Promise<{
    studentId?: string;
  }>;
}

export default async function DocumentationsPage({
  searchParams,
}: DocumentationsPageProps) {
  const session = await getParentSession();
  if (!session) {
    redirect('/login');
  }

  const params = await searchParams;
  let targetStudentId = params.studentId;
  if (!targetStudentId) {
    targetStudentId = (await getActiveStudentIdFromCookie()) || undefined;
  }

  const parentLinks = await db.parentStudentLink.findMany({
    where: { parentId: session.parentId },
    include: {
      student: {
        include: { class: true },
      },
    },
  });

  if (parentLinks.length === 0) {
    redirect('/login');
  }

  const activeLink =
    parentLinks.find((l) => l.studentId === targetStudentId) || parentLinks[0];
  const activeStudent = activeLink.student;

  const galleryRes = await getParentGalleryAction(activeStudent.id);
  const items = galleryRes.success && galleryRes.data ? galleryRes.data : [];

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Dokumentasi Kegiatan Belajar
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Foto aktivitas kelas{' '}
              <strong className="text-slate-800">
                {activeStudent.fullName}
              </strong>{' '}
              (Kelas {activeStudent.class.className})
            </p>
          </div>
        </div>
      </div>

      <PhotoGalleryGrid items={items} studentName={activeStudent.fullName} />
    </div>
  );
}
