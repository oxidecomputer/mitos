/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import * as esbuild from 'esbuild-wasm'
import { useEffect, useRef, useState } from 'react'

export type EsbuildService = typeof esbuild

export function useEsbuild() {
  const esbuildService = useRef<EsbuildService | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const initializationAttempted = useRef(false)

  useEffect(() => {
    const initializeEsbuild = async () => {
      // Prevent double initialization in StrictMode
      if (initializationAttempted.current) {
        return
      }

      initializationAttempted.current = true
      setIsInitializing(true)

      try {
        await esbuild.initialize({
          wasmURL: 'https://unpkg.com/esbuild-wasm@0.25.9/esbuild.wasm',
        })
        esbuildService.current = esbuild
        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to initialize esbuild:', error)
        setIsInitialized(false)
        initializationAttempted.current = false // Allow retry on error
      } finally {
        setIsInitializing(false)
      }
    }

    initializeEsbuild()
  }, [])

  return {
    esbuildService: esbuildService.current,
    isInitialized,
    isInitializing,
  }
}
