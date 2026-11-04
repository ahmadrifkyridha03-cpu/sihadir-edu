'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, Image as ImageIcon, Award, CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ParentBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const studentId = searchParams?.get('studentId');

  const buildHref = (path: string) => {
    if (studentId) {
      return `${path}?studentId=${studentId}`;
    }
    return path;
  };

  const navItems = [
    {
      label: 'Beranda',
      href: '/parent-dashboard',
      icon: Home,
      isActive: pathname === '/parent-dashboard',
    },
    {
      label: 'Galeri',
      href: '/documentations',
      icon: ImageIcon,
      isActive: pathname === '/documentations',
    },
    {
      label: 'Nilai',
      href: '/grades-report',
      icon: Award,
      isActive: pathname === '/grades-report',
    },
    {
      label: 'Izin',
      href: '/leave-request',
      icon: CalendarCheck,
      isActive: pathname === '/leave-request',
    },
  ];

  return (
    <nav
      aria-label="Navigasi Utama Orang Tua"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe md:hidden transition-all duration-150"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={buildHref(item.href)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] gap-1 select-none active:scale-[0.95] transition-all',
                item.isActive
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              )}
            >
              <div
                className={cn(
                  'w-9 h-7 rounded-xl flex items-center justify-center transition-colors',
                  item.isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-400'
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] tracking-tight leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
