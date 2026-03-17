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
        'mc-border': 'hsl(240, 10%, 10%)',
        'mc-text': 'hsl(0, 0%, 90%)',
      },
    },
  },
  plugins: [],
}
