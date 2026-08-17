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
import { TEMPLATES, TemplateType } from '~/templates'

const BRIDGE_URL = 'ws://localhost:6486'
const RECONNECT_DELAY_MS = 2000

const SETTINGS_SECTIONS = [
  'meta',
  'source',
  'preprocessing',
  'output',
  'export',
  'animation',
] as const

interface McpBridge {
  pendingCode: string
  applyCode: (code: string) => void
  settings: AsciiSettings
  setSettings: React.Dispatch<React.SetStateAction<AsciiSettings>>
  animationController: AnimationController
  codeError: string | null
  loadTemplate: (template: TemplateType) => void
}

interface BridgeMessage {
  id: string
  type: string
  payload?: Record<string, unknown>
}

function renderFrameText(controller: AnimationController, frame?: number) {
  if (!controller || !controller.isReady()) {
    throw new Error('No program is rendering yet. Set some code or load a template first.')
  }

  const targetFrame = frame ?? controller.getState().frame
  controller.renderFrame(targetFrame)

  const { cols, rows } = controller.getState()
  const buffer = controller.getBuffer()
  const lines: string[] = []

  for (let y = 0; y < rows; y++) {
    let line = ''
    for (let x = 0; x < cols; x++) {
      line += buffer[y * cols + x]?.char ?? ' '
    }
    lines.push(line)
  }

  return { frame: targetFrame, cols, rows, text: lines.join('\n') }
}

export function useMcpBridge(bridge: McpBridge) {
  // The socket lives across renders; handlers always read the latest state
  const bridgeRef = useRef(bridge)
  bridgeRef.current = bridge

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const enabled = import.meta.env.DEV || params.has('mcp')
    if (!enabled) return

    let ws: WebSocket | null = null
    let reconnectTimer: number | undefined
    let disposed = false

    const handle = (type: string, payload: Record<string, unknown> = {}) => {
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
          current.applyCode(payload.code)
          return { applied: true }
        }
        case 'getFrame': {
          const frame = typeof payload.frame === 'number' ? payload.frame : undefined
          return {
            ...renderFrameText(current.animationController, frame),
            error: current.codeError,
          }
        }
        case 'getFrames': {
          if (!Array.isArray(payload.frames)) {
            throw new Error('getFrames expects a "frames" array payload')
          }
          return payload.frames.map((frame) => ({
            ...renderFrameText(current.animationController, Number(frame)),
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
            (key) => !SETTINGS_SECTIONS.includes(key as (typeof SETTINGS_SECTIONS)[number]),
          )
          if (unknownKeys.length > 0) {
            throw new Error(
              `Unknown settings sections: ${unknownKeys.join(', ')}. ` +
                `Valid sections: ${SETTINGS_SECTIONS.join(', ')}`,
            )
          }
          current.setSettings((prev) => {
            const next = { ...prev }
            for (const section of SETTINGS_SECTIONS) {
              if (patch[section]) {
                next[section] = { ...prev[section], ...patch[section] } as never
              }
            }
            return next
          })
          return { applied: true }
        }
        case 'listTemplates':
          return Object.entries(TEMPLATES).map(([key, template]) => ({
            key,
            name: template.meta.name,
          }))
        case 'getTemplateCode': {
          const name = payload.name
          if (typeof name !== 'string' || !(name in TEMPLATES)) {
            throw new Error(
              `Unknown template "${String(name)}". Use list_templates to see valid keys.`,
            )
          }
          const code = TEMPLATES[name as TemplateType].source.code
          return code || '(this template has no code — it is settings-only)'
        }
        case 'loadTemplate': {
          const name = payload.name
          if (typeof name !== 'string' || !(name in TEMPLATES)) {
            throw new Error(
              `Unknown template "${String(name)}". Use list_templates to see valid keys.`,
            )
          }
          current.loadTemplate(name as TemplateType)
          return { applied: true }
        }
        default:
          throw new Error(`Unknown bridge request type "${type}"`)
      }
    }

    const connect = () => {
      if (disposed) return

      ws = new WebSocket(BRIDGE_URL)

      ws.onmessage = (event) => {
        let msg: BridgeMessage
        try {
          msg = JSON.parse(event.data)
        } catch {
          return
        }

        try {
          const result = handle(msg.type, msg.payload)
          ws?.send(JSON.stringify({ id: msg.id, ok: true, result }))
        } catch (error) {
          ws?.send(
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
          reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY_MS)
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
