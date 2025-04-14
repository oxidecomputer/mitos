/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import * as Ariakit from '@ariakit/react'
import { PopoverArrow } from '@ariakit/react'
import { forwardRef, useRef } from 'react'

import { InputButton } from '~/lib/ui/src'

export interface PopoverProps extends Ariakit.PopoverProps {
  placement?: Ariakit.PopoverStoreProps['placement']
  anchorRef?: React.RefObject<HTMLElement>
}

export const Popover = forwardRef<HTMLDivElement, PopoverProps>(
  function Popover(props, ref) {
    const { placement, anchorRef, ...rest } = props
    const fallbackRef = useRef<HTMLSpanElement>(null)
    return (
      <Ariakit.PopoverProvider placement={placement}>
        <span ref={fallbackRef} style={{ position: 'fixed' }} />
        <Ariakit.Popover
          ref={ref}
          open
          portal
          unmountOnHide
          getAnchorRect={() => {
            if (anchorRef) {
              return anchorRef.current?.getBoundingClientRect() || null
            }
            const parentElement = fallbackRef.current?.parentElement
            if (parentElement) {
              return parentElement.getBoundingClientRect()
            }
            return null
          }}
          style={{ zIndex: 40 }}
          {...rest}
        />
      </Ariakit.PopoverProvider>
    )
  },
)

function PasteConfirmationDialog({
  imageUrl,
  open,
  onConfirm,
  onCancel,
}: {
  imageUrl: string | null
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Popover
      placement="right"
      open={open}
      onClose={onCancel}
      className="dialog ml-3 max-w-60 rounded-md border p-3 bg-default border-default elevation-2"
    >
      <PopoverArrow className="arrow" />
      <div className="mb-2 overflow-hidden rounded-md border border-default">
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Pasted image preview"
            className="w-full object-contain"
          />
        )}
      </div>
      <div className="flex justify-end gap-2">
        {/* ariakit uses first element as default focus, I want this to be the confirm button then swap back with order */}
        <InputButton variant="default" onClick={onConfirm} className="order-2">
          Use Image
        </InputButton>
        <InputButton variant="secondary" onClick={onCancel} className="order-1">
          Cancel
        </InputButton>
      </div>
    </Popover>
  )
}

export { PasteConfirmationDialog }
