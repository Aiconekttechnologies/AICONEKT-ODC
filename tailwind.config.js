/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#030712',
          navy: '#090d16',
          panel: '#0d1322',
          border: '#1e293b',
          'border-glow': 'rgba(0, 242, 254, 0.25)',
          cyan: '#00F2FE',
          cobalt: '#2563EB',
          indigo: '#4F46E5',
          violet: '#8B5CF6',
          silver: '#CBD5E1',
          titanium: '#64748B',
        }
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk"', '"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 25px -5px rgba(0, 242, 254, 0.4)',
        'glow-cobalt': '0 0 30px -5px rgba(37, 99, 235, 0.4)',
        'glow-violet': '0 0 25px -5px rgba(139, 92, 246, 0.35)',
        'inner-glow': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-gentle': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        }
      }
    },
  },
  plugins: [],
}
