# Oxide ASCII Generator Development Guide

## Build Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production (runs TypeScript check)
- `npm run preview` - Preview production build
- `npm run tsc` - Run TypeScript type checking
- `npm run lint` - Run ESLint checks
- `npm run fmt` - Format code with Prettier and fix ESLint issues

## Code Style Guidelines
- **Imports**: Sorted using `@ianvs/prettier-plugin-sort-imports` (third-party → ~/... → relative)
- **Formatting**: Semi: false, SingleQuote: true, TrailingComma: all, PrintWidth: 92
- **TypeScript**: Strict mode enabled; avoid unused locals/parameters/imports
- **React**: Follow React hooks rules (dependencies, call only at top level)
- **Error Handling**: Use try/catch with toast notifications for user feedback
- **Components**: Use function components with explicit type definitions
- **Path Aliases**: Import app files using `~/` alias (e.g., `~/components/ui/button`)
- **Naming**: PascalCase for components, camelCase for functions/variables

Always use strict equality (`===`), avoid parameter reassignment, and properly type all functions.

Avoid altering the `animation.ts`, `text-renderer.ts`, `color.ts` and `fps.ts` files. These should be treated like an external dependency and not modified.
