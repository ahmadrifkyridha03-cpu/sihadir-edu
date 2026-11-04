'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Check, User } from 'lucide-react';
import { setActiveStudentCookieAction } from '@/actions/parent-auth';
import { cn } from '@/lib/utils';

export interface LinkedStudentInfo {
  id: string;
  fullName: string;
  nis: string;
  photoUrl: string | null;
  class: {
    className: string;
  };
  relation: string;
}

interface ChildSwitcherProps {
  students: LinkedStudentInfo[];
  activeStudentId: string;
}

export function ChildSwitcher({ students, activeStudentId }: ChildSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const activeStudent =
    students.find((s) => s.id === activeStudentId) || students[0] || null;

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!activeStudent) return null;

  // Single Child Optimization: render clean static badge, zero unnecessary clicks
  if (students.length <= 1) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-100/90 rounded-full border border-slate-200">
        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
          {activeStudent.photoUrl ? (
            <img
              src={activeStudent.photoUrl}
              alt={activeStudent.fullName}
              className="w-full h-full object-cover"
            />
          ) : (
            activeStudent.fullName.charAt(0)
          )}
        </div>
        <div className="flex flex-col text-left">
          <span className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[140px] sm:max-w-[200px]">
            {activeStudent.fullName}
          </span>
          <span className="text-[10px] text-slate-500 font-medium">
            Kelas {activeStudent.class.className}
          </span>
        </div>
      </div>
    );
  }

  // Multi-Child Switcher Dropdown
  const handleSelectStudent = async (studentId: string) => {
    setIsOpen(false);
    if (studentId === activeStudent.id) return;

    // Update URL parameter with soft navigation
    const currentParams = new URLSearchParams(searchParams?.toString() || '');
    currentParams.set('studentId', studentId);

    // Save in cookie in background
    await setActiveStudentCookieAction(studentId);

    // Soft navigation without full page reload
    router.push(`?${currentParams.toString()}`, { scroll: false });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 active:scale-[0.98] transition-all rounded-full border border-slate-200 shadow-xs text-left"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Pilih ananda / siswa"
      >
        <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden ring-1 ring-blue-500/30">
          {activeStudent.photoUrl ? (
            <img
              src={activeStudent.photoUrl}
              alt={activeStudent.fullName}
              className="w-full h-full object-cover"
            />
          ) : (
            activeStudent.fullName.charAt(0)
          )}
        </div>
        <div className="flex flex-col text-left">
          <span className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px] sm:max-w-[180px]">
            {activeStudent.fullName}
          </span>
          <span className="text-[10px] text-slate-500 font-semibold">
            {activeStudent.class.className}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-slate-400 transition-transform duration-200',
            isOpen && 'rotate-180 text-blue-600'
          )}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-enter-snappy"
        >
          <div className="px-3.5 py-1.5 border-b border-slate-100 mb-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Pilih Data Ananda ({students.length} Siswa)
            </p>
          </div>

          <div className="max-h-60 overflow-y-auto px-1.5 space-y-1">
            {students.map((student) => {
              const isSelected = student.id === activeStudent.id;
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => handleSelectStudent(student.id)}
                  className={cn(
                    'w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors',
                    isSelected
                      ? 'bg-blue-50 text-blue-900 font-semibold'
                      : 'hover:bg-slate-50 text-slate-700'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden',
                        isSelected
                          ? 'bg-blue-600 text-white ring-2 ring-blue-500/40'
                          : 'bg-slate-200 text-slate-600'
                      )}
                    >
                      {student.photoUrl ? (
                        <img
                          src={student.photoUrl}
                          alt={student.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        student.fullName.charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">
                        {student.fullName}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Kelas {student.class.className} • NIS {student.nis}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
