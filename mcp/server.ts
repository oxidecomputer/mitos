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
 * Each MCP client spawns its own copy of this file, but only one process can
 * own the bridge port. The first one to bind becomes the host and talks to the
 * tab directly; later ones connect back to the host as relays (?role=relay)
 * and have their requests forwarded, so a second Claude Code session does not
 * die on EADDRINUSE. If the host goes away, a relay takes over the port.
 *
 * Register with Claude Code via the repo's .mcp.json, then run `bun run dev`
 * and open the app. Logs go to stderr (stdout carries the MCP protocol).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { ServerWebSocket } from 'bun'
import { z } from 'zod'

// The tab defaults to 6486 too; when overriding, open the app with ?mcp=<port>
// so both sides agree (see app/hooks/use-mcp-bridge.tsx).
const DEFAULT_PORT = 6486
const PORT = Number(process.env.MITOS_BRIDGE_PORT ?? DEFAULT_PORT)

// Custom close codes, matched in app/hooks/use-mcp-bridge.tsx. The connection
// only moves between tabs on an explicit user action: a connecting tab that
// didn't ask to take over is parked (OCCUPIED), and only a ?takeover connect
// bumps the current tab (REPLACED).
const REPLACED_CLOSE_CODE = 4000
const OCCUPIED_CLOSE_CODE = 4001

// setCode/loadTemplate block in the tab until the compile pipeline settles
// (up to ~6s), so this must comfortably exceed that.
const REQUEST_TIMEOUT_MS = 10_000

// How long a relay waits before trying to take over the port, and how long a
// tool call waits for the relay socket to come up before giving up.
const RELAY_RETRY_MS = 500
const RELAY_READY_TIMEOUT_MS = 2_000

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/** Anything we can write a bridge message to: the tab, or the host we relay through. */
interface Sink {
  send: (data: string) => void
}

interface SocketData {
  role: 'app' | 'relay'
  takeover: boolean
}

// Host mode: the tab we drive, plus any relaying server processes.
let appSocket: ServerWebSocket<SocketData> | null = null
const relays = new Set<ServerWebSocket<SocketData>>()

// Relay mode: our client connection to whichever process owns the port.
let upstream: WebSocket | null = null

let mode: 'host' | 'relay' = 'host'

const pending = new Map<string, PendingRequest>()
let nextId = 1

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const NOT_CONNECTED_MESSAGE =
  `No Mitos tab is connected to the bridge (ws://localhost:${PORT}). ` +
  'Start the dev server with `bun run dev` and open the app in a browser ' +
  (PORT === DEFAULT_PORT
    ? '(the bridge connects automatically in dev, or add ?mcp to the URL).'
    : `(this bridge is on a non-default port — open the app with ?mcp=${PORT}).`)

const NO_UPSTREAM_MESSAGE =
  `Another process owns the Mitos bridge (ws://localhost:${PORT}) but this ` +
  'server could not reach it. It will keep retrying — try again in a moment.'

/**
 * The socket that carries our requests: the tab when we are the host, the host
 * when we are a relay. Relay connections come up asynchronously, so wait
 * briefly for one rather than failing a tool call that arrives during startup.
 */
async function bridge(): Promise<Sink | null> {
  if (mode === 'host') return appSocket

  const attempts = Math.ceil(RELAY_READY_TIMEOUT_MS / 100)
  for (let i = 0; i < attempts; i++) {
    if (upstream?.readyState === WebSocket.OPEN) return upstream
    await sleep(100)
  }
  return upstream?.readyState === WebSocket.OPEN ? upstream : null
}

async function request<T>(type: string, payload?: unknown): Promise<T> {
  const target = await bridge()
  if (!target) {
    throw new Error(mode === 'host' ? NOT_CONNECTED_MESSAGE : NO_UPSTREAM_MESSAGE)
  }

  const id = String(nextId++)
  const message = JSON.stringify({ id, type, payload })

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`Timed out waiting for the app to answer "${type}"`))
    }, REQUEST_TIMEOUT_MS)

    pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer })
    target.send(message)
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

function rejectAllPending(reason: string) {
  for (const [id] of pending) {
    settlePending(id, false, null, reason)
  }
}

/** Settle the matching request from a response sent by the tab (or, in relay mode, the host). */
function handleResponse(raw: string, from: string) {
  try {
    const msg = JSON.parse(raw)
    if (msg && typeof msg.id === 'string') {
      settlePending(msg.id, msg.ok === true, msg.result, msg.error)
    }
  } catch (error) {
    console.error(`[mitos-mcp] could not parse message from ${from}:`, error)
  }
}

/** Host side: run a relay's request against the tab and send the answer back. */
async function forwardFromRelay(relay: ServerWebSocket<SocketData>, raw: string) {
  let id: string | undefined
  try {
    const msg = JSON.parse(raw)
    if (typeof msg?.id !== 'string' || typeof msg?.type !== 'string') return
    id = msg.id
    const result = await request(msg.type, msg.payload)
    relay.send(JSON.stringify({ id, ok: true, result }))
  } catch (error) {
    if (id === undefined) {
      console.error('[mitos-mcp] could not parse message from relay:', error)
      return
    }
    relay.send(JSON.stringify({ id, ok: false, error: (error as Error).message }))
  }
}

/** Try to own the bridge port. Returns false if another process already does. */
function startHost(): boolean {
  try {
    Bun.serve<SocketData, Record<string, never>>({
      port: PORT,
      fetch(req, server) {
        const params = new URL(req.url).searchParams
        const role = params.get('role') === 'relay' ? 'relay' : 'app'
        const takeover = params.has('takeover')
        if (server.upgrade(req, { data: { role, takeover } })) return undefined
        return new Response('Mitos MCP bridge — expected a WebSocket connection', {
          status: 400,
        })
      },
      websocket: {
        open(ws) {
          if (ws.data.role === 'relay') {
            relays.add(ws)
            console.error(`[mitos-mcp] relay connected (${relays.size} total)`)
            return
          }
          // A single tab drives the canvas, and the connection only moves on
          // an explicit takeover (the MCP chip in the app) — a tab that just
          // connected is parked, not promoted
          if (appSocket && appSocket !== ws && !ws.data.takeover) {
            ws.close(OCCUPIED_CLOSE_CODE, 'Another Mitos tab holds the connection')
            return
          }
          if (appSocket && appSocket !== ws) {
            appSocket.close(REPLACED_CLOSE_CODE, 'Replaced by another Mitos tab')
          }
          appSocket = ws
          // Explicit confirmation so the tab only shows "active" once it
          // really holds the connection (a parked socket also opens briefly)
          ws.send(JSON.stringify({ type: 'activated' }))
          console.error('[mitos-mcp] app connected')
        },
        close(ws) {
          if (ws.data.role === 'relay') {
            relays.delete(ws)
            console.error(`[mitos-mcp] relay disconnected (${relays.size} left)`)
            return
          }
          // Only the current tab's disconnect kills pending requests — a
          // socket replaced by a newer tab closes late, after requests are
          // already routed to its replacement
          if (appSocket === ws) {
            appSocket = null
            console.error('[mitos-mcp] app disconnected')
            rejectAllPending('The Mitos tab disconnected')
          }
        },
        message(ws, raw) {
          if (ws.data.role === 'relay') {
            void forwardFromRelay(ws, String(raw))
            return
          }
          handleResponse(String(raw), 'app')
        },
      },
    })
    mode = 'host'
    console.error(`[mitos-mcp] bridge listening on ws://localhost:${PORT}`)
    return true
  } catch (error) {
    if ((error as { code?: string }).code !== 'EADDRINUSE') throw error
    return false
  }
}

/**
 * Connect to the process that owns the port and forward our requests through
 * it. On disconnect, try to become the host ourselves before reconnecting.
 */
function startRelay() {
  mode = 'relay'
  const ws = new WebSocket(`ws://localhost:${PORT}?role=relay`)
  upstream = ws

  ws.onopen = () => console.error(`[mitos-mcp] relaying via ws://localhost:${PORT}`)

  ws.onmessage = (event) => handleResponse(String(event.data), 'host')

  // A failed connect fires error then close; recovery happens in onclose only.
  ws.onerror = () => {}

  ws.onclose = () => {
    if (upstream !== ws) return
    upstream = null
    rejectAllPending('The Mitos bridge host went away')
    setTimeout(() => {
      if (upstream) return
      if (!startHost()) startRelay()
    }, RELAY_RETRY_MS)
  }
}

if (!startHost()) {
  console.error(`[mitos-mcp] port ${PORT} is taken — connecting as a relay`)
  startRelay()
}

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
    // The tab answers setCode only once the compile pipeline has settled, so
    // the frame read back here reflects the applied code
    await request('setCode', { code })
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
  'Deep-merge a partial settings object into the current Mitos settings. Top-level keys: output (columns, rows, characterSet, grid, gridColor, characterMapping, motionThreshold, motionDecay), animation (animationLength, frameRate), preprocessing (brightness, whitePoint, blackPoint, invert, dithering), export (textColor, backgroundColor, padding, lineHeight).',
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
    const frame = await request<FrameResult>('getFrame', {})
    return text(formatFrame(frame))
  },
)

await server.connect(new StdioServerTransport())
console.error('[mitos-mcp] MCP server ready on stdio')
