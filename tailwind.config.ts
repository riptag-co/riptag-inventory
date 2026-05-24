import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#08080A',
          surface: '#0F0F11',
          raised: '#15151A',
          hover: '#1C1C22',
        },
        line: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          strong: 'rgba(255,255,255,0.12)',
          stronger: 'rgba(255,255,255,0.20)',
        },
        text: {
          primary: '#FAFAF9',
          secondary: '#A3A3A8',
          tertiary: '#62626A',
          dim: '#3D3D45',
        },
        accent: {
          DEFAULT: '#FF2300',
          hover: '#FF4220',
          dim: 'rgba(255,35,0,0.12)',
        },
        ok: { DEFAULT: '#34D399', dim: 'rgba(52,211,153,0.10)' },
        warn: { DEFAULT: '#F59E0B', dim: 'rgba(245,158,11,0.10)' },
        bad: { DEFAULT: '#F87171', dim: 'rgba(248,113,113,0.10)' },
        info: { DEFAULT: '#60A5FA', dim: 'rgba(96,165,250,0.10)' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['Syne', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      backdropBlur: {
        glass: '20px',
      },
      borderRadius: {
        glass: '14px',
      },
    },
  },
  plugins: [],
};

export default config;
