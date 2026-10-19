const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./web/index.html', './web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: v('primary'), secondary: v('secondary'), accent: v('accent'), bg: v('background'), ink: v('text'),
        btn: v('button'), btnink: v('buttonText'), card: v('card'), line: v('border'),
      },
      fontFamily: {
        heading: ['var(--f-heading)', 'Mali', 'system-ui', 'sans-serif'],
        body: ['var(--f-body)', 'Itim', 'system-ui', 'sans-serif'],
        button: ['var(--f-button)', 'Mali', 'system-ui', 'sans-serif'],
        letter: ['var(--f-letter)', 'Itim', 'system-ui', 'sans-serif'],
        confession: ['var(--f-confession)', 'Mali', 'system-ui', 'sans-serif'],
        number: ['var(--f-number)', 'Fredoka', 'system-ui', 'sans-serif'],
        admin: ['"IBM Plex Sans Thai"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { gift: 'var(--radius)' },
      boxShadow: {
        soft: '0 10px 40px -12px rgb(var(--c-primary) / 0.35)',
        glow: '0 0 0 3px rgb(var(--c-primary) / 0.25), 0 0 30px rgb(var(--c-primary) / 0.35)',
      },
    },
  },
  plugins: [],
};
