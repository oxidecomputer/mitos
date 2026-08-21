# Mitos scripting reference

Mitos scripts are small JavaScript/TypeScript programs that render ASCII art. The runtime
(based on [play.core](https://play.ertdfgcvb.xyz/)) calls your functions for every cell of a
character grid, every frame — like a fragment shader, but each "pixel" is a character.

## Program model

Define any of these top-level functions (no exports needed — the compiler picks them up):

```js
function boot(context, buffer, userData) {} // once, before the first frame
function pre(context, cursor, buffer, userData) {} // every frame, before main
function main(pos, context, cursor, buffer, userData) {} // every frame, once per cell
function post(context, cursor, buffer, userData) {} // every frame, after main
```

Most scripts only need `main`. It must return one of:

- a string — the character to draw (e.g. `'#'`)
- a cell object — `{ char: '#', color: '#ff6b6b' }` (color is any CSS color, or an Oxide
  design-system variable like `'--color-green-800'` / `'var(--color-green-800)'`, resolved
  to its concrete value at render time)
- `undefined`/empty — leaves the cell blank

### Arguments

- `pos` — `{ x, y, index }`: integer cell coordinates. `x` in `[0, cols)`, `y` in
  `[0, rows)`, `index = y * cols + x`.
- `context` — frozen per-frame info:
  - `frame`: frame counter (starts at 0, wraps at the animation length)
  - `time`: elapsed wall-clock ms — prefer `frame` (see gotchas)
  - `cols`, `rows`: grid size
  - `metrics.aspect`: cell width / line height (≈0.5 — cells are ~twice as tall as wide)
- `cursor` — pointer state in cell coordinates: `{ x, y, pressed, p: { x, y, pressed } }`
  (`p` is the previous frame's state)
- `buffer` — the flat `Cell[]` being drawn; `pre`/`post` can read or overwrite any cell
- `userData` — a mutable object shared across all calls; stash state here from `boot`

## Available imports

Only these modules resolve — they are virtual, provided by the app:

```js
import { frames, imageData } from '@/imageData'
import { backgroundColor, characterSet, settings, textColor } from '@/settings'
import { checkerboard, getImageValue, stripes, valueToChar } from '@/utils'
```

- `valueToChar(value, chars?)` — maps a 0–1 value to a character from a ramp (defaults to
  the app's character set, dark → light)
- `getImageValue(data, x, y)` — bounds-checked read from 2D image data (0–1 values)
- `checkerboard(x, y, size?)`, `stripes(x, y, width?, direction?)` — pattern helpers
  returning 0/1
- `imageData` — the loaded image as `number[][]` (0–1 brightness), `null`-ish if no image
- `frames` — array of `imageData`-like frames for GIFs, `null` for static sources
- `characterSet` — the user's chosen ramp string (dark → light), e.g. `'@%#*+=-:. '`
- `textColor` / `backgroundColor` — the export colors, for building palettes (CSS variables
  are already resolved to concrete values)
- `settings` — the full app settings object (source data stripped)

Bare npm imports also work — they are fetched from unpkg at compile time, e.g.
`import { createNoise2D } from 'simplex-noise'`. Stick to small, dependency-free packages.

## Interactive controls (`//~` annotations)

A `//~` comment after a `const` turns it into a UI control in the sidebar. Use these for any
parameter worth tweaking — it makes the script far more useful:

```js
const speed = 1 //~ number 0-3 step=0.1
const radius = 0.5 //~ number 0.1-1 step=0.05
const invert = false //~ boolean
const label = 'oxide' //~ text

// Object properties work too, and group in the UI under the object name:
const wave = {
  amplitude: 5, //~ number 1-20
  frequency: 0.2, //~ number 0.05-1 step=0.05
}
```

Formats: `//~ number <min>-<max> step=<step>`, `//~ boolean`, `//~ text`.

## Gotchas

- **Cells are not square.** A circle drawn in raw cell coordinates renders as a tall
  ellipse. Normalize with the aspect ratio, e.g.:

  ```js
  const ux = ((pos.x / context.cols - 0.5) * 2 * context.cols) / context.rows
  const uy = (pos.y / context.rows - 0.5) * 2
  ```

  (`cols / rows` works because the default grid compensates for cell aspect; for exact
  correction use `context.metrics.aspect`.)

- **Animate with `context.frame`, not `context.time`.** `frame` is deterministic — the same
  frame always renders the same output, which makes GIF exports and frame inspection
  reproducible. `time` is wall-clock and drifts.

- **Loop cleanly.** The frame counter wraps at the animation length (settings → animation,
  default 100 frames). For a seamless loop, make your motion periodic in it, e.g.
  `const t = (context.frame / 100) * Math.PI * 2`.

- **Blank vs space.** Returning `' '` draws a space (opaque); returning nothing leaves the
  cell untouched — relevant only when `pre`/`post` also write to the buffer.

- **Keep `main` cheap.** It runs `cols × rows` times per frame (a 100×50 grid at 30fps is
  150k calls/s). Hoist anything frame-constant into `pre` (stash it in `userData` or a
  module-level variable).

## Minimal examples

A pulsing circle, aspect-corrected, looping over 100 frames:

```js
const chars = ' .:-=+*#%@'

function main(pos, context) {
  const ux = ((pos.x / context.cols - 0.5) * 2 * context.cols) / context.rows
  const uy = (pos.y / context.rows - 0.5) * 2
  const t = (context.frame / 100) * Math.PI * 2
  const radius = 0.6 + 0.2 * Math.sin(t)
  const d = Math.sqrt(ux * ux + uy * uy)
  const v = Math.max(0, 1 - d / radius)
  return chars[Math.floor(v * (chars.length - 1))]
}
```

Rendering a loaded image or GIF through the user's character set:

```js
import { frames, imageData } from '@/imageData'
import { characterSet } from '@/settings'
import { getImageValue, valueToChar } from '@/utils'

function main(pos, context) {
  const data =
    frames && frames.length > 0 ? frames[context.frame % frames.length] : imageData
  const value = getImageValue(data, pos.x, pos.y)
  return { char: valueToChar(value, characterSet) }
}
```

For richer idioms — noise fields, palettes, metaballs, warp effects — read the built-in
templates in `app/scripts/` (or fetch them with the `get_template_code` MCP tool).

## Iterating via MCP

When driving Mitos through its MCP server: `set_code` compiles, runs, and returns the
rendered frame, so check its output instead of assuming success. Inspect motion by calling
`get_frame` with several frame numbers (e.g. 0, 25, 50, 75). Compile errors come back in the
response; fix and re-run.
