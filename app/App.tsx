import { Toaster } from 'sonner'

import { AsciiArtGenerator } from '~/components/ascii-art-generator'

function App() {
  return (
    <main className="h-screen min-h-screen bg-background p-0">
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
