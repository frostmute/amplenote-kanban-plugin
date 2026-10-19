# Amplenote Embed Starter — Claude Code Configuration

## Project Overview

This is an **Amplenote Plugin Embed Starter Project** — a React/TypeScript application that renders as a Kanban board inside an Amplenote embed. The build output is a zip file containing a markdown note + bundled JS attachment, imported into Amplenote as a plugin note.

**Package name:** `amplenote-embed-starter`

## Build & Test

```bash
# Install dependencies
npm install

# Dev server (esbuild watch + create-serve)
npm run dev
# Or alternative local dev with esbuild --servedir
npm run dev:local

# Production build (outputs a .zip file for Amplenote import)
npm run build

# Run tests
npm test                # vitest run
npx vitest run src/kanban-core.test.ts   # single test file
```

## Structure

- `build.mjs` — build orchestrator: esbuild bundles the React app, then JSZip packages it into an Amplenote-importable markdown + attachment zip
- `src/index.tsx` — app entry point
- `src/embed.tsx` — Amplenote embed renderer (sidebar)
- `src/kanban-core.ts` — Kanban board logic (columns, cards, drag-and-drop via @hello-pangea/dnd)
- `src/kanban-core.test.ts` — unit tests for board logic
- `src/components/` — UI components
- `src/types.ts` — TypeScript types
- `public/` — static assets served during dev

## Amplenote Plugin Actions

The plugin implements three Amplenote embed actions:
- `appOption` — triggers the plugin via quick open menu, opens a sidebar embed
- `renderEmbed` — renders the React app in the Amplenote sidebar
- `onEmbedCall` — handles `window.callAmplenotePlugin` calls from embed code

## Key Dependencies

- **@hello-pangea/dnd** — drag-and-drop for the Kanban board
- **react 18 / react-dom** — UI framework
- **esbuild** — bundler (no webpack/vite)
- **vitest** — test runner
- **jszip** — generates the Amplenote-importable zip
- **lucide-react** — icons
- **mdast-util-from-markdown** — markdown parsing

## Conventions

- TypeScript strict mode (`tsconfig.json`: `strict: true`, target `es2022`)
- Tests co-located with source (`*.test.ts` next to the module)
- Build output goes to `dist/`
