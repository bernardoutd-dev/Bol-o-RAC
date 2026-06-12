import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        card: '#0C2A1E',
        line: '#1E4A36',
        gold: '#FFCF3F',
        chalk: '#EAF3EC',
        muted: '#8BAA98',
        bg: '#081711',
        pitch: '#0F3D2B',
        pitch2: '#12442F',
        hot: '#FF6A3D',
        ok: '#39D98A',
      },
      borderRadius: {
        '3xl': '14px',
      },
      boxShadow: {
        glow: '0 0 60px rgba(0, 0, 0, 0.18)',
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
