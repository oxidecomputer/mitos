# Agent Guidelines for Mitos

## Commands

- **Build**: `bun run build` (tsc + vite)
- **Lint**: `bun run lint` (eslint app)
- **Format**: `bun run fmt` (write) or `bun run fmt:check` (check)
- **Test**: `bun test` (unit, in `tests/`) or `bun test <file>` (single test)
- **E2E**: `bun run test:e2e` (Playwright render snapshots in `e2e/`; needs
  `bunx playwright install chromium` once). Regenerate baselines per-platform with
  `bun run test:e2e:update`.
- **Dev**: `bun run dev`
- **CI**: `bun run ci` (runs fmt:check, tsc, lint, test)

## MCP Server

The repo ships an MCP server (`mcp/server.ts`, registered via `.mcp.json`) that lets agents
drive the running app: read/write the code editor, patch settings, load templates, and read
rendered frames back as plain text. It requires a Mitos tab connected to the bridge — run
`bun run dev` and open the app (the bridge connects automatically in dev builds, or add
`?mcp` to the URL). Prefer `set_code` + `get_frame` over guessing: the returned ASCII text
shows exactly what the canvas renders, and responses include the last compile error.

When writing scripts, read `docs/scripting.md` (also served by the `get_docs` tool) for the
script API, imports, and `//~` control syntax; fetch working examples with
`get_template_code`.

## Code Style

- **Formatting**: Prettier with 92 char width, no semicolons, single quotes, trailing commas
- **Imports**: Sort order: third-party → `~/*` (app alias) → relative. Use `~/` for app/
  imports.
- **TypeScript**: Strict mode enabled. Prefix unused vars/params with `_`. Use explicit
  types.
- **Naming**: camelCase for vars/functions, PascalCase for components/types
- **ESLint rules**: Use `===`, no param reassignment, no return assignment
- **Error handling**: Use toast (sonner) for user-facing errors
- **License**: Add MPL 2.0 header to all new source files
- **Tests**: Use Bun test with describe/test/expect. See tests/ for examples.
