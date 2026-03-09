/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        irc: {
          yellow: '#FFC72C',
          'yellow-light': '#FFD44B',
          'yellow-lightest': '#FFD960',
          'crisis-red': '#E52911',
          black: '#000000',
          white: '#FFFFFF',
          gray: {
            50: '#F6F6F6',
            100: '#E9E9E9',
            200: '#D1D1D1',
            300: '#D1D1D1',
            400: '#999999',
            500: '#666666',
            600: '#666666',
            700: '#383838',
            800: '#000000',
          },
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'Arial', 'Helvetica', 'sans-serif'],
      },
      letterSpacing: {
        'irc-tight': '-0.02em',
      },
    },
  },
  plugins: [],
}
