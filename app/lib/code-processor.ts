import { BuildResult, Plugin } from 'esbuild-wasm'

import { type EsbuildService } from '~/hooks/use-esbuild'

import type { Program } from './animation'
import * as localUtils from './utils/patterns'

// Cache for fetched modules
const moduleCache = new Map<string, string>()

interface CodeProcessorOptions {
  esbuildService: EsbuildService
  timeout?: number
  target?: string
}

interface LoadProcessedModule {
  load(): Promise<ProcessedModule>
}

interface ProcessedModule {
  main?: Program['main']
  boot?: Program['boot']
  pre?: Program['pre']
  post?: Program['post']
}

interface ProcessingResult {
  success: boolean
  module?: LoadProcessedModule
  error?: string
  warnings?: string[]
}

function isUrl(path: string): boolean {
  return path.startsWith('https://') || path.startsWith('http://')
}

function resolveUnpkgUrl(packageName: string): string {
  return `https://unpkg.com/${packageName}?module`
}

function handlePluginError(path: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error('Plugin error for:', path, message)
  return {
    errors: [
      {
        text: `Failed to load module: ${message}`,
        location: null,
      },
    ],
  }
}

export async function processCodeModule(
  code: string,
  options: CodeProcessorOptions,
): Promise<ProcessingResult> {
  const { esbuildService, timeout = 5000 } = options

  try {
    if (!esbuildService) {
      throw new Error('esbuild service not provided')
    }

    const result: BuildResult = await esbuildService.build({
      entryPoints: ['input.ts'],
      bundle: true,
      minify: false,
      format: 'esm',
      platform: 'browser',
      write: false,
      treeShaking: false,
      plugins: [createLocalUtilsPlugin(), createModuleResolutionPlugin(code)],
      define: {
        global: 'globalThis',
        'process.env.NODE_ENV': '"production"',
      },
      external: [],
    })

    if (result.warnings.length > 0) {
      console.warn('esbuild warnings:', result.warnings)
    }

    if (!result.outputFiles || result.outputFiles.length === 0) {
      throw new Error('No output files generated')
    }

    const transformedCode = result.outputFiles[0].text
    const moduleExports = await executeCodeSafely(transformedCode, timeout)

    return {
      success: true,
      module: {
        async load() {
          return moduleExports
        },
      },
      warnings: result.warnings.map((w) => w.text),
    }
  } catch (error) {
    console.error('Error processing code module:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

async function executeCodeSafely(code: string, timeout: number): Promise<ProcessedModule> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Code execution timed out after ${timeout}ms`))
    }, timeout)

    try {
      const blob = new Blob([code], { type: 'application/javascript' })
      const moduleUrl = URL.createObjectURL(blob)

      import(moduleUrl)
        .then((module) => {
          URL.revokeObjectURL(moduleUrl)
          clearTimeout(timeoutId)
          resolve({
            main: module.main,
            boot: module.boot,
            pre: module.pre,
            post: module.post,
          })
        })
        .catch((error) => {
          URL.revokeObjectURL(moduleUrl)
          clearTimeout(timeoutId)
          reject(error)
        })
    } catch (error) {
      clearTimeout(timeoutId)
      reject(error)
    }
  })
}

function createLocalUtilsPlugin(): Plugin {
  return {
    name: 'local-utils-plugin',
    setup(build) {
      // Resolve local utils imports
      build.onResolve({ filter: /^@\/utils$/ }, () => ({
        path: 'local-utils',
        namespace: 'local',
      }))

      // Load local utils
      build.onLoad({ filter: /^local-utils$/, namespace: 'local' }, () => {
        const utilsExports = Object.entries(localUtils)
          .filter(([, value]) => typeof value === 'function')
          .map(([key, fn]) => `export const ${key} = ${fn.toString()};`)
          .join('\n')

        return {
          loader: 'ts',
          contents: `// Pattern generation utilities\n${utilsExports}`,
        }
      })
    },
  }
}

function createModuleResolutionPlugin(userCode: string): Plugin {
  return {
    name: 'module-resolution-plugin',
    setup(build) {
      // Handle entry point
      build.onResolve({ filter: /^input\.ts$/ }, () => ({
        path: 'input.ts',
        namespace: 'app',
      }))

      // Handle relative imports
      build.onResolve({ filter: /^\.+\// }, (args) => ({
        path: new URL(args.path, 'https://unpkg.com' + args.resolveDir + '/').href,
        namespace: 'app',
      }))

      // Handle npm packages and URLs
      build.onResolve({ filter: /.*/ }, (args) => {
        if (isUrl(args.path)) {
          return { path: args.path, namespace: 'app' }
        }

        const resolvedPath = resolveUnpkgUrl(args.path)
        console.log('Resolved:', resolvedPath)
        return { path: resolvedPath, namespace: 'app' }
      })

      // Load entry point with user code
      build.onLoad({ filter: /^input\.ts$/, namespace: 'app' }, () => ({
        loader: 'ts',
        contents: `
${userCode}

// Export functions if they exist
const _main = typeof main !== 'undefined' ? main : undefined;
const _boot = typeof boot !== 'undefined' ? boot : undefined;
const _pre = typeof pre !== 'undefined' ? pre : undefined;
const _post = typeof post !== 'undefined' ? post : undefined;

export { _main as main, _boot as boot, _pre as pre, _post as post };
        `,
      }))

      // Load external modules
      build.onLoad({ filter: /.*/, namespace: 'app' }, async (args) => {
        // Check cache first
        const cachedContent = moduleCache.get(args.path)
        if (cachedContent) {
          return {
            loader: 'ts',
            contents: cachedContent,
            resolveDir: new URL('./', args.path).pathname,
          }
        }

        // Fetch and cache
        try {
          const response = await fetch(args.path)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const contents = await response.text()
          moduleCache.set(args.path, contents)

          return {
            loader: 'ts',
            contents,
            resolveDir: new URL('./', response.url).pathname,
          }
        } catch (error) {
          return handlePluginError(args.path, error)
        }
      })
    },
  }
}
