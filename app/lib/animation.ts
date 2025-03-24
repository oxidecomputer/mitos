import FPS, { type FPSType } from './core/fps'
import createRenderer from './core/text-renderer'

// Default settings for the program runner.
// They can be overwritten by the parameters of the runner
// or as a settings object exported by the program (in this order).
const defaultSettings: Settings = {
  element: null,
  cols: 0,
  rows: 0,
  once: true,
  reducedMotion: false,
  fps: 30,
  allowSelect: false,
  restoreState: false,
}

export interface Settings {
  element: HTMLElement | null
  cols: number
  rows: number
  once: boolean
  reducedMotion: boolean
  fps: number
  allowSelect: boolean
  restoreState: boolean
  renderer?: string
  color?: string
  backgroundColor?: string
  fontWeight?: string
  onFrameUpdate?: (frame: number) => void
  maxFrames?: number
}

interface State {
  time: number
  frame: number
  cycle: number
}

interface Pointer {
  x: number
  y: number
  pressed: boolean
  px: number
  py: number
  ppressed: boolean
}

interface Cursor {
  x: number
  y: number
  pressed: boolean
  p: {
    x: number
    y: number
    pressed: boolean
  }
}

export interface Cell {
  char: string
  color?: string
  backgroundColor?: string
  fontWeight?: string
}

export interface Coord {
  x: number
  y: number
}

export interface Data {
  [x: number]: {
    [y: number]: Cell
  }
}

interface Metrics {
  aspect: number
  cellWidth: number
  lineHeight: number
  fontFamily: string
  fontSize: number
}

export interface Context {
  frame: number
  time: number
  cols: number
  rows: number
  metrics: Metrics
  width: number
  height: number
  settings: Settings
  runtime: {
    cycle: number
    fps: number
  }
}

export interface Program {
  settings?: Partial<Settings>
  boot?: (context: Context, buffer: Cell[], userData: any) => void
  pre?: (context: Context, cursor: Cursor, buffer: Cell[], userData: any) => void
  main?: (
    pos: { x: number; y: number; index: number },
    context: Context,
    cursor: Cursor,
    buffer: Cell[],
    userData: any,
  ) => Cell | string
  post?: (context: Context, cursor: Cursor, buffer: Cell[], userData: any) => void
  [key: string]: any // For event handlers
}

// Program runner.
// Takes a program object (usually an imported module),
// and some optional settings (see above) as arguments.
// Finally, an optional userData object can be passed which will be available
// as last parameter in all the module functions.
// The program object should export at least a main(), pre() or post() function.
export function createAnimation(
  program: Program,
  runSettings: Partial<Settings>,
  userData = {},
) {
  if (!runSettings.element) {
    throw new Error('Element is required')
  }

  const settings: Settings = { ...defaultSettings, ...runSettings, ...program.settings }
  const state: State = {
    time: 0,
    frame: 0,
    cycle: 0,
  }

  const userDataRef = userData
  let buffer: Cell[] = []
  let metrics: Metrics | null = null
  const eventQueue: string[] = []
  let cols = 0
  let rows = 0
  let timeSample = 0
  let interval = 0
  let timeOffset = 0
  let stopped = false
  let pointer: Pointer
  const renderer = createRenderer()
  const fps: FPSType = new FPS()
  let EMPTY_CELL: string
  let DEFAULT_CELL_STYLE: Readonly<Partial<Cell>>

  createPointer()
  prepareFonts()
  createCellBuffer()
  initTime()

  function createPointer() {
    pointer = {
      x: 0,
      y: 0,
      pressed: false,
      px: 0,
      py: 0,
      ppressed: false,
    }

    const element = settings.element

    if (!element) return

    element.addEventListener('pointermove', (e) => {
      const rect = element.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
      eventQueue.push('pointerMove')
    })

    element.addEventListener('pointerdown', () => {
      pointer.pressed = true
      eventQueue.push('pointerDown')
    })

    element.addEventListener('pointerup', () => {
      pointer.pressed = false
      eventQueue.push('pointerUp')
    })
  }

  function prepareFonts() {
    // Metrics needs to be calculated before boot
    // Even with the "fonts.ready" the font may STILL not be loaded yet
    // on Safari 13.x and also 14.0.
    // A (shitty) workaround is to wait 3! rAF.
    // Submitted: https://bugs.webkit.org/show_bug.cgi?id=217047
    document.fonts.ready.then(() => {
      let count = 3
      const __run_thrice__ = () => {
        if (--count > 0) {
          requestAnimationFrame(__run_thrice__)
        } else {
          boot()
        }
      }
      __run_thrice__()
    })

    invariant(!!settings.element, 'Element is required')
    settings.element.style.fontStretch = 'normal'
  }

  function createCellBuffer() {
    // A cell with no value at all is just a space
    EMPTY_CELL = ' '

    // Default cell style inserted in case of undefined / null
    DEFAULT_CELL_STYLE = Object.freeze({
      color: settings.color,
      backgroundColor: settings.backgroundColor,
      fontWeight: settings.fontWeight,
    })

    // Buffer needed for the final DOM rendering,
    // each array entry represents a cell.
    buffer = []
  }

  function boot() {
    invariant(!!settings.element, 'Element is required')
    metrics = calcMetrics(settings.element)
    const context = getContext(state, settings, metrics, fps)
    if (typeof program.boot === 'function') {
      program.boot(context, buffer, userDataRef)
    }
    requestAnimationFrame(loop)
  }

  function initTime() {
    // Time sample to calculate precise offset
    timeSample = 0
    interval = 1000 / settings.fps
    timeOffset = state.time
  }

  // Main program loop
  function loop(t: number) {
    if (stopped || !metrics) return

    // Timing
    const delta = t - timeSample
    if (delta < interval) {
      // Skip the frame
      if (!settings.once) requestAnimationFrame(loop)
      return
    }

    // Snapshot of context data
    const context = getContext(state, settings, metrics, fps)

    // FPS update
    fps.update(t)

    // Timing update
    timeSample = t - (delta % interval) // adjust timeSample
    state.time = t + timeOffset // increment time + initial offs
    if (!settings.maxFrames || state.frame < settings.maxFrames) {
      state.frame++ // increment frame counter
    } else {
      state.frame = 0
    }
    settings.onFrameUpdate && settings.onFrameUpdate(state.frame)

    // Cursor update
    const cursor = {
      x: pointer.x / metrics.cellWidth,
      y: pointer.y / metrics.lineHeight,
      pressed: pointer.pressed,
      p: {
        // state of previous frame
        x: pointer.px / metrics.cellWidth,
        y: pointer.py / metrics.lineHeight,
        pressed: pointer.ppressed,
      },
    }

    // Pointer: store previous state
    pointer.px = pointer.x
    pointer.py = pointer.y
    pointer.ppressed = pointer.pressed

    // 1. --------------------------------------------------------------
    // In case of resize / init normalize the buffer
    if (cols !== context.cols || rows !== context.rows) {
      cols = context.cols
      rows = context.rows

      // Add validation to ensure valid array length
      const newLength = context.cols * context.rows
      if (newLength > 0 && newLength < 10000000 && isFinite(newLength)) {
        // Set a reasonable upper limit
        buffer.length = newLength
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = { ...DEFAULT_CELL_STYLE, char: EMPTY_CELL }
        }
      } else {
        console.error(`Invalid buffer dimensions: ${context.cols} x ${context.rows}`)
        // Use a safe fallback
        cols = cols || 1
        rows = rows || 1
        const safeLength = cols * rows
        buffer.length = safeLength
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = { ...DEFAULT_CELL_STYLE, char: EMPTY_CELL }
        }
      }
    }

    // 2. --------------------------------------------------------------
    // Call pre(), if defined
    if (typeof program.pre === 'function') {
      program.pre(context, cursor, buffer, userDataRef)
    }

    // 3. --------------------------------------------------------------
    // Call main(), if defined
    if (typeof program.main === 'function') {
      for (let j = 0; j < context.rows; j++) {
        const offs = j * context.cols
        for (let i = 0; i < context.cols; i++) {
          const idx = i + offs
          const out = program.main(
            { x: i, y: j, index: idx },
            context,
            cursor,
            buffer,
            userDataRef,
          )
          if (typeof out === 'object' && out !== null) {
            buffer[idx] = { ...buffer[idx], ...out }
          } else {
            buffer[idx] = { ...buffer[idx], char: out }
          }
          // Fix undefined / null / etc.
          if (!buffer[idx].char) {
            buffer[idx].char = EMPTY_CELL
          }
        }
      }
    }

    // 4. --------------------------------------------------------------
    // Call post(), if defined
    if (typeof program.post === 'function') {
      program.post(context, cursor, buffer, userDataRef)
    }

    // 5. --------------------------------------------------------------
    renderer.render(context, buffer)

    // 6. --------------------------------------------------------------
    // Queued events
    while (eventQueue.length > 0) {
      const type = eventQueue.shift()
      if (type && typeof program[type] === 'function') {
        program[type](context, cursor, buffer)
      }
    }

    // 7. --------------------------------------------------------------
    // Loop (eventually)
    if (!settings.once) requestAnimationFrame(loop)
  }

  function togglePlay(isPlaying: boolean) {
    if (stopped) return

    if (!isPlaying) {
      settings.once = true
    } else {
      settings.once = false
      requestAnimationFrame(loop)
    }
  }

  function setFrame(frame: number) {
    state.frame = frame
    requestAnimationFrame(loop)
  }

  function cleanup() {
    stopped = true
  }

  function updateSettings(newSettings: Partial<Settings>) {
    Object.assign(settings, newSettings)
  }

  function getState() {
    return { ...state, ...settings }
  }

  return {
    togglePlay,
    cleanup,
    setFrame,
    updateSettings,
    getState,
  }
}

// -- Helpers ------------------------------------------------------------------

// Build / update the 'context' object (immutable)
// A bit of spaghetti... but the context object needs to be ready for
// the boot function and also to be updated at each frame.
function getContext(state: State, settings: Settings, metrics: Metrics, fps: any): Context {
  invariant(!!settings.element, 'Element is required')
  const rect = settings.element.getBoundingClientRect()
  const cols = settings.cols || Math.floor(rect.width / metrics.cellWidth)
  const rows = settings.rows || Math.floor(rect.height / metrics.lineHeight)
  return Object.freeze({
    frame: state.frame,
    time: state.time,
    cols,
    rows,
    metrics,
    width: rect.width,
    height: rect.height,
    settings,
    // Runtime & debug data
    runtime: Object.freeze({
      cycle: state.cycle,
      fps: fps.fps,
    }),
  })
}

// Calcs width (fract), height, aspect of a monospaced char
// assuming that the CSS font-family is a monospaced font.
// Returns a mutable object.
export function calcMetrics(el: HTMLElement): Metrics {
  const style = getComputedStyle(el)

  // Extract info from the style
  const fontFamily = style.getPropertyValue('font-family')
  const lineHeightStyle = style.getPropertyValue('line-height')
  const fontSize = Number.parseFloat(style.getPropertyValue('font-size'))
  let cellWidth, cellHeight

  // cellWidth is computed
  const span = document.createElement('span')
  el.appendChild(span)
  span.innerHTML = ''.padEnd(50, 'X')
  cellWidth = span.getBoundingClientRect().width / 50
  cellHeight = span.getBoundingClientRect().height
  el.removeChild(span)

  const metrics = {
    aspect: cellWidth / cellHeight,
    cellWidth,
    lineHeight:
      lineHeightStyle === 'normal' ? fontSize * 1.2 : Number.parseFloat(lineHeightStyle),
    fontFamily,
    fontSize,
  }

  return metrics
}

export function invariant(cond: any, msg: string): asserts cond {
  if (!cond) {
    throw Error(msg)
  }
}
