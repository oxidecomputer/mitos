import { Toaster } from 'sonner'

import { AsciiArtGenerator } from '~/components/ascii-art-generator'

function App() {
  return (
    <main className="h-screen min-h-screen bg-background p-0">
      <AsciiArtGenerator />
      <Toaster />
    </main>
  )
}

export default App
