/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import type { McpBridgeStatus } from '~/hooks/use-mcp-bridge'
import { InputButton } from '~/lib/ui/src'
import { cn } from '~/lib/utils'

import { Container } from './container'

const STATES: Record<
  Exclude<McpBridgeStatus, 'disabled'>,
  { dot: string; label: string; title: string }
> = {
  active: {
    dot: 'bg-accent',
    label: 'Connected',
    title: 'An MCP client is connected to this tab',
  },
  inactive: {
    dot: 'bg-notice',
    label: 'Other tab',
    title: 'Another tab holds the MCP connection',
  },
  disconnected: {
    dot: 'bg-[--content-quaternary]',
    label: 'No client',
    title: 'No MCP server is running',
  },
}

/**
 * Sidebar section showing whether an MCP client (e.g. Claude Code) is driving
 * this tab. When another tab holds the connection, offers an explicit
 * takeover — the only way the connection moves between tabs.
 */
export function McpIndicator({
  status,
  takeOver,
}: {
  status: McpBridgeStatus
  takeOver: () => void
}) {
  if (status === 'disabled') return null

  const state = STATES[status]

  return (
    <Container>
      <div className="flex items-center justify-between" title={state.title}>
        <div className="ui-select">
          <label className="ui-select__label">MCP</label>
        </div>
        <div className="flex items-center gap-1.5 font-mono uppercase text-secondary [font-size:11px]">
          <span className={cn('h-1.5 w-1.5 rounded-full', state.dot)} />
          {state.label}
        </div>
      </div>

      {status === 'inactive' && (
        <InputButton variant="secondary" className="w-full" onClick={takeOver}>
          Use this tab
        </InputButton>
      )}
    </Container>
  )
}
