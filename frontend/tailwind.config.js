/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#ad0025',
        'primary-bright': '#DB0031',
        'primary-deep': '#92001D',
        'primary-fixed': '#ffdad8',
        surface: '#f8f9ff',
        'surface-container': '#e5eeff',
        'surface-container-low': '#eef4ff',
        'surface-container-high': '#dfe9fa',
        'surface-variant': '#d9e3f4',
        'on-surface': '#121c28',
        'on-surface-variant': '#5d3f3e',
        tertiary: '#525556',
      },
      borderRadius: {
        '2lg': '2rem',
        '2xl2': '3rem',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['Lexend', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
