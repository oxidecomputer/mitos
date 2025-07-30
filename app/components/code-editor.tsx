/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import { javascript } from '@codemirror/lang-javascript'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import CodeMirror from '@uiw/react-codemirror'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  editorViewRef?: React.MutableRefObject<EditorView | null>
}

const oxideDark = {
  background: '#080F11',
  foreground: '#E7E7E8',
  selection: '#274355',
  selectionMatch: 'var(--theme-accent-300)',
  cursor: '#E7E7E8',
  dropCursor: '#E7E7E8',
  lineHighlight: '#112228',
  gutterBackground: '#080F11',
  gutterForeground: '#A1A4A5',
  gutterBorder: '#112228',
}

const highlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: '#A1A4A5' },
  { tag: tags.lineComment, color: '#A1A4A5' },
  { tag: tags.blockComment, color: '#A1A4A5' },

  { tag: tags.keyword, color: '#C6A5EA' },
  { tag: tags.controlKeyword, color: '#C6A5EA' },
  { tag: tags.moduleKeyword, color: '#C6A5EA' },
  { tag: tags.operatorKeyword, color: '#C6A5EA' },
  { tag: tags.definitionKeyword, color: '#C6A5EA' },

  { tag: tags.typeName, color: '#EDD5A6' },
  { tag: tags.typeOperator, color: '#A7E0C8' },

  { tag: tags.string, color: '#68D9A7' },
  { tag: tags.regexp, color: '#E7E7E8' },
  { tag: tags.special(tags.string), color: '#68D9A7' },

  { tag: tags.number, color: '#EDD5A6' },
  { tag: tags.bool, color: '#EDD5A6' },
  { tag: tags.null, color: '#C6A5EA' },

  { tag: tags.variableName, color: '#E7E7E8' },
  { tag: tags.propertyName, color: '#E7E7E8' },
  { tag: tags.className, color: '#EDD5A6' },
  { tag: tags.labelName, color: '#EDD5A6' },
  { tag: tags.namespace, color: '#EDD5A6' },

  { tag: tags.function(tags.variableName), color: '#9DAFFA' },
  { tag: tags.function(tags.propertyName), color: '#9DAFFA' },

  { tag: tags.self, color: '#F7869B' },

  { tag: tags.operator, color: '#A7E0C8' },
  { tag: tags.compareOperator, color: '#A7E0C8' },
  { tag: tags.arithmeticOperator, color: '#A7E0C8' },
  { tag: tags.logicOperator, color: '#A7E0C8' },
  { tag: tags.bitwiseOperator, color: '#A7E0C8' },

  { tag: tags.punctuation, color: '#A1A4A5' },
  { tag: tags.separator, color: '#A1A4A5' },
  { tag: tags.bracket, color: '#A1A4A5' },
  { tag: tags.squareBracket, color: '#A1A4A5' },
  { tag: tags.paren, color: '#A1A4A5' },
  { tag: tags.brace, color: '#A1A4A5' },

  { tag: tags.angleBracket, color: '#9DAFFA' },

  { tag: tags.tagName, color: '#9DAFFA' },
  { tag: tags.attributeName, color: '#EDD5A6' },
  { tag: tags.attributeValue, color: '#68D9A7' },
  { tag: tags.special(tags.tagName), color: '#EFB7C2' }, // Component tags

  { tag: tags.link, color: '#9DAFFA' },
  { tag: tags.url, color: '#88DCB7' },

  { tag: tags.heading, color: '#F7869B', fontWeight: 'bold' },
  { tag: tags.heading1, color: '#F7869B', fontWeight: 'bold' },
  { tag: tags.heading2, color: '#EDD5A6', fontWeight: 'bold' },
  { tag: tags.heading3, color: '#EDD5A6', fontWeight: 'bold' },
  { tag: tags.heading4, color: '#88DCB7', fontWeight: 'bold' },
  { tag: tags.heading5, color: '#9DAFFA', fontWeight: 'bold' },
  { tag: tags.heading6, color: '#C6A5EA', fontWeight: 'bold' },

  { tag: tags.quote, color: '#EFB7C2' },
  { tag: tags.list, color: '#A7E0C8' },
  { tag: tags.emphasis, color: '#F7869B', fontStyle: 'italic' },
  { tag: tags.strong, color: '#F7869B', fontWeight: 'bold' },
  { tag: tags.strikethrough, color: '#A6ADC8', textDecoration: 'line-through' },

  { tag: tags.invalid, color: '#FB6E88' },
  { tag: tags.meta, color: '#A7E0C8' },
  { tag: tags.documentMeta, color: '#A7E0C8' },
  { tag: tags.annotation, color: '#EDD5A6' },
  { tag: tags.processingInstruction, color: '#9DAFFA' },

  // Language-specific styles
  { tag: [tags.constant(tags.name), tags.constant(tags.variableName)], color: '#EDD5A6' },
  { tag: tags.macroName, color: '#9DAFFA' },
  { tag: tags.escape, color: '#EFB7C2' },
  { tag: tags.special(tags.variableName), color: '#F7869B' },
  { tag: tags.definition(tags.typeName), color: '#EDD5A6' },

  // Regex
  { tag: tags.regexp, color: '#E7E7E8' },
])

const theme = EditorView.theme({
  '.cm-content': {
    paddingTop: '16px',
    paddingBottom: '44px',
    caretColor: oxideDark.cursor,
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--base-neutral-300)',
  },
  '&': {
    height: '100%',
    fontSize: '12px',
    backgroundColor: oxideDark.background,
    color: oxideDark.foreground,
    fontFamily: 'GT America Mono, monospace',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: oxideDark.cursor,
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: oxideDark.selection + ' !important',
  },
  '.cm-selectionMatch': {
    backgroundColor: oxideDark.selectionMatch,
  },
  '.cm-content ::selection': {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    {
      backgroundColor: oxideDark.selection,
    },
  '.cm-activeLine': {
    backgroundColor: oxideDark.lineHighlight,
  },
  '.cm-activeLine .cm-selectionBackground': {
    backgroundColor: oxideDark.selection + ' !important',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--surface-raise)',
    borderColor: 'var(--stroke-default)',
    color: 'var(--base-neutral-600)',
  },
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: '#1A2E36',
    outline: 'none',
  },
  '.cm-matchingBracket': {
    color: oxideDark.foreground,
  },
  '.cm-nonmatchingBracket': {
    color: '#F7869B',
  },
})

const oxideDarkExtension = [theme, syntaxHighlighting(highlightStyle)]

export default function CodeEditor({ value, onChange, editorViewRef }: CodeEditorProps) {
  const editorExtensions = [
    javascript({ jsx: false, typescript: true }),
    EditorView.lineWrapping,
    oxideDarkExtension,
  ]

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={editorExtensions}
      theme="none"
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        highlightSelectionMatches: false,
        drawSelection: false,
        autocompletion: true,
        foldGutter: true,
        indentOnInput: true,
        history: true,
      }}
      className="h-full flex-grow"
      onCreateEditor={(view) => {
        if (editorViewRef) {
          editorViewRef.current = view
        }
      }}
    />
  )
}
