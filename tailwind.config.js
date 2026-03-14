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
        // Mission Control Dark Theme
        'mc-bg': '#0F0F23',
        'mc-card': '#1A1A2E',
        'mc-accent': '#16213E',
        'mc-highlight': '#0F3460',
        'mc-text': '#E8E8E8',
        'mc-success': '#4ADE80',
        'mc-warning': '#FBBF24',
        'mc-error': '#F87171',
      },
    },
  },
  plugins: [],
}
