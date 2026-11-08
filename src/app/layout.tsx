import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import './globals.css';

export const metadata: Metadata = {
  title: 'SiHadir-Edu | Sistem Informasi Absensi & Penilaian Terpadu',
  description:
    'Sistem Informasi Absensi, Nilai, & Dokumentasi Pembelajaran Siswa Terintegrasi Orang Tua',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SiHadir-Edu',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#2563EB',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20">
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          duration={3500}
        />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
