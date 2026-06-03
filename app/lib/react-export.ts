/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */
import type { BuildResult, Plugin } from 'esbuild-wasm'

// The runtime is pulled in as source (Vite `?raw`) and handed to esbuild-wasm so
// the generated component bundles the *program*, not pre-rendered frames. Keeping
// these as raw imports means the export always tracks the real runtime files.
import animationSource from '~/lib/animation.ts?raw'
import fpsSource from '~/lib/core/fps.ts?raw'
import textRendererSource from '~/lib/core/text-renderer.ts?raw'
import * as localUtils from '~/lib/localUtils'

import { CHAR_WIDTH } from '~/components/dimension-utils'
import type { EsbuildService } from '~/hooks/use-esbuild'

/** Matches the canvas/SVG export + preview. */
const ASCII_FONT_SIZE_PX = 12
const ASCII_LINE_HEIGHT_RATIO = 1.2

export interface ReactExportVisualSettings {
  textColor: string
  backgroundColor: string
  /** Cell padding (same units as Mitos export options). */
  padding: number
}

export interface GenerateReactComponentSourceParams {
  esbuildService: EsbuildService
  /** The user's program source (settings.source.code). */
  code: string
  /** Character set exposed to the program via `@/settings`. */
  characterSet: string
  columns: number
  rows: number
  /** Number of frames the animation loops over; <= 1 renders a single frame. */
  animationLength: number
  fps: number
  settings: ReactExportVisualSettings
  /** PascalCase component name; invalid values fall back to AsciiArtEmbed. */
  componentName?: string
}

function sanitizeComponentName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_]/g, '')
  if (!cleaned || /^[0-9]/.test(cleaned)) {
    return 'AsciiArtEmbed'
  }
  return cleaned
}

function isUrl(path: string): boolean {
  return path.startsWith('https://') || path.startsWith('http://')
}

// Virtual source files the runtime bundle is assembled from. The keys are the
// canonical module names the resolver maps every import specifier onto.
function buildVirtualModules(params: {
  code: string
  characterSet: string
  textColor: string
  backgroundColor: string
}): Record<string, string> {
  // Reuse the in-app convention: stringify each util fn so the bundle behaves
  // exactly like the live preview's `@/utils`.
  const utilsExports = Object.entries(localUtils)
    .filter(([, value]) => typeof value === 'function')
    .map(([key, fn]) => `export const ${key} = ${(fn as () => unknown).toString()};`)
    .join('\n')

  const program = `${params.code}

const _main = typeof main !== 'undefined' ? main : undefined;
const _boot = typeof boot !== 'undefined' ? boot : undefined;
const _pre = typeof pre !== 'undefined' ? pre : undefined;
const _post = typeof post !== 'undefined' ? post : undefined;
export { _main as main, _boot as boot, _pre as pre, _post as post };`

  const entry = `import { createAnimation } from 'mitos:animation'
import * as program from 'mitos:program'

export function mount(element, options) {
  return createAnimation(program, { element, ...options })
}`

  return {
    'mitos:entry': entry,
    'mitos:animation': animationSource,
    // animation.ts renders through ./core/canvas-renderer; swap in the DOM/text
    // renderer so the exported component draws into a <pre> instead of a canvas.
    'mitos:renderer': textRendererSource,
    'mitos:fps': fpsSource,
    'mitos:program': program,
    'mitos:utils': `// Pattern generation utilities\n${utilsExports}`,
    'mitos:settings': `export const characterSet = ${JSON.stringify(params.characterSet)};
export const textColor = ${JSON.stringify(params.textColor)};
export const backgroundColor = ${JSON.stringify(params.backgroundColor)};
export const settings = {};`,
    'mitos:imageData': `export const imageData = {};\nexport const frames = null;`,
  }
}

// Maps every import specifier seen during the build onto one of the virtual
// module names above, or returns null for things that should come from unpkg.
function resolveVirtualName(specifier: string): string | null {
  if (specifier === 'mitos:entry') return 'mitos:entry'
  if (specifier === 'mitos:program') return 'mitos:program'
  if (specifier === 'mitos:animation' || /(^|\/)animation(\.ts)?$/.test(specifier))
    return 'mitos:animation'
  if (/canvas-renderer(\.ts)?$/.test(specifier)) return 'mitos:renderer'
  if (/(^|\/)fps(\.ts)?$/.test(specifier)) return 'mitos:fps'
  if (specifier === '@/utils') return 'mitos:utils'
  if (specifier === '@/settings') return 'mitos:settings'
  if (specifier === '@/imageData') return 'mitos:imageData'
  return null
}

function createBundlePlugin(modules: Record<string, string>): Plugin {
  const moduleCache = new Map<string, string>()

  return {
    name: 'mitos-react-export',
    setup(build) {
      // Internal virtual modules (runtime, program, injected globals).
      build.onResolve({ filter: /.*/ }, (args) => {
        const name = resolveVirtualName(args.path)
        if (name) return { path: name, namespace: 'mitos' }

        // Everything else is an npm/url import: resolve through unpkg and fetch.
        if (isUrl(args.path)) return { path: args.path, namespace: 'http' }
        return { path: `https://unpkg.com/${args.path}?module`, namespace: 'http' }
      })

      build.onLoad({ filter: /.*/, namespace: 'mitos' }, (args) => ({
        loader: 'ts',
        contents: modules[args.path] ?? '',
      }))

      // Resolve relative imports inside fetched packages against their URL.
      build.onResolve({ filter: /.*/, namespace: 'http' }, (args) => {
        if (isUrl(args.path)) return { path: args.path, namespace: 'http' }
        return {
          path: new URL(args.path, 'https://unpkg.com' + args.resolveDir + '/').href,
          namespace: 'http',
        }
      })

      build.onLoad({ filter: /.*/, namespace: 'http' }, async (args) => {
        const cached = moduleCache.get(args.path)
        if (cached) {
          return {
            loader: 'ts',
            contents: cached,
            resolveDir: new URL('./', args.path).pathname,
          }
        }
        const response = await fetch(args.path)
        if (!response.ok) {
          throw new Error(`Failed to load ${args.path}: HTTP ${response.status}`)
        }
        const contents = await response.text()
        moduleCache.set(args.path, contents)
        return {
          loader: 'ts',
          contents,
          resolveDir: new URL('./', response.url).pathname,
        }
      })
    },
  }
}

async function bundleRuntime(
  esbuildService: EsbuildService,
  modules: Record<string, string>,
): Promise<string> {
  const result: BuildResult = await esbuildService.build({
    entryPoints: ['mitos:entry'],
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: '__mitosRuntime',
    platform: 'browser',
    target: 'es2020',
    write: false,
    treeShaking: true,
    plugins: [createBundlePlugin(modules)],
    define: {
      global: 'globalThis',
      'process.env.NODE_ENV': '"production"',
    },
  })

  if (!result.outputFiles || result.outputFiles.length === 0) {
    throw new Error('esbuild produced no output')
  }
  return result.outputFiles[0].text.trim()
}

/**
 * Produce a self-contained .tsx source string that runs the user's program live
 * (via the bundled Mitos runtime + text renderer) inside a <pre>. The runtime is
 * a small fixed cost; nothing is fetched at runtime and no frames are baked.
 */
export async function generateReactComponentSource(
  params: GenerateReactComponentSourceParams,
): Promise<string> {
  const componentName = sanitizeComponentName(params.componentName ?? 'AsciiArtEmbed')
  const animated = params.animationLength > 1

  const runtimeBundle = await bundleRuntime(
    params.esbuildService,
    buildVirtualModules({
      code: params.code,
      characterSet: params.characterSet,
      textColor: params.settings.textColor,
      backgroundColor: params.settings.backgroundColor,
    }),
  )

  const paddingPx = params.settings.padding * CHAR_WIDTH
  const lineHeightPx = ASCII_FONT_SIZE_PX * ASCII_LINE_HEIGHT_RATIO

  const style = [
    '{',
    `    margin: 0,`,
    `    color: ${JSON.stringify(params.settings.textColor)},`,
    `    backgroundColor: ${JSON.stringify(params.settings.backgroundColor)},`,
    `    padding: ${paddingPx},`,
    `    fontFamily: ${JSON.stringify('GT America Mono, ui-monospace, monospace')},`,
    `    fontSize: ${ASCII_FONT_SIZE_PX},`,
    `    lineHeight: '${lineHeightPx}px',`,
    `    whiteSpace: 'pre' as const,`,
    `  }`,
  ].join('\n')

  return `/*
 * Generated by Mitos (https://github.com/oxidecomputer/mitos).
 * Self-contained: the ASCII program and its runtime are bundled below — nothing
 * is fetched at runtime. Requires React 18+ and "jsx": "react-jsx".
 * GT America Mono may need a separate font license; ui-monospace/monospace are fallbacks.
 */
/* eslint-disable */
// @ts-nocheck
// prettier-ignore
import { useEffect, useRef } from 'react'

// --- Mitos runtime + program (generated, do not edit) ----------------------
${runtimeBundle}
// ---------------------------------------------------------------------------

const COLS = ${params.columns}
const ROWS = ${params.rows}
const FPS = ${Math.round(params.fps)}
const FRAMES = ${animated ? params.animationLength : 1}

export interface ${componentName}Props {
  className?: string
}

export function ${componentName}({ className }: ${componentName}Props) {
  const ref = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const controller = __mitosRuntime.mount(element, {
      cols: COLS,
      rows: ROWS,
      fps: FPS,
      maxFrames: FRAMES,
    })

    ${animated ? 'controller.togglePlay(true)' : 'controller.setFrame(0)'}
    return () => controller.cleanup()
  }, [])

  return (
    <pre
      ref={ref}
      className={className}
      aria-hidden
      style={${style}}
    />
  )
}

export default ${componentName}
`
}
