import React from 'react';

export const metadata = {
  title: 'Gate Scanner Kiosk — SiHadir-Edu',
  description: 'Terminal Presensi Gerbang & Anti-Fraud SiHadir-Edu',
};

export default function GateScannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      {children}
    </div>
  );
}
