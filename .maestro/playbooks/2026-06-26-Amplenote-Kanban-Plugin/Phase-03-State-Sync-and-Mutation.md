# Phase 03: State Sync and Note Mutation

This phase enables editing and rearranging cards in the UI and seamlessly writing those changes back to the underlying Markdown note in Amplenote.

## Tasks

- [ ] Create Markdown Serializer service:
  - Create `src/services/markdownSerializer.ts`.
  - Implement logic to convert a modified React `Board` state back into a valid Markdown string.
  - Ensure text outside of tasks (like regular paragraphs under a heading) is preserved when regenerating the column content.

- [ ] Implement Drag-and-Drop Sync:
  - Update the `onDragEnd` handler in `Board.tsx`.
  - On drop, calculate the new board state, serialize it, and use the Amplenote API to save changes to the active note.
  - Implement the "strikeout on last column" rule: if a card is moved to the final column in the board state, modify its markdown to be checked off (`- [x]`) or struck through (`~~`).

- [ ] Implement Inline Card Creation and Editing:
  - Wire up the "+ Add Task" button to create a new task in the React state and sync it to the note.
  - Implement inline editing for `Card.tsx`: clicking a card switches to a text area showing the raw markdown task text.
  - Save edits on blur/enter and sync the markdown back to Amplenote.

- [ ] Implement Column Operations:
  - Add UI controls to edit column names (headings), delete columns, and add new columns.
  - Ensure that when a column is deleted, all its tasks are moved to a generic "Uncategorized" section at the top of the note.
  - Reordering columns in UI should reorder the markdown headings in the document.
