import * as React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import db from '@/lib/db';
import { getParentSession, getActiveStudentIdFromCookie } from '@/lib/session';
import { ChildSwitcher, LinkedStudentInfo } from '@/components/parent/ChildSwitcher';
import { ParentBottomNav } from '@/components/parent/ParentBottomNav';
import { ShieldCheck, LogOut } from 'lucide-react';
import { parentLogoutAction } from '@/actions/parent-auth';

export const dynamic = 'force-dynamic';

export default async function ParentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getParentSession();
  if (!session) {
    redirect('/login');
  }

  // Fetch linked students for this parent
  const parentRecord = await db.parent.findUnique({
    where: { id: session.parentId },
    include: {
      studentLinks: {
        include: {
          student: {
            include: {
              class: true,
            },
          },
        },
      },
    },
  });

  if (!parentRecord || parentRecord.studentLinks.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center max-w-md">
          <p className="text-sm font-bold text-slate-900">
            Tidak ada siswa terhubung dengan akun ini.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Hubungi pihak sekolah untuk menghubungkan data siswa ke nomor WhatsApp Anda.
          </p>
        </div>
      </div>
    );
  }

  const linkedStudents: LinkedStudentInfo[] = parentRecord.studentLinks
    .filter((link) => link.student.status === 'ACTIVE')
    .map((link) => ({
      id: link.student.id,
      fullName: link.student.fullName,
      nis: link.student.nis,
      photoUrl: link.student.photoUrl,
      class: {
        className: link.student.class.className,
      },
      relation: link.relation,
    }));

  const activeStudentCookie = await getActiveStudentIdFromCookie();
  const activeStudentId =
    activeStudentCookie &&
    linkedStudents.some((s) => s.id === activeStudentCookie)
      ? activeStudentCookie
      : linkedStudents[0]?.id || '';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Sticky Top Institutional Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          {/* Brand Logo & Name */}
          <Link
            href="/parent-dashboard"
            className="flex items-center gap-2 text-slate-900 select-none group"
          >
            <div className="w-8 h-8 rounded-xl bg-navy-900 text-white flex items-center justify-center shadow-xs group-hover:bg-blue-600 transition-colors">
              <ShieldCheck className="w-5 h-5 text-blue-400 group-hover:text-white" />
            </div>
            <div className="hidden xs:block">
              <span className="text-sm font-bold tracking-tight text-slate-900 leading-none">
                SiHadir
              </span>
              <span className="text-[10px] block text-slate-500 font-medium">
                Portal Orang Tua
              </span>
            </div>
          </Link>

          {/* Sibling Switcher & Logout */}
          <div className="flex items-center gap-2">
            <React.Suspense fallback={<div className="w-24 h-8 bg-slate-100 rounded-full animate-pulse" />}>
              <ChildSwitcher
                students={linkedStudents}
                activeStudentId={activeStudentId}
              />
            </React.Suspense>

            {/* Logout Trigger */}
            <form
              action={async () => {
                'use server';
                await parentLogoutAction();
                redirect('/login');
              }}
            >
              <button
                type="submit"
                aria-label="Keluar akun"
                title="Keluar akun"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6 pb-28 md:pb-12">
        {children}
      </main>

      {/* Mobile Sticky Bottom Navigation */}
      <React.Suspense fallback={null}>
        <ParentBottomNav />
      </React.Suspense>
    </div>
  );
}
