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
