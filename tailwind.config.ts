import {
  colorUtilities,
  elevationUtilities,
} from '@oxide/design-system/styles/tailwind-tokens.ts'
import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '*.{js,ts,jsx,tsx,mdx}',
  ],
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities(colorUtilities)
      addUtilities(elevationUtilities)
    }),
  ],
}

export default config
