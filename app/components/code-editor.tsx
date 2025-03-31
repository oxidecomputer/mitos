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
      height: '100vh',
      fontSize: '12px',
    },
    '.cm-scroller': {
      fontFamily: 'GT America Mono, monospace',
    },
    '&.cm-editor.cm-focused': {
      outline: '2px solid #7c3aed',
    },
    '.cm-content': {
      paddingTop: '12px',
      paddingBottom: '44px',
    },
  })

  const editorExtensions = [
    javascript({ jsx: false, typescript: false }),
    theme,
    EditorView.lineWrapping,
  ]

  return (
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
  )
}
