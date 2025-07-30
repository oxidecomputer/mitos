import { BuildResult, Plugin } from 'esbuild-wasm'

import { type EsbuildService } from '~/hooks/use-esbuild'

import type { Program } from './animation'

// Cache for fetched modules
const moduleCache = new Map<string, string>()

interface CodeProcessorOptions {
  esbuildService: EsbuildService
  timeout?: number
  target?: string
  allowUnpkgImports?: boolean
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

export async function processCodeModule(
  code: string,
  options: CodeProcessorOptions,
): Promise<ProcessingResult> {
  const { esbuildService, timeout = 5000 } = options

  try {
    if (!esbuildService) {
      throw new Error('esbuild service not provided')
    }

    // Use build API for bundling with plugins
    const result: BuildResult = await esbuildService.build({
      entryPoints: ['input.ts'],
      bundle: true,
      minify: false,
      format: 'esm',
      platform: 'browser',
      write: false,
      treeShaking: false,
      plugins: [createUnpkgPathPlugin(), createUnpkgFetchPlugin(code)],
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

    // Create a safe execution environment
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
      // Execute the ESM code using dynamic import
      const blob = new Blob([code], { type: 'application/javascript' })
      const moduleUrl = URL.createObjectURL(blob)

      import(moduleUrl)
        .then((module) => {
          URL.revokeObjectURL(moduleUrl)

          const result = {
            main: module.main,
            boot: module.boot,
            pre: module.pre,
            post: module.post,
          }

          clearTimeout(timeoutId)
          resolve(result)
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

function createUnpkgPathPlugin(): Plugin {
  return {
    name: 'unpkg-path-plugin',
    setup(build) {
      // Handle root entry file
      build.onResolve({ filter: /(^input\.ts$)/ }, () => {
        return { path: 'input.ts', namespace: 'app' }
      })

      // Handle relative imports inside a module
      build.onResolve({ filter: /^\.+\// }, (args) => {
        return {
          path: new URL(args.path, 'https://unpkg.com' + args.resolveDir + '/').href,
          namespace: 'app',
        }
      })

      // Handle main file of a module
      build.onResolve({ filter: /.*/ }, async (args) => {
        const isUrl = args.path.startsWith('https://') || args.path.startsWith('http://')

        if (isUrl) {
          return {
            path: args.path,
            namespace: 'app',
          }
        }

        // Use ESM version from unpkg
        const resolvedPath = `https://unpkg.com/${args.path}?module`
        console.log('Resolved:', resolvedPath)
        return {
          path: resolvedPath,
          namespace: 'app',
        }
      })
    },
  }
}

function createUnpkgFetchPlugin(input: string): Plugin {
  return {
    name: 'unpkg-fetch-plugin',
    setup(build) {
      // Handle root user input code
      build.onLoad({ filter: /^input\.ts$/ }, () => {
        const wrappedInput = `
${input}

// Export functions if they exist
const _main = typeof main !== 'undefined' ? main : undefined;
const _boot = typeof boot !== 'undefined' ? boot : undefined;
const _pre = typeof pre !== 'undefined' ? pre : undefined;
const _post = typeof post !== 'undefined' ? post : undefined;

export { _main as main, _boot as boot, _pre as pre, _post as post };
        `
        return {
          loader: 'tsx',
          contents: wrappedInput,
        }
      })

      // Handle JS/TS files
      build.onLoad({ filter: /.*/ }, async (args) => {
        // Check if we have this path cached
        if (moduleCache.has(args.path)) {
          const cachedContents = moduleCache.get(args.path)!

          // Determine loader
          let loader: 'js' | 'ts' | 'tsx' | 'jsx' | 'text' = 'js'
          if (args.path.includes('.ts') && !args.path.includes('unpkg.com')) {
            loader = 'ts'
          } else if (args.path.includes('.tsx')) {
            loader = 'tsx'
          } else if (args.path.includes('.jsx')) {
            loader = 'jsx'
          }

          const resolveDir = new URL('./', args.path).pathname

          return {
            loader,
            contents: cachedContents,
            resolveDir,
          }
        }

        try {
          const response = await fetch(args.path)
          if (!response.ok) {
            throw new Error(`Failed to fetch ${args.path}: ${response.statusText}`)
          }

          const contents = await response.text()

          // Cache the content using path as key
          moduleCache.set(args.path, contents)

          // Determine loader
          let loader: 'js' | 'ts' | 'tsx' | 'jsx' | 'text' = 'js'
          if (args.path.includes('.ts') && !args.path.includes('unpkg.com')) {
            loader = 'ts'
          } else if (args.path.includes('.tsx')) {
            loader = 'tsx'
          } else if (args.path.includes('.jsx')) {
            loader = 'jsx'
          }

          const resolveDir = new URL('./', response.url).pathname

          return {
            loader,
            contents,
            resolveDir,
          }
        } catch (error) {
          console.error('Failed to load:', args.path, error)
          return {
            errors: [
              {
                text: `Failed to load module: ${error instanceof Error ? error.message : 'Unknown error'}`,
                location: null,
              },
            ],
          }
        }
      })
    },
  }
}
