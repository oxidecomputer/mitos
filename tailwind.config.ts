/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

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
  theme: {
    fontFamily: {
      sans: [
        'SuisseIntl',
        '-apple-system',
        'BlinkMacSystemFont',
        'Helvetica',
        'Arial',
        'sans-serif',
      ],
      mono: ['GT America Mono', 'monospace'],
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities(colorUtilities)
      addUtilities(elevationUtilities)
    }),
  ],
}

export default config
