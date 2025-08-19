/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { useEffect, useRef, useState } from 'react'
import { useInterval } from 'usehooks-ts'

export const Spinner = ({ className }: { className?: string }) => {
  const chars = ['|', '/', '—', '\\']

  const [loader, setLoader] = useState({
    char: chars[0],
    index: 0,
  })

  useInterval(() => {
    let index = loader.index
    if (index < chars.length - 1) {
      index++
    } else {
      index = 0
    }

    setLoader({
      char: chars[index],
      index: index,
    })
  }, 150)

  return <span className={className}>{loader.char}</span>
}

/** Overlay spinner that only shows after a delay */
export const DelayedSpinner = ({
  isLoading,
  delay = 250,
}: {
  isLoading: boolean
  delay?: number
}) => {
  const [showSpinner, setShowSpinner] = useState(false)
  const showTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isLoading) {
      // Show spinner after delay
      showTimeout.current = setTimeout(() => {
        setShowSpinner(true)
      }, delay)
    } else {
      // Clear timeout and hide spinner immediately when loading stops
      if (showTimeout.current) {
        clearTimeout(showTimeout.current)
        showTimeout.current = null
      }
      setShowSpinner(false)
    }

    return () => {
      if (showTimeout.current) {
        clearTimeout(showTimeout.current)
      }
    }
  }, [isLoading, delay])

  if (!showSpinner) return null

  return (
    <div className="absolute inset-0 z-50 flex h-full flex-col items-center justify-center gap-2 bg-opacity-90 bg-default">
      <Spinner className="text-mono-lg text-secondary" />
      <div className="text-quaternary text-mono-sm">Initializing…</div>
    </div>
  )
}
