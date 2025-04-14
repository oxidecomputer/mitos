# Mitos

Mitos is an ASCII art generator built by Oxide Computer Company. It converts images, GIFs,
into ASCII text illustrations, with a live-code option. It's used for producting branded
ASCII graphics.

![GncCsR9XIAAO2AA](https://github.com/user-attachments/assets/01e12760-f527-427e-8e13-7eb019a8cc4a)

Live version: [https://mitos.shared.oxide.computer/](https://mitos.shared.oxide.computer/)

## Features

- Generate ASCII art from multiple sources:
  - Images
  - GIFs
  - Custom JavaScript code
- Preprocessing controls (brightness, contrast, dithering, inversion)
- Customizable ASCII character sets
- Real-time preview with zoom and pan
- Animation support with playback controls
- Multiple export options
- Grid overlay

## Technology

Mitos is built with:

- React
- TypeScript
- Vite
- TailwindCSS
- CodeMirror (for the code editor)
- gifuct-js (GIF processing)

The project builds on [play.core](https://play.ertdfgcvb.xyz/) by Andreas Gysin (ertdfgcvb),
an ASCII rendering library with an API inspired by GLSL programming. Whilst it might be more
efficient to process and render the text directly to the DOM, sidestepping the need for a
library— the library enables consistent rendering and easier packaging of self-contained
ASCII art components.

## Getting Started

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/oxidecomputer/mitos.git
   cd mitos
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Start the development server:
   ```bash
   bun run dev
   ```

## Contributing

In its present state, Mitos is an internal tool for Oxide Computer Company and is tightly
coupled to Oxide's design system. While we're open to PRs, we are a small company and the
primary goal of this repo is as an internal tool, so we can't guarantee that all PRs will be
integrated.

## Credits

- Developed by [Oxide Computer Company](https://oxide.computer/)
- Based on [play.core](https://play.ertdfgcvb.xyz/) by Andreas Gysin (ertdfgcvb)
- Mozilla Public License, v. 2.0
