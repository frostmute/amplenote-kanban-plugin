# Phase 02: Amplenote API and Markdown Parsing

This phase bridges the gap between the UI prototype and Amplenote by building the markdown parser and the official Amplenote plugin wrapper.

## Tasks

- [x] Create Amplenote Plugin entry point:
  - Create `src/plugin.ts` following the Amplenote Plugin API structure.
  - Implement the `noteOption` function to trigger the Kanban view for the current note.
  - Update esbuild configuration to export this as the default global object required by Amplenote.

- [x] Create Markdown Parser service:
  - Create `src/services/markdownParser.ts`.
  - Implement logic to parse an Amplenote markdown string into our `Board` state.
  - Extract headings (e.g., `### To Do`) as columns.
  - Extract checklist items (`- [ ] task`) immediately following headings as cards.

- [x] Integrate parser with Kanban UI:
  - Create `src/components/AmplenoteWrapper.tsx` that accepts the raw markdown note text.
  - Hydrate the React state using the `markdownParser` service instead of the mock data.
  - Handle standard Amplenote styling and CSS resets within the wrapper.

- [x] Setup testing for parser:
  - Create `src/services/markdownParser.test.ts`.
  - Write tests ensuring standard markdown, markdown with no tasks, and markdown with text between tasks all parse gracefully into the expected Board state.
  - Add `npm run test` script to run these validations.
