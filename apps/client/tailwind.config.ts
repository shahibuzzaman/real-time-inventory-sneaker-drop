import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        accent: '#0ea5e9',
        surface: '#f8fafc'
      }
    }
  },
  plugins: []
} satisfies Config;
