'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('SiHadir PWA ServiceWorker registered:', reg.scope);
          })
          .catch((err) => {
            console.error('SiHadir PWA ServiceWorker registration failed:', err);
          });
      });
    }
  }, []);

  return null;
}
