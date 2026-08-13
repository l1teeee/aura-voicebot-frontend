export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FFFFFF',
        surface: '#C8EFC1',
        edge: '#BDF0EC',
        ink: '#053438',
        muted: '#044B39',
        accent: '#1EA97B',
        'accent-active': '#044B39',
        'alert-surface': '#CBF39D',
        'alert-edge': '#72C613',
        pin: '#EC4899',
        'pin-active': '#DB2777',
      },
      fontFamily: {
        serif: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        control: '14px',
        chip: '12px',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      boxShadow: {
        subtle: '0 7px 20px rgb(5 52 56 / 0.09)',
      },
    },
  },
  plugins: [],
}
