/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
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

type Props = {
  isLoading: boolean
  children?: ReactNode
  minTime?: number
}

/** Loading spinner that shows for a minimum of `minTime` */
export const SpinnerLoader = ({ isLoading, children = null, minTime = 500 }: Props) => {
  const [isVisible, setIsVisible] = useState(false)
  const hideTimeout = useRef<NodeJS.Timeout | null>(null)
  const showTimeout = useRef<NodeJS.Timeout | null>(null)
  const loadingStartTime = useRef<number>(0)

  useEffect(() => {
    if (isLoading) {
      loadingStartTime.current = Date.now()
      // Only show spinner after 250ms delay
      showTimeout.current = setTimeout(() => {
        setIsVisible(true)
      }, 250)
    } else {
      // Clear the show timer if it's still running
      if (showTimeout.current) clearTimeout(showTimeout.current)
      // Clear the hide timer if it's still running
      if (hideTimeout.current) clearTimeout(hideTimeout.current)

      // If spinner is visible, turn it off making sure it showed for at least `minTime`
      if (isVisible) {
        const elapsedTime = Date.now() - loadingStartTime.current
        const remainingTime = Math.max(0, minTime - elapsedTime)
        if (remainingTime === 0) {
          setIsVisible(false) // might as well not use a timeout
        } else {
          hideTimeout.current = setTimeout(() => setIsVisible(false), remainingTime)
        }
      }
    }

    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current)
      if (showTimeout.current) clearTimeout(showTimeout.current)
    }
  }, [isLoading, minTime, isVisible])

  return isVisible ? (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <Spinner className="text-mono-lg text-secondary" />
      <div className="text-quaternary text-mono-sm">Initializing…</div>
    </div>
  ) : (
    <>{children}</>
  )
}

type DelayedSpinnerProps = {
  isLoading: boolean
  delay?: number
}

/** Overlay spinner that only shows after a delay */
export const DelayedSpinner = ({ isLoading, delay = 250 }: DelayedSpinnerProps) => {
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
