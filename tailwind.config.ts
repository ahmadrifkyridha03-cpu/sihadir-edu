import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB', // Tailwind blue-600: Educational authority
          hover: '#1D4ED8',   // Tailwind blue-700
          light: '#DBEAFE',   // Tailwind blue-100
        },
        background: '#F8FAFC', // Tailwind slate-50: Crisp, glare-free background
        surface: '#FFFFFF',    // Pure white card containers
        foreground: '#0F172A', // Tailwind slate-900: High-contrast typography
        muted: {
          DEFAULT: '#475569',  // Tailwind slate-600: Supporting metadata
          light: '#94A3B8',    // Tailwind slate-400
        },
        border: '#E2E8F0',     // Tailwind slate-200: Subtle separation lines
        status: {
          hadir: {
            fg: '#059669',     // emerald-600
            bg: '#D1FAE5',     // emerald-100
          },
          terlambat: {
            fg: '#D97706',     // amber-600
            bg: '#FEF3C7',     // amber-100
          },
          izin: {
            fg: '#0284C7',     // sky-600
            bg: '#E0F2FE',     // sky-100
          },
          sakit: {
            fg: '#7C3AED',     // violet-600
            bg: '#EDE9FE',     // violet-100
          },
          alpa: {
            fg: '#E11D48',     // rose-600
            bg: '#FFE4E6',     // rose-100
          },
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Plus Jakarta Sans', 'Inter', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      transitionTimingFunction: {
        'snappy-out': 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
      transitionDuration: {
        '160': '160ms',
        '250': '250ms',
      },
      scale: {
        '97': '0.97',
      },
    },
  },
  plugins: [],
};

export default config;
