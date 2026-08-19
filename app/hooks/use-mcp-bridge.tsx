/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

/**
 * WebSocket bridge to the Mitos MCP server (mcp/server.ts), letting MCP
 * clients like Claude Code read/write the code editor, patch settings, and
 * read rendered frames back as text. Active in dev builds, or when the page
 * is opened with ?mcp. Reconnects until the server is running.
 */
import { useEffect, useRef } from 'react'

import type { AsciiSettings } from '~/components/ascii-art-generator'
import type { AnimationController } from '~/components/ascii-preview'
import { getContent } from '~/lib/buffer-text'
import { DEFAULT_SETTINGS, TEMPLATES, TemplateType } from '~/templates'

// Must match the MCP server's port (MITOS_BRIDGE_PORT). Override in the tab
// with ?mcp=<port> when the server runs on a non-default port.
const DEFAULT_BRIDGE_PORT = 6486
const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_DELAY_MS = 60_000

// setCode/loadTemplate wait for the compile pipeline to settle before replying,
// so the server reads back the frame the new code actually produced.
// processCodeModule's own timeout is 5s; the mount delay covers React
// committing the new program and remounting the animation controller.
const PROCESS_POLL_MS = 50
const PROCESS_TIMEOUT_MS = 6000
const MOUNT_SETTLE_MS = 150

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const SETTINGS_SECTIONS = Object.keys(DEFAULT_SETTINGS) as (keyof AsciiSettings)[]

interface McpBridge {
  pendingCode: string
  applyCode: (code: string) => void
  settings: AsciiSettings
  updateSettings: <K extends keyof AsciiSettings>(
    section: K,
    newValues: Partial<AsciiSettings[K]>,
  ) => void
  animationController: AnimationController
  codeError: string | null
  loadTemplate: (template: TemplateType) => void
  getProcessSeq: () => number
}

interface BridgeMessage {
  id: string
  type: string
  payload?: Record<string, unknown>
}

function renderFrameText(
  controller: AnimationController,
  codeError: string | null,
  frame?: number,
) {
  if (!controller || !controller.isReady()) {
    throw new Error(
      codeError
        ? `The code failed to compile: ${codeError}`
        : 'No program is rendering yet. Set some code or load a template first.',
    )
  }

  const previousFrame = controller.getState().frame
  const targetFrame = frame ?? previousFrame
  controller.renderFrame(targetFrame)

  const { cols, rows } = controller.getState()
  const text = getContent({ width: cols, height: rows }, controller)

  // Put the canvas back where the user had it — sampling frames for an MCP
  // client must not move visible playback
  if (targetFrame !== previousFrame) {
    controller.renderFrame(previousFrame)
  }

  return { frame: targetFrame, cols, rows, text }
}

function requireTemplateName(payload: Record<string, unknown>): TemplateType {
  const name = payload.name
  if (typeof name !== 'string' || !(name in TEMPLATES)) {
    throw new Error(
      `Unknown template "${String(name)}". Use list_templates to see valid keys.`,
    )
  }
  return name as TemplateType
}

export function useMcpBridge(bridge: McpBridge) {
  // The socket lives across renders; handlers always read the latest state
  const bridgeRef = useRef(bridge)
  bridgeRef.current = bridge

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const enabled = import.meta.env.DEV || params.has('mcp')
    if (!enabled) return

    // ?mcp=<port> points the tab at a server started with MITOS_BRIDGE_PORT
    const port = Number(params.get('mcp')) || DEFAULT_BRIDGE_PORT
    const bridgeUrl = `ws://localhost:${port}`

    let ws: WebSocket | null = null
    let reconnectTimer: number | undefined
    let reconnectDelay = RECONNECT_DELAY_MS
    let disposed = false

    // Wait until the settings-processing pipeline has run once more (or time
    // out), so replies to setCode/loadTemplate reflect the applied code
    const waitForProcessing = async (seqBefore: number) => {
      const deadline = Date.now() + PROCESS_TIMEOUT_MS
      while (bridgeRef.current.getProcessSeq() === seqBefore && Date.now() < deadline) {
        await sleep(PROCESS_POLL_MS)
      }
      await sleep(MOUNT_SETTLE_MS)
    }

    const handle = async (type: string, payload: Record<string, unknown> = {}) => {
      const current = bridgeRef.current

      switch (type) {
        case 'status': {
          const controller = current.animationController
          return {
            hasProgram: !!controller && controller.isReady(),
            playing: controller ? controller.getState().playing : false,
            frame: controller ? controller.getState().frame : null,
            cols: current.settings.output.columns,
            rows: current.settings.output.rows,
            animationLength: current.settings.animation.animationLength,
            frameRate: current.settings.animation.frameRate,
            hasImageSource: current.settings.source.data !== null,
            lastError: current.codeError,
          }
        }
        case 'getCode':
          return current.pendingCode
        case 'setCode': {
          if (typeof payload.code !== 'string') {
            throw new Error('setCode expects a string "code" payload')
          }
          const seqBefore = current.getProcessSeq()
          current.applyCode(payload.code)
          await waitForProcessing(seqBefore)
          return { applied: true }
        }
        case 'getFrame': {
          const frame = typeof payload.frame === 'number' ? payload.frame : undefined
          return {
            ...renderFrameText(current.animationController, current.codeError, frame),
            error: current.codeError,
          }
        }
        case 'getFrames': {
          if (!Array.isArray(payload.frames)) {
            throw new Error('getFrames expects a "frames" array payload')
          }
          return payload.frames.map((frame) => ({
            ...renderFrameText(
              current.animationController,
              current.codeError,
              Number(frame),
            ),
            error: current.codeError,
          }))
        }
        case 'getSettings':
          return current.settings
        case 'patchSettings': {
          const patch = payload.settings as Partial<AsciiSettings> | undefined
          if (!patch || typeof patch !== 'object') {
            throw new Error('patchSettings expects a "settings" object payload')
          }
          const unknownKeys = Object.keys(patch).filter(
            (key) => !SETTINGS_SECTIONS.includes(key as keyof AsciiSettings),
          )
          if (unknownKeys.length > 0) {
            throw new Error(
              `Unknown settings sections: ${unknownKeys.join(', ')}. ` +
                `Valid sections: ${SETTINGS_SECTIONS.join(', ')}`,
            )
          }
          for (const section of SETTINGS_SECTIONS) {
            const values = patch[section]
            if (!values) continue
            // Code changes must go through applyCode so the editor
            // (pendingCode) stays in sync with what runs
            if (
              section === 'source' &&
              typeof (values as { code?: unknown }).code === 'string'
            ) {
              const { code, ...rest } = values as { code: string } & Record<string, unknown>
              current.applyCode(code)
              if (Object.keys(rest).length > 0) {
                current.updateSettings('source', rest as never)
              }
              continue
            }
            current.updateSettings(section, values as never)
          }
          return { applied: true }
        }
        case 'listTemplates':
          return Object.entries(TEMPLATES).map(([key, template]) => ({
            key,
            name: template.meta.name,
          }))
        case 'getTemplateCode': {
          const code = TEMPLATES[requireTemplateName(payload)].source.code
          return code || '(this template has no code — it is settings-only)'
        }
        case 'loadTemplate': {
          const name = requireTemplateName(payload)
          const seqBefore = current.getProcessSeq()
          current.loadTemplate(name)
          await waitForProcessing(seqBefore)
          return { applied: true }
        }
        default:
          throw new Error(`Unknown bridge request type "${type}"`)
      }
    }

    const connect = () => {
      if (disposed) return

      ws = new WebSocket(bridgeUrl)

      ws.onopen = () => {
        reconnectDelay = RECONNECT_DELAY_MS
      }

      ws.onmessage = async (event) => {
        let msg: BridgeMessage
        try {
          msg = JSON.parse(event.data)
        } catch {
          return
        }

        // handle() can await the compile pipeline, so reply on the socket the
        // request came in on, not whatever ws points at afterwards
        const socket = ws
        try {
          const result = await handle(msg.type, msg.payload)
          socket?.send(JSON.stringify({ id: msg.id, ok: true, result }))
        } catch (error) {
          socket?.send(
            JSON.stringify({
              id: msg.id,
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          )
        }
      }

      ws.onclose = () => {
        ws = null
        if (!disposed) {
          reconnectTimer = window.setTimeout(connect, reconnectDelay)
          // Back off while nothing is listening so idle dev tabs don't spend
          // the whole session hammering a closed port
          reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS)
        }
      }

      // Suppress the browser's console noise while the server isn't running;
      // onclose handles the retry
      ws.onerror = () => {}
    }

    connect()

    return () => {
      disposed = true
      window.clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [])
}
