/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

// Serve the /sandbox page (no trailing slash) in dev. Vite's static handling
// only resolves the directory index for `/sandbox/`, so rewrite the bare path.
// The deployed equivalent lives in vercel.json.
function sandboxCleanUrl(): Plugin {
  return {
    name: 'sandbox-clean-url',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/sandbox') req.url = '/sandbox/'
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths(), sandboxCleanUrl()],
  server: { port: 3000 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        sandbox: resolve(import.meta.dirname, 'sandbox/index.html'),
      },
    },
  },
})
