/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'mc-bg': 'hsl(240, 10%, 3.9%)',
        'mc-surface': 'hsl(240, 10%, 5.5%)',
        'mc-card': 'hsl(240, 10%, 8%)',
        'mc-accent': 'hsl(240, 10%, 14%)',
        'mc-highlight': 'hsl(217, 91%, 60%)',
        'mc-border': 'hsl(240, 10%, 10%)',
        'mc-text': 'hsl(0, 0%, 90%)',
        'mc-error': 'hsl(0, 70%, 50%)',
      },
    },
  },
  plugins: [],
}
