# Phase 01: Foundation and UI Prototype

This phase sets up the build environment and implements the core Drag-and-Drop Kanban UI using mock data. This provides a fast, satisfying, and verifiable start without requiring immediate integration with the Amplenote API.

## Tasks

- [x] Initialize project configuration:
  - Create `package.json` with `react`, `react-dom`, `@hello-pangea/dnd`, `esbuild` (for single-file Amplenote output), and `typescript`.
  - Create `tsconfig.json` with strict mode, DOM lib, and JSX configured for React.
  - Create a `build.js` script using esbuild to bundle everything into a single `dist/plugin.js` file.

- [x] Create mock state and data models:
  - Create `src/types.ts` defining `Board`, `Column`, and `Card` interfaces.
  - Create `src/mockData.ts` with a sample Board containing 3 columns ("To Do", "Doing", "Done") and a few mock cards representing markdown tasks.

- [x] Create Kanban Board and Drag-and-Drop context:
  - Create `src/components/Board.tsx` that sets up `<DragDropContext>` from `@hello-pangea/dnd`.
  - Add React state management for columns and cards.
  - Implement `onDragEnd` handler to safely move cards between columns and reorder within columns.

- [x] Build Column and Card UI components:
  - Create `src/components/Column.tsx` using `<Droppable>` to render a column of cards, with a dynamic column title.
  - Create `src/components/Card.tsx` using `<Draggable>` to render individual tasks.
  - Add a "+ Add Task" button placeholder in each column.

- [x] Create a local dev preview wrapper:
  - Create `public/index.html` with a root div.
  - Create `src/dev.tsx` that mounts the `<Board>` into the DOM for local browser testing.
  - Add a `npm run dev` script to `package.json` that serves `public/` and watch-builds `src/dev.tsx`.
