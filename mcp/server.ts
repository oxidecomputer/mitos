/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

/**
 * Mitos MCP server
 *
 * Exposes the running Mitos app (dev server) to MCP clients such as Claude
 * Code. Runs an MCP server over stdio and a WebSocket bridge that a Mitos
 * browser tab connects to (see app/hooks/use-mcp-bridge.tsx). Tools relay
 * requests to the tab: read/write the code editor, patch settings, and read
 * back rendered ASCII frames as plain text.
 *
 * Register with Claude Code via the repo's .mcp.json, then run `bun run dev`
 * and open the app. Logs go to stderr (stdout carries the MCP protocol).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { ServerWebSocket } from 'bun'
import { z } from 'zod'

const PORT = Number(process.env.MITOS_BRIDGE_PORT ?? 6486)
const REQUEST_TIMEOUT_MS = 10_000

// How long to wait after applying code before rendering a frame back to the
// client. Covers esbuild-wasm compile plus a couple of animation frames.
const APPLY_SETTLE_MS = 700

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

let socket: ServerWebSocket<unknown> | null = null
const pending = new Map<string, PendingRequest>()
let nextId = 1

const NOT_CONNECTED_MESSAGE =
  `No Mitos tab is connected to the bridge (ws://localhost:${PORT}). ` +
  'Start the dev server with `bun run dev` and open the app in a browser ' +
  '(the bridge connects automatically in dev, or add ?mcp to the URL).'

function request<T>(type: string, payload?: unknown): Promise<T> {
  if (!socket) {
    return Promise.reject(new Error(NOT_CONNECTED_MESSAGE))
  }

  const id = String(nextId++)
  const message = JSON.stringify({ id, type, payload })

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`Timed out waiting for the app to answer "${type}"`))
    }, REQUEST_TIMEOUT_MS)

    pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer })
    socket?.send(message)
  })
}

function settlePending(id: string, ok: boolean, result: unknown, error?: string) {
  const entry = pending.get(id)
  if (!entry) return

  pending.delete(id)
  clearTimeout(entry.timer)

  if (ok) {
    entry.resolve(result)
  } else {
    entry.reject(new Error(error || 'The app reported an unknown error'))
  }
}

Bun.serve({
  port: PORT,
  fetch(req, server) {
    if (server.upgrade(req)) return undefined
    return new Response('Mitos MCP bridge — expected a WebSocket connection', {
      status: 400,
    })
  },
  websocket: {
    open(ws) {
      // A single tab drives the canvas; the most recent connection wins
      if (socket && socket !== ws) {
        socket.close(1000, 'Replaced by a newer Mitos tab')
      }
      socket = ws
      console.error('[mitos-mcp] app connected')
    },
    close(ws) {
      if (socket === ws) {
        socket = null
        console.error('[mitos-mcp] app disconnected')
      }
      for (const [id] of pending) {
        settlePending(id, false, null, 'The Mitos tab disconnected')
      }
    },
    message(_ws, raw) {
      try {
        const msg = JSON.parse(String(raw))
        if (msg && typeof msg.id === 'string') {
          settlePending(msg.id, msg.ok === true, msg.result, msg.error)
        }
      } catch (error) {
        console.error('[mitos-mcp] could not parse message from app:', error)
      }
    },
  },
})

console.error(`[mitos-mcp] bridge listening on ws://localhost:${PORT}`)

// -- Shared response shapes -----------------------------------------------------

interface FrameResult {
  frame: number
  cols: number
  rows: number
  text: string
  error: string | null
}

function text(value: string) {
  return { content: [{ type: 'text' as const, text: value }] }
}

function formatFrame(frame: FrameResult): string {
  const header = `frame ${frame.frame} (${frame.cols}×${frame.rows})`
  const error = frame.error ? `\n\nLast code error: ${frame.error}` : ''
  return `${header}\n\n\`\`\`\n${frame.text}\n\`\`\`${error}`
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// -- MCP server -------------------------------------------------------------------

const server = new McpServer(
  { name: 'mitos', version: '0.1.0' },
  {
    instructions: `Mitos is a live ASCII art canvas: scripts run per grid cell per frame, like a
fragment shader over characters. These tools drive a running Mitos tab (requires
\`bun run dev\` and the app open in a browser — get_status checks the connection).

Workflow for writing scripts:
1. Call get_docs before writing your first script — it covers the program model
   (main/boot/pre/post), the virtual imports (@/utils, @/imageData, @/settings, npm
   via unpkg), the //~ control annotation syntax, and gotchas (cell aspect ratio,
   frame-based animation, loop length).
2. For an unfamiliar style, fetch a similar built-in example: list_templates, then
   get_template_code — the templates are the house idiom.
3. Apply code with set_code and read the frame it returns — it shows exactly what the
   canvas renders, including any compile error. Do not assume success.
4. For animation, sample several frames in one call: get_frame with frames [0, 25,
   50, 75] (the default loop is 100 frames), and check motion is smooth and loops.

House style: plain functions, no exports; expose interesting parameters as //~
controls with sensible ranges; animate with context.frame (deterministic), periodic
in the animation length; use a dark→light character ramp and { char, color } returns
when color adds something.`,
  },
)

server.tool(
  'get_docs',
  'Get the Mitos scripting reference: program model (main/boot/pre/post), available imports, the //~ control annotation syntax, and gotchas like cell aspect ratio. Read this before writing your first script.',
  {},
  async () => {
    const docs = await Bun.file(`${import.meta.dir}/../docs/scripting.md`).text()
    return text(docs)
  },
)

server.tool(
  'get_status',
  'Check whether a Mitos tab is connected and get an overview: grid size, playback state, and the last code error if any.',
  {},
  async () => {
    const status = await request('status')
    return text(JSON.stringify(status, null, 2))
  },
)

server.tool(
  'get_code',
  'Read the current contents of the Mitos code editor.',
  {},
  async () => {
    const code = await request<string>('getCode')
    return text(code || '(the editor is empty)')
  },
)

server.tool(
  'set_code',
  'Replace the contents of the Mitos code editor and run it. Returns the rendered ASCII frame (or the compile error) so you can see the result. Call get_docs first if you are not familiar with the script API, and get_template_code for working examples.',
  { code: z.string().describe('The full script source to put in the editor') },
  async ({ code }) => {
    await request('setCode', { code })
    await sleep(APPLY_SETTLE_MS)
    const frame = await request<FrameResult>('getFrame', {})
    return text(formatFrame(frame))
  },
)

server.tool(
  'get_frame',
  'Render frames of the current program and return them as plain text. Omit both arguments for the current frame, pass `frame` for one specific frame, or `frames` for several at once (e.g. [0, 25, 50, 75] to inspect an animation).',
  {
    frame: z.number().int().min(0).optional().describe('A single frame number to render'),
    frames: z
      .array(z.number().int().min(0))
      .max(16)
      .optional()
      .describe('Several frame numbers to render in one call'),
  },
  async ({ frame, frames }) => {
    if (frames && frames.length > 0) {
      const results = await request<FrameResult[]>('getFrames', { frames })
      return text(results.map(formatFrame).join('\n\n'))
    }
    const result = await request<FrameResult>('getFrame', { frame })
    return text(formatFrame(result))
  },
)

server.tool(
  'get_settings',
  'Read the full Mitos settings object (source, preprocessing, output, animation, export).',
  {},
  async () => {
    const settings = await request('getSettings')
    return text(JSON.stringify(settings, null, 2))
  },
)

server.tool(
  'patch_settings',
  'Deep-merge a partial settings object into the current Mitos settings. Top-level keys: output (columns, rows, characterSet, grid, colorMapping), animation (animationLength, frameRate), preprocessing (brightness, whitePoint, blackPoint, invert, dithering), export (textColor, backgroundColor, padding).',
  {
    settings: z
      .record(z.string(), z.record(z.string(), z.unknown()))
      .describe('Partial settings, e.g. {"output": {"columns": 120, "rows": 60}}'),
  },
  async ({ settings }) => {
    const result = await request('patchSettings', { settings })
    return text(JSON.stringify(result, null, 2))
  },
)

server.tool(
  'list_templates',
  'List the built-in example templates that can be loaded into the canvas.',
  {},
  async () => {
    const templates = await request('listTemplates')
    return text(JSON.stringify(templates, null, 2))
  },
)

server.tool(
  'get_template_code',
  'Read the source code of a built-in template without loading it onto the canvas. Templates are the house idiom — fetch a similar one before writing a new script in an unfamiliar style.',
  { name: z.string().describe('Template key from list_templates') },
  async ({ name }) => {
    const code = await request<string>('getTemplateCode', { name })
    return text(code)
  },
)

server.tool(
  'load_template',
  'Load a built-in template (code and settings) into the canvas by its key.',
  { name: z.string().describe('Template key from list_templates') },
  async ({ name }) => {
    await request('loadTemplate', { name })
    await sleep(APPLY_SETTLE_MS)
    const frame = await request<FrameResult>('getFrame', {})
    return text(formatFrame(frame))
  },
)

await server.connect(new StdioServerTransport())
console.error('[mitos-mcp] MCP server ready on stdio')
