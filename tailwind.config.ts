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
        navy: {
          900: '#1E3A8A', // Deep institutional authority
          800: '#1E40AF',
          700: '#1D4ED8',
          50: '#EFF6FF',
        },
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
            fg: '#065F46',     // emerald-800 (6.78:1 contrast - AAA)
            bg: '#D1FAE5',     // emerald-100
            border: '#A7F3D0',
          },
          terlambat: {
            fg: '#78350F',     // amber-900 (8.15:1 contrast - AAA)
            bg: '#FEF3C7',     // amber-100
            border: '#FDE68A',
          },
          izin: {
            fg: '#075985',     // sky-800 (7.10:1 contrast - AAA)
            bg: '#E0F2FE',     // sky-100
            border: '#BAE6FD',
          },
          sakit: {
            fg: '#5B21B6',     // violet-800 (8.24:1 contrast - AAA)
            bg: '#EDE9FE',     // violet-100
            border: '#DDD6FE',
          },
          alpa: {
            fg: '#9F1239',     // rose-800 (6.98:1 contrast - AAA)
            bg: '#FFE4E6',     // rose-100
            border: '#FECDD3',
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
        '120': '120ms',
        '160': '160ms',
        '220': '220ms',
        '250': '250ms',
      },
      scale: {
        '97': '0.97',
        '98': '0.98',
        '99': '0.99',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        enterSnappy: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s infinite linear',
        'slide-up': 'slideUp 220ms cubic-bezier(0.23, 1, 0.32, 1) forwards',
        'enter-snappy': 'enterSnappy 180ms cubic-bezier(0.23, 1, 0.32, 1) forwards',
      },
    },
  },
  plugins: [],
};

export default config;
