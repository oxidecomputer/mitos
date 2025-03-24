import { javascript } from '@codemirror/lang-javascript'
import { EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
}

export default function CodeEditor({ value, onChange }: CodeEditorProps) {
  const theme = EditorView.theme({
    '&': {
      height: 'calc(100vh - 200px)',
      fontSize: '12px',
    },
    '.cm-scroller': {
      fontFamily: 'monospace',
    },
    '&.cm-editor.cm-focused': {
      outline: '2px solid #7c3aed',
    },
  })

  const editorExtensions = [
    javascript({ jsx: false, typescript: false }),
    theme,
    EditorView.lineWrapping,
  ]

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        <p>
          Define a <code className="rounded bg-muted p-1">main</code> function that returns
          a character for each cell.
        </p>
        <p>
          Optional: Add <code className="rounded bg-muted p-1">boot</code>,{' '}
          <code className="rounded bg-muted p-1">pre</code>, and{' '}
          <code className="rounded bg-muted p-1">post</code> functions.
        </p>
      </div>
      <div className="overflow-hidden rounded-md border">
        <CodeMirror
          value={value}
          onChange={onChange}
          extensions={editorExtensions}
          theme="light"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            autocompletion: true,
            foldGutter: true,
            indentOnInput: true,
          }}
        />
      </div>
    </div>
  )
}
