export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FAF7F2',
        surface: '#F3EDE4',
        edge: '#E4DACC',
        ink: '#2E2B29',
        muted: '#7A716A',
        accent: '#C4714E',
        'accent-active': '#A85B3C',
        'alert-surface': '#FDF3EC',
        'alert-edge': '#E8C4AC',
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
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
        subtle: '0 1px 2px rgb(46 43 41 / 0.06)',
      },
    },
  },
  plugins: [],
}
