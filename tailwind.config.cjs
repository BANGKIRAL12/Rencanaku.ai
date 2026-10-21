/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/views/**/*.{ejs,html}',
    './src/public/**/*.{js,css}',
  ],
  theme: {
    extend: {
      colors: {
        'surface-base': '#0F0F11',
        'surface-sidebar': '#1C1C1F',
        'surface-card': '#26262A',
        'surface-raised': '#323237',
        'frame': '#4A4A54',
        'primary-400': '#C084FC',
        'primary-500': '#A855F7',
        'primary-600': '#7E3FD1',
        'primary-900': '#3B2060',
        'accent-pink': '#E879F9',
        'accent-yellow': '#FDE68A',
      },
      borderRadius: {
        '2xl': '16px',
        'xl': '12px',
        'full': '9999px',
      },
      spacing: {
        '4': '16px',
        '6': '24px',
        '8': '32px',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};