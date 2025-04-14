/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { Toaster } from 'sonner'

import { AsciiArtGenerator } from '~/components/ascii-art-generator'

function App() {
  return (
    <main className="bg-background h-screen min-h-screen p-0">
      <AsciiArtGenerator />
      <Toaster
        toastOptions={{
          className: '!bg-raise !rounded-md !elevation-2 !border-default !text-default',
        }}
        offset={12}
        position="top-right"
      />
    </main>
  )
}

export default App
