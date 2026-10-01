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
        'mc-bg': 'hsl(var(--mc-bg, 240 10% 3.9%) / <alpha-value>)',
        'mc-surface': 'hsl(var(--mc-surface, 240 10% 5.5%) / <alpha-value>)',
        'mc-card': 'hsl(var(--mc-card, 240 10% 8%) / <alpha-value>)',
        'mc-accent': 'hsl(var(--mc-accent, 240 10% 14%) / <alpha-value>)',
        'mc-highlight': 'hsl(217, 91%, 60%)',
        'mc-border': 'hsl(240, 10%, 10%)',
        'mc-text': 'hsl(var(--mc-text, 0 0% 90%) / <alpha-value>)',
        'mc-error': 'hsl(0, 70%, 50%)',
      },
    },
  },
  plugins: [],
}
