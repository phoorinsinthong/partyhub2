/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Force dark mode via class if needed, or we just rely on the CSS variables.
  theme: {
    extend: {
      colors: {
        slate: {
          850: '#141d2f',
          900: '#0f172a',
          950: '#020617',
        },
        neon: {
          purple: '#b829ea',
          pink: '#ff1493',
          blue: '#00f0ff',
          green: '#39ff14',
          yellow: '#ccff00',
          orange: '#ff5e00',
        },
        // Legacy aliases to keep the app compiling before we refactor all files
        olive: { 50: '#1e293b', 100: '#1e293b', 200: '#334155', 300: '#475569', 400: '#64748b', 500: '#b829ea', 600: '#b829ea', 700: '#b829ea', 800: '#e2e8f0', 900: '#f8fafc' },
        sage: { 50: '#1e293b', 100: '#1e293b', 200: '#334155', 300: '#475569', 400: '#00f0ff', 500: '#00f0ff', 600: '#00f0ff', 700: '#00f0ff', 800: '#e2e8f0', 900: '#f8fafc' },
        cream: { 50: '#1e293b', 100: '#1e293b', 200: '#1e293b', 300: '#1e293b', 400: '#1e293b', 500: '#1e293b' },
        warm: { 50: '#1e293b', 100: '#1e293b', 200: '#334155', 300: '#ff1493', 400: '#ff1493', 500: '#ff1493' },
        primary: '#b829ea',
        accent: '#00f0ff',
        secondary: '#94a3b8',
        success: '#39ff14',
        warning: '#ccff00',
        danger: '#ff1493',
        dark: '#f8fafc',
      },
      fontFamily: {
        sans: ['Prompt', 'Outfit', 'sans-serif'],
        display: ['Outfit', 'Prompt', 'sans-serif'],
        body: ['Prompt', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': '0 2px 10px rgba(0, 0, 0, 0.5)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
        'lifted': '0 8px 30px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
        'button': '0 0 15px rgba(184, 41, 234, 0.5)',
        'inner': 'inset 0 2px 4px rgba(0, 0, 0, 0.5)',
        'neon-purple': '0 0 10px rgba(184,41,234,0.5), 0 0 20px rgba(184,41,234,0.3)',
        'neon-blue': '0 0 10px rgba(0,240,255,0.5), 0 0 20px rgba(0,240,255,0.3)',
      },
    },
  },
  plugins: [],
}
