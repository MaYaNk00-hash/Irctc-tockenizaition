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
        irctc: {
          navy: '#082B61',
          darknavy: '#05193B',
          orange: '#FB8C00',
          darkorange: '#E65100',
          blue: '#1A67D2',
          lightbg: '#F4F7FC',
          gold: '#FFC107'
        }
      }
    },
  },
  plugins: [],
}
